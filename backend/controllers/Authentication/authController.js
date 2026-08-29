import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../../models/User.js';
import Session from '../../models/Session.js';
import { saveUserMetadata } from '../../middleware/collectUserMetadata.js';
import { hashIP, generateJti, generateDeviceId } from '../../utils/authSecurity.js'; // ✅ added generateDeviceId
import { logUserActivity } from '../../middleware/auditLogger.js';



// ─── DEBUG HELPER ───────────────────────────────────────────
const debug = (req, message, data = {}) => {
  const timestamp = new Date().toISOString();
  const requestId = req.id || 'unknown';
  console.log(`[${timestamp}] [${requestId}] ${message}`, JSON.stringify(data, null, 2));
};


// ─────────────────────────────────────────────────────────────
// CORE HELPER: handleLoginSuccess
// Called after any successful login (local, Google, or passkey).
//
// FIXES applied:
//   1. Removed req.body.deviceId requirement → now uses generateDeviceId(req)
//   2. Replaced all user.id with user._id.toString() (Mongoose safe)
//   3. Changed error handling: returns 500 JSON instead of throwing
//   4. Added generateDeviceId import from authSecurity.js
//
// Responsibilities:
//   1. Generate a short-lived access token (JWT)
//   2. Generate a long-lived refresh token with a unique JTI
//   3. Save the session to the Session collection (using server‑generated deviceId)
//   4. Set the refresh token as an httpOnly cookie
//   5. Build the user info object to return to the client
//   6. Return the access token + user info to the client
//   7. Log the login event to the activity log
export const handleLoginSuccess = async (res, user, req, { redirectTo } = {}) => {
  const requestStart = Date.now();
  const accessTokenSecret = process.env.ACCESS_SECRET_KEY;
  const refreshTokenSecret = process.env.REFRESH_SECRET_KEY;
  const accessTokenExpiry = process.env.ACCESS_TOKEN_EXPIRY || '15m';
  const refreshTokenExpiry = process.env.REFRESH_TOKEN_EXPIRY || '7d';

  try {
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

    const jti = generateJti();
    const refreshToken = jwt.sign(
      { userId: user._id.toString(), jti },
      refreshTokenSecret,
      { expiresIn: refreshTokenExpiry }
    );

    const ip = req.ip || req.socket.remoteAddress || '';
    const userAgent = req.get('user-agent') || 'unknown';
    const deviceId = generateDeviceId(req);

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

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    };
    debug(req, '🍪 Setting jwt_refresh cookie', {
      options: cookieOptions,
      tokenPrefix: refreshToken.substring(0, 10) + '...',
    });
    res.cookie('jwt_refresh', refreshToken, cookieOptions);

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

    await logUserActivity(
      user._id,
      'USER_LOGIN',
      `User:${user._id}`,
      { authProvider: user.authProvider, deviceId },
      ip,
      userAgent
    );

    debug(req, '✅ Login successful, sending response', {
      redirectTo,
      userId: user._id.toString(),
      elapsed: Date.now() - requestStart,
    });

    if (redirectTo) {
      return res.redirect(redirectTo);
    }
    return res.json({ accessToken, user: userInfo });

  } catch (error) {
    debug(req, '💥 Token generation error', { error: error.message });
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
//   Without a state check, an attacker can complete their OWN
//   Google OAuth flow, then send the resulting callback URL
//   (with their valid `code`) to a victim. If the victim opens
//   it, googleAuthCallback would log the victim's browser into
//   the attacker's account — a login CSRF attack.
//
//   By requiring the state returned from Google to match the
//   state we stored in this cookie, we guarantee the callback
//   only completes for the same browser that started the flow.
//
// The cookie is scoped to /api/auth/google (not the whole site)
// and expires in 2 minutes — long enough for the Google consent
// screen, short enough to limit replay risk.
// ─────────────────────────────────────────────────────────────
export const googleAuthInit = (req, res) => {
  const state = crypto.randomBytes(32).toString('hex');

  debug(req, '🔐 Google Init - setting oauth_state cookie', {
    state: state.substring(0, 8) + '...',
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 2 * 60 * 1000,
      path: '/api/auth/google',
    },
  });

  res.cookie('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 2 * 60 * 1000,
    path: '/api/auth/google',
  });

  debug(req, '✅ oauth_state cookie set (via Set-Cookie header)');
  return res.json({ state });
};

// ─────────────────────────────────────────────────────────────
// GOOGLE AUTH CALLBACK: googleAuthCallback
//
// GET /api/auth/google/callback
// Google redirects here directly with ?code=...&state=... after
// consent. This replaces the old popup-based googleAuth(access_token)
// flow.
//
// FIXES applied:
//   - Verifies `state` against the oauth_state cookie set by
//     googleAuthInit, before doing anything else. Prevents login CSRF.
// ─────────────────────────────────────────────────────────────
export const googleAuthCallback = async (req, res) => {
  const requestStart = Date.now();

  debug(req, '🚨 Google Callback reached', {
    NODE_ENV: process.env.NODE_ENV,
    query: req.query,
    cookies: {
      oauth_state: req.cookies.oauth_state ? 'PRESENT' : 'MISSING',
      jwt_refresh: req.cookies.jwt_refresh ? 'PRESENT' : 'MISSING',
      all_cookie_names: Object.keys(req.cookies),
    },
    headers: {
      host: req.headers.host,
      origin: req.headers.origin,
      referer: req.headers.referer,
      'user-agent': req.headers['user-agent'],
    },
    frontend_url: process.env.FRONTEND_URL,
  });

  const { code, state, error: googleError } = req.query;
  const frontendUrl = process.env.FRONTEND_URL;
  const stateCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth/google',
  };

  // 🔒 Verify state
  const expectedState = req.cookies.oauth_state;
  debug(req, '🔍 State verification', {
    providedState: state ? state.substring(0, 8) + '...' : 'undefined',
    expectedState: expectedState ? expectedState.substring(0, 8) + '...' : 'undefined',
    match: state && expectedState && state === expectedState,
  });

  res.clearCookie('oauth_state', stateCookieOptions);
  debug(req, '🗑️ Cleared oauth_state cookie');

  if (!state || !expectedState || state !== expectedState) {
    debug(req, '❌ State mismatch – redirecting to login error');
    return res.redirect(`${frontendUrl}/login?error=google_auth_failed`);
  }

  if (googleError) {
    debug(req, `❌ Google returned error: ${googleError}`);
    return res.redirect(`${frontendUrl}/login?error=google_auth_cancelled`);
  }
  if (!code) {
    debug(req, '❌ No authorization code received');
    return res.redirect(`${frontendUrl}/login?error=google_auth_failed`);
  }

  try {
    debug(req, '🔄 Exchanging code for tokens...');
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
      const errorText = await tokenResponse.text();
      debug(req, `❌ Token exchange failed: ${tokenResponse.status}`, { errorText });
      return res.redirect(`${frontendUrl}/login?error=google_auth_failed`);
    }

    const { access_token } = await tokenResponse.json();
    debug(req, '✅ Token exchange successful');

    debug(req, '🔄 Fetching Google user info');
    const googleResponse = await fetch(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      { method: 'GET', headers: { Authorization: `Bearer ${access_token}` } }
    );

    if (!googleResponse.ok) {
      debug(req, `❌ Google userinfo request failed: ${googleResponse.status}`);
      return res.redirect(`${frontendUrl}/login?error=google_auth_failed`);
    }

    const payload = await googleResponse.json();
    debug(req, '✅ Google userinfo received', {
      email: payload.email,
      email_verified: payload.email_verified,
      name: payload.name,
    });

    if (!payload || !payload.email) {
      debug(req, '❌ No email in Google payload');
      return res.redirect(`${frontendUrl}/login?error=google_auth_failed`);
    }

    const { name, email, picture, email_verified } = payload;

    if (email_verified !== true) {
      debug(req, '❌ Email not verified');
      return res.redirect(`${frontendUrl}/login?error=google_email_unverified`);
    }

    let user = await User.findOne({ email });
    debug(req, '👤 User lookup result', { exists: !!user, authProvider: user?.authProvider });

    if (!user) {
      debug(req, '🆕 Creating new Google user');
      user = new User({
        name: name || 'Google User',
        email,
        authProvider: 'google',
        profilePictureUrl: picture || null,
      });
      await user.save();
      debug(req, '✅ User created', { userId: user._id.toString() });
    } else if (user.authProvider === 'email') {
      debug(req, '⚠️ Email/password account conflict – redirecting');
      return res.redirect(`${frontendUrl}/login?error=email_provider_conflict`);
    } else {
      if (picture && user.profilePictureUrl !== picture) {
        user.profilePictureUrl = picture;
        await user.save();
        debug(req, '🖼️ Updated profile picture');
      }
    }

    if (user.status !== 'active') {
      debug(req, '🚫 Account not active');
      return res.redirect(`${frontendUrl}/login?error=account_banned`);
    }

    await saveUserMetadata(req, user._id);

    debug(req, '✅ Issuing session and redirecting');
    return handleLoginSuccess(res, user, req, {
      redirectTo: user.role === 'admin' ? `${frontendUrl}/admin` : frontendUrl,
    });

  } catch (err) {
    debug(req, '💥 Google Auth Callback Error', { message: err.message, stack: err.stack });
    return res.redirect(`${frontendUrl}/login?error=google_auth_failed`);
  } finally {
    debug(req, `⏱️ Callback completed in ${Date.now() - requestStart}ms`);
  }
};


// ─────────────────────────────────────────────────────────────
// SIGNUP: signup
// Registers a new user with email + password.
//
// Flow:
//   1. Check if email already taken
//      a. Google account → redirect to Google login
//      b. Email account → tell user to login
//   2. Create new user (password hashed by User model pre-save hook)
//   3. Log USER_CREATED event
// ─────────────────────────────────────────────────────────────
export const signup = async (req, res) => {
    try {
        const { email, password, name } = req.body;

        // Check existing user
        const existingUser = await User.findOne({ email });

        if (existingUser) {
            if (existingUser.authProvider === 'google') {
                return res.status(400).json({
                    message: 'This email is registered with Google. Please use Google login.'
                });
            }
            return res.status(400).json({ message: 'Email already registered. Please login.' });
        }

        // Create new user
        const user = new User({ email, password, name });
        await user.save();

        // Log signup activity
        const ip = req.ip || req.socket.remoteAddress || '';
        await logUserActivity(
            user._id,
            'USER_CREATED',
            `User:${user._id}`,
            { authProvider: 'email' },
            ip,
            req.get('user-agent') || 'unknown'
        );

        return res.status(201).json({ message: 'User registered successfully. Please login.' });

    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ message: 'Email already registered. Please login.' });
        }
        console.error('Signup Error:', err.message);
        return res.status(500).json({ message: 'Server error during signup.' });
    }
};


// ─────────────────────────────────────────────────────────────
// LOGIN: login
// Authenticates a user with email + password.
//
// 🔒 FIXED: Timing attack protection – both "user exists" and
// "user doesn't exist" paths now take the same amount of time.
// ─────────────────────────────────────────────────────────────
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // ✅ Pre-compute a fixed bcrypt hash (any valid hash works)
        // This is used to normalize timing on the "user not found" path
        const dummyHash = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

        // Fetch user including password field (excluded by default)
        const user = await User.findOne({ email }).select('+password');

        // 🔒 FIX: Always run bcrypt.compare() – even if user doesn't exist
        // This ensures both branches take the same ~100ms
        let isMatch = false;
        if (user && user.password) {
            // Real user → compare against their actual password
            isMatch = await bcrypt.compare(password, user.password);
        } else {
            // Non-existent user → compare against a dummy hash
            // This takes the same time as a real bcrypt compare
            await bcrypt.compare(password, dummyHash);
        }

        // Reject if no user, password missing, or password doesn't match
        if (!user || !user.password || !isMatch) {
            return res.status(401).json({
                message: 'Invalid credentials or please use your social login provider.'
            });
        }

        // Check account status
        if (user.status !== 'active') {
            return res.status(403).json({
                message: 'Your account has been banned. Please contact support.'
            });
        }

        // Save metadata and complete login
        await saveUserMetadata(req, user._id);
        return handleLoginSuccess(res, user, req);

    } catch (err) {
        console.error('Login Error:', err.message);
        return res.status(500).json({ message: 'Server error during login.' });
    }
};
