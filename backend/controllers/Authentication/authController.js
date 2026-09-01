import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../../models/User.js';
import Session from '../../models/Session.js';
import { saveUserMetadata } from '../../middleware/collectUserMetadata.js';
import { hashIP, generateJti, generateDeviceId } from '../../utils/authSecurity.js';
import { logUserActivity } from '../../middleware/auditLogger.js';

// ─────────────────────────────────────────────────────────────
// CORE HELPER: handleLoginSuccess
// Called after any successful login (local, Google, or passkey).
//
// Responsibilities:
//   1. Generate a short-lived access token (JWT)
//   2. Generate a long-lived refresh token with a unique JTI
//   3. Save the session to the Session collection (using server-generated deviceId)
//   4. Set the refresh token as an httpOnly cookie
//   5. Build the user info object to return to the client
//   6. Return the access token + user info to the client
//   7. Log the login event to the activity log
// ─────────────────────────────────────────────────────────────
export const handleLoginSuccess = async (res, user, req, { redirectTo } = {}) => {
  const accessTokenSecret = process.env.ACCESS_SECRET_KEY;
  const refreshTokenSecret = process.env.REFRESH_SECRET_KEY;
  const accessTokenExpiry = process.env.ACCESS_TOKEN_EXPIRY || '15m';
  const refreshTokenExpiry = process.env.REFRESH_TOKEN_EXPIRY || '7d';

  try {
    // 1. Generate short-lived access token
    const accessToken = jwt.sign(
      {
        userInfo: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          profilePictureUrl: user.profilePictureUrl || null,
          authProvider: user.authProvider || 'email',
        }
      },
      accessTokenSecret,
      { expiresIn: accessTokenExpiry }
    );

    // 2. Generate long-lived refresh token with unique JTI
    const jti = generateJti();
    const refreshToken = jwt.sign(
      { userId: user._id.toString(), jti },
      refreshTokenSecret,
      { expiresIn: refreshTokenExpiry }
    );

    // Extract request metadata for session tracking
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';
    const deviceId = generateDeviceId(req);

    // 3. Save/Update session in DB (upsert ensures any previous session for this device is overwritten)
    await Session.findOneAndUpdate(
      { user: user._id, deviceId },
      {
        jti,
        userAgent,
        ipHash: hashIP(ip),
        lastActive: Date.now(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 4. Set refresh token as httpOnly cookie
    // Dynamically sets sameSite to 'none' in prod (required for cross-origin) and 'lax' in dev
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    };
    
    res.cookie('jwt_refresh', refreshToken, cookieOptions);

    // 5. Build safe user info object (excludes sensitive fields like password)
    const userInfo = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      profilePictureUrl: user.profilePictureUrl || null,
      createdAt: user.createdAt,
      authProvider: user.authProvider || 'email',
    };

    // 7. Log the login event to the activity log (passing jti for precise session tracking)
    await logUserActivity(
      user._id,
      'USER_LOGIN',
      `User:${user._id}`,
      { authProvider: user.authProvider, deviceId },
      ip,
      userAgent,
      jti
    );

    // 6. Return response (redirect for OAuth flows, JSON for API calls)
    if (redirectTo) {
      return res.redirect(redirectTo);
    }
    
    return res.json({ accessToken, user: userInfo });

  } catch (error) {
    return res.status(500).json({ message: 'Server error during token generation' });
  }
};

// ─────────────────────────────────────────────────────────────
// GOOGLE AUTH INIT: googleAuthInit
//
// GET /api/auth/google/init
// Called by the frontend BEFORE redirecting the user to Google's
// consent screen. Issues a one-time random `state` value, stores
// it in a short-lived httpOnly cookie, and returns it to the
// client so it can be passed to Google as the `state` param.
//
// WHY THIS EXISTS:
//   Prevents Login CSRF. By requiring the state returned from 
//   Google to match the state stored in this cookie, we guarantee 
//   the callback only completes for the same browser that started 
//   the flow.
// ─────────────────────────────────────────────────────────────
export const googleAuthInit = (req, res) => {
  const state = crypto.randomBytes(32).toString('hex');

  console.log('🔍 [DEBUG] googleAuthInit: Generated state and setting cookie');

  res.cookie('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 2 * 60 * 1000, // Expires in 2 minutes
    path: '/api/auth', // Scoped only to the auth routes
  });

  return res.json({ state });
};

// ─────────────────────────────────────────────────────────────
// GOOGLE AUTH CALLBACK: googleAuthCallback
//
// GET /api/auth/google/callback
// Google redirects here directly with ?code=...&state=... after
// consent. Exchanges code for tokens, fetches user info, and 
// either logs the user in or creates a new account.
// ─────────────────────────────────────────────────────────────
export const googleAuthCallback = async (req, res) => {
  const { code, state, error: googleError } = req.query;
  const frontendUrl = process.env.FRONTEND_URL;
  
  console.log('🔍 [DEBUG] googleAuthCallback reached', { 
    hasCode: !!code, 
    hasState: !!state, 
    hasError: !!googleError,
    cookiesReceived: Object.keys(req.cookies)
  });

  // Cookie options used to clear the state cookie immediately after reading it
  const stateCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/api/auth',
  };

  // 🔒 Verify state to prevent Login CSRF
  const expectedState = req.cookies.oauth_state;
  res.clearCookie('oauth_state', stateCookieOptions); // Clear immediately to prevent replay

  if (!state || !expectedState || state !== expectedState) {
    console.error('❌ [DEBUG] Google Auth Failed: State mismatch or missing cookie.', { provided: state, expected: expectedState });
    return res.redirect(`${frontendUrl}/login?error=google_auth_failed`);
  }

  // Handle user cancellation or missing code from Google
  if (googleError) {
    console.error('❌ [DEBUG] Google Auth Failed: Google returned error:', googleError);
    return res.redirect(`${frontendUrl}/login?error=google_auth_cancelled`);
  }
  
  if (!code) {
    console.error('❌ [DEBUG] Google Auth Failed: No authorization code received.');
    return res.redirect(`${frontendUrl}/login?error=google_auth_failed`);
  }

  try {
    // Exchange authorization code for Google access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      console.error('❌ [DEBUG] Google Token Exchange Failed:', tokenResponse.status, errText);
      return res.redirect(`${frontendUrl}/login?error=google_auth_failed`);
    }

    const { access_token } = await tokenResponse.json();

    // Fetch user profile from Google using the access token
    const googleResponse = await fetch(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      { method: 'GET', headers: { Authorization: `Bearer ${access_token}` } }
    );

    if (!googleResponse.ok) {
      console.error('❌ [DEBUG] Google Userinfo Request Failed:', googleResponse.status);
      return res.redirect(`${frontendUrl}/login?error=google_auth_failed`);
    }

    const payload = await googleResponse.json();

    if (!payload || !payload.email) {
      console.error('❌ [DEBUG] Google Payload Missing Email:', payload);
      return res.redirect(`${frontendUrl}/login?error=google_auth_failed`);
    }

    const { name, email, picture, email_verified } = payload;
    
    // Normalize email to guarantee match with schema's lowercase: true
    const normalizedEmail = email.toLowerCase().trim();

    // Enforce verified emails only
    if (email_verified !== true) {
      console.error('❌ [DEBUG] Google Auth Failed: Email not verified by Google.');
      return res.redirect(`${frontendUrl}/login?error=google_email_unverified`);
    }

    // Check if user already exists in our database
    let user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      // Create new Google user
      user = new User({
        name: name || 'Google User',
        email: normalizedEmail,
        authProvider: 'google',
        profilePictureUrl: picture || null,
      });
      await user.save();
    } else if (user.authProvider === 'email') {
      console.error('❌ [DEBUG] Google Auth Failed: Email provider conflict.');
      return res.redirect(`${frontendUrl}/login?error=email_provider_conflict`);
    } else {
      // Existing Google user: update profile picture if it changed
      if (picture && user.profilePictureUrl !== picture) {
        user.profilePictureUrl = picture;
        await user.save();
      }
    }

    // Check if account is banned
    if (user.status !== 'active') {
      console.error('❌ [DEBUG] Google Auth Failed: Account is banned.');
      return res.redirect(`${frontendUrl}/login?error=account_banned`);
    }

    // Save IP/Device metadata
    await saveUserMetadata(req, user._id);

    // Issue session tokens and redirect to frontend
    return handleLoginSuccess(res, user, req, {
      redirectTo: user.role === 'admin' ? `${frontendUrl}/admin` : frontendUrl,
    });

  } catch (err) {
    console.error('💥 [DEBUG] Google Auth Callback CRASH:', err.message, err.stack);
    return res.redirect(`${frontendUrl}/login?error=google_auth_failed`);
  }
};

// ─────────────────────────────────────────────────────────────
// SIGNUP: signup
// Registers a new user with email + password.
//
// Flow:
//   1. Validate input and normalize email
//   2. Check if email already taken (handles provider conflicts)
//   3. Create new user (password hashed by User model pre-save hook)
//   4. Log USER_CREATED event
// ─────────────────────────────────────────────────────────────
export const signup = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Guard against missing fields to prevent downstream crashes
    if (!email || !password || !name) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

    // Normalize email for consistent DB lookup
    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      if (existingUser.authProvider === 'google') {
        return res.status(400).json({
          message: 'This email is registered with Google. Please use Google login.'
        });
      }
      return res.status(400).json({ message: 'Email already registered. Please login.' });
    }

    // Create new user (password will be hashed by pre-save hook)
    const user = new User({ email: normalizedEmail, password, name });
    await user.save();

    // Log signup activity
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';

    await logUserActivity(
      user._id,
      'USER_CREATED',
      `User:${user._id}`,
      { authProvider: 'email' },
      ip,
      userAgent
    );

    return res.status(201).json({ message: 'User registered successfully. Please login.' });

  } catch (err) {
    // Handle Mongoose Validation Errors (e.g., password < 8 chars)
    if (err.name === 'ValidationError') {
      const errorMessage = Object.values(err.errors)[0]?.message || 'Invalid input data.';
      return res.status(400).json({ message: errorMessage });
    }
    
    // Handle duplicate key errors (race condition safety net)
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Email already registered. Please login.' });
    }
    
    return res.status(500).json({ message: 'Server error during signup.' });
  }
};

// ─────────────────────────────────────────────────────────────
// LOGIN: login
// Authenticates a user with email + password.
//
// 🔒 Timing attack protection: both "user exists" and
// "user doesn't exist" paths run bcrypt.compare() to ensure
// they take the exact same amount of time.
// ─────────────────────────────────────────────────────────────
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Guard against missing fields to prevent bcrypt crash on undefined
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    // Pre-compute a fixed bcrypt hash to normalize timing on the "user not found" path
    const dummyHash = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
    
    // Normalize email for consistent DB lookup
    const normalizedEmail = email.toLowerCase().trim();

    // Fetch user including password field (excluded by default in schema)
    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    // 🔒 Always run bcrypt.compare() to maintain constant execution time
    let isMatch = false;
    if (user && user.password) {
      // Real user → compare against their actual password
      isMatch = await bcrypt.compare(password, user.password);
    } else {
      // Non-existent user (or Google user without password) → compare against dummy hash
      await bcrypt.compare(password, dummyHash);
    }

    // Reject if no user, password missing, or password doesn't match
    if (!user || !user.password || !isMatch) {
      return res.status(401).json({
        message: 'Invalid credentials or please use your social login provider.'
      });
    }

    // Check account status (banned users cannot login)
    if (user.status !== 'active') {
      return res.status(403).json({
        message: 'Your account has been banned. Please contact support.'
      });
    }

    // Save metadata and complete login (issues tokens and sets cookies)
    await saveUserMetadata(req, user._id);
    return handleLoginSuccess(res, user, req);

  } catch (err) {
    return res.status(500).json({ message: 'Server error during login.' });
  }
};
