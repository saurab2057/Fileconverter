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
// ─────────────────────────────────────────────────────────────
export const handleLoginSuccess = async (res, user, req, { redirectTo } = {}) => {
  const accessTokenSecret = process.env.ACCESS_SECRET_KEY;
  const refreshTokenSecret = process.env.REFRESH_SECRET_KEY;
  const accessTokenExpiry = process.env.ACCESS_TOKEN_EXPIRY || '15m';
  const refreshTokenExpiry = process.env.REFRESH_TOKEN_EXPIRY || '7d';

  try {
    console.log(`🔍 [DEBUG] handleLoginSuccess: Generating tokens for user ${user._id}`);

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

    const ip = req.ip || req.socket.remoteAddress || 'unknown';
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
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    };
    
    console.log(`🔍 [DEBUG] handleLoginSuccess: Setting jwt_refresh cookie. Options:`, cookieOptions);
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
      userAgent,
      jti
    );

    if (redirectTo) {
      console.log(`✅ [DEBUG] handleLoginSuccess: Redirecting to ${redirectTo}`);
      return res.redirect(redirectTo);
    }
    
    console.log(`✅ [DEBUG] handleLoginSuccess: Returning JSON response`);
    return res.json({ accessToken, user: userInfo });

  } catch (error) {
    console.error('💥 [DEBUG] handleLoginSuccess CRASH:', error.message, error.stack);
    return res.status(500).json({ message: 'Server error during token generation' });
  }
};

// ─────────────────────────────────────────────────────────────
// GOOGLE AUTH INIT: googleAuthInit
// ─────────────────────────────────────────────────────────────
export const googleAuthInit = (req, res) => {
  const state = crypto.randomBytes(32).toString('hex');
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 2 * 60 * 1000,
    path: '/',
  };
  res.cookie('oauth_state', state, cookieOptions);

  const scope = encodeURIComponent('openid email profile');
  const googleAuthUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${process.env.GOOGLE_CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(process.env.GOOGLE_REDIRECT_URI)}&` +
    `response_type=code&scope=${scope}&state=${state}&` +
    `access_type=offline&prompt=select_account`;

  return res.redirect(googleAuthUrl);
};

// ─────────────────────────────────────────────────────────────
// GOOGLE AUTH CALLBACK: googleAuthCallback
// ─────────────────────────────────────────────────────────────
export const googleAuthCallback = async (req, res) => {
  console.log('🔍 [DEBUG] googleAuthCallback: Request received');
  console.log('🔍 [DEBUG] googleAuthCallback: Query params:', { 
    hasCode: !!req.query.code, 
    hasState: !!req.query.state, 
    hasError: !!req.query.error 
  });
  console.log('🔍 [DEBUG] googleAuthCallback: Cookies received:', Object.keys(req.cookies));

  const { code, state, error: googleError } = req.query;
  const frontendUrl = process.env.FRONTEND_URL;
  
  const stateCookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
  };

  const expectedState = req.cookies.oauth_state;
  console.log(`🔍 [DEBUG] googleAuthCallback: Clearing oauth_state cookie`);
  res.clearCookie('oauth_state', stateCookieOptions);

  if (!state || !expectedState || state !== expectedState) {
    console.error('❌ [DEBUG] Google Auth Failed: State mismatch or missing cookie.', { 
      provided: state, 
      expected: expectedState 
    });
    return res.redirect(`${frontendUrl}/login?error=google_auth_failed`);
  }

  if (googleError) {
    console.error('❌ [DEBUG] Google Auth Failed: Google returned error:', googleError);
    return res.redirect(`${frontendUrl}/login?error=google_auth_cancelled`);
  }
  
  if (!code) {
    console.error('❌ [DEBUG] Google Auth Failed: No authorization code received in query.');
    return res.redirect(`${frontendUrl}/login?error=google_auth_failed`);
  }

  try {
    console.log('🔍 [DEBUG] Google Auth: Exchanging code for access token...');
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
    console.log('✅ [DEBUG] Google Token Exchange: Successful');

    const { access_token } = await tokenResponse.json();

    console.log('🔍 [DEBUG] Google Auth: Fetching user info from Google...');
    const googleResponse = await fetch(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      { method: 'GET', headers: { Authorization: `Bearer ${access_token}` } }
    );

    if (!googleResponse.ok) {
      console.error('❌ [DEBUG] Google Userinfo Request Failed:', googleResponse.status);
      return res.redirect(`${frontendUrl}/login?error=google_auth_failed`);
    }

    const payload = await googleResponse.json();
    console.log('🔍 [DEBUG] Google User Info received:', { 
      email: payload?.email, 
      email_verified: payload?.email_verified,
      hasName: !!payload?.name,
      hasPicture: !!payload?.picture
    });

    if (!payload || !payload.email) {
      console.error('❌ [DEBUG] Google Payload Missing Email:', payload);
      return res.redirect(`${frontendUrl}/login?error=google_auth_failed`);
    }

    const { name, email, picture, email_verified } = payload;
    const normalizedEmail = email.toLowerCase().trim();

    if (email_verified !== true) {
      console.error('❌ [DEBUG] Google Auth Failed: Email not verified by Google.');
      return res.redirect(`${frontendUrl}/login?error=google_email_unverified`);
    }

    console.log(`🔍 [DEBUG] Google Auth: Checking database for ${normalizedEmail}`);
    let user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      console.log('🔍 [DEBUG] Google Auth: User not found. Creating new Google user...');
      user = new User({
        name: name || 'Google User',
        email: normalizedEmail,
        authProvider: 'google',
        profilePictureUrl: picture || null,
      });
      await user.save();
      console.log('✅ [DEBUG] Google Auth: New user created successfully');
    } else if (user.authProvider === 'email') {
      console.error('❌ [DEBUG] Google Auth Failed: Email provider conflict.');
      return res.redirect(`${frontendUrl}/login?error=email_provider_conflict`);
    } else {
      console.log('🔍 [DEBUG] Google Auth: Existing Google user found.');
      if (picture && user.profilePictureUrl !== picture) {
        console.log('🔍 [DEBUG] Google Auth: Updating profile picture...');
        user.profilePictureUrl = picture;
        await user.save();
      }
    }

    if (user.status !== 'active') {
      console.error('❌ [DEBUG] Google Auth Failed: Account is banned.');
      return res.redirect(`${frontendUrl}/login?error=account_banned`);
    }

    console.log('🔍 [DEBUG] Google Auth: Saving user metadata...');
    await saveUserMetadata(req, user._id);

    const redirectTo = user.role === 'admin' ? `${frontendUrl}/admin` : frontendUrl;
    console.log(`✅ [DEBUG] Google Auth: All checks passed. Calling handleLoginSuccess, redirecting to: ${redirectTo}`);
    
    return handleLoginSuccess(res, user, req, { redirectTo });

  } catch (err) {
    console.error('💥 [DEBUG] Google Auth Callback CRASH:', err.message, err.stack);
    return res.redirect(`${frontendUrl}/login?error=google_auth_failed`);
  }
};

// ─────────────────────────────────────────────────────────────
// SIGNUP: signup
// ─────────────────────────────────────────────────────────────
export const signup = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log(`🔍 [DEBUG] Signup attempt for email: ${normalizedEmail}`);
    
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      if (existingUser.authProvider === 'google') {
        console.log('❌ [DEBUG] Signup Failed: Email registered with Google');
        return res.status(400).json({
          message: 'This email is registered with Google. Please use Google login.'
        });
      }
      console.log('❌ [DEBUG] Signup Failed: Email already registered');
      return res.status(400).json({ message: 'Email already registered. Please login.' });
    }

    console.log('🔍 [DEBUG] Signup: Creating new user...');
    const user = new User({ email: normalizedEmail, password, name });
    await user.save();
    console.log('✅ [DEBUG] Signup: User created successfully');

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
    if (err.name === 'ValidationError') {
      const errorMessage = Object.values(err.errors)[0]?.message || 'Invalid input data.';
      return res.status(400).json({ message: errorMessage });
    }
    
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Email already registered. Please login.' });
    }
    
    console.error('💥 [DEBUG] Signup CRASH:', err.message);
    return res.status(500).json({ message: 'Server error during signup.' });
  }
};

// ─────────────────────────────────────────────────────────────
// LOGIN: login
// ─────────────────────────────────────────────────────────────
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log(`🔍 [DEBUG] Login attempt for email: ${normalizedEmail}`);

    const dummyHash = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
    
    const user = await User.findOne({ email: normalizedEmail }).select('+password');
    
    console.log(`🔍 [DEBUG] Login: User found in DB: ${!!user}, AuthProvider: ${user?.authProvider || 'none'}`);

    let isMatch = false;
    if (user && user.password) {
      console.log('🔍 [DEBUG] Login: Comparing provided password with stored hash...');
      isMatch = await bcrypt.compare(password, user.password);
      console.log(`🔍 [DEBUG] Login: Password match result: ${isMatch}`);
    } else {
      console.log('🔍 [DEBUG] Login: User not found or no password. Running dummy hash comparison for timing attack protection...');
      await bcrypt.compare(password, dummyHash);
    }

    if (!user || !user.password || !isMatch) {
      console.error('❌ [DEBUG] Login Failed: Invalid credentials or provider mismatch');
      return res.status(401).json({
        message: 'Invalid credentials or please use your social login provider.'
      });
    }

    if (user.status !== 'active') {
      console.error(`❌ [DEBUG] Login Failed: Account status is '${user.status}' (not active)`);
      return res.status(403).json({
        message: 'Your account has been banned. Please contact support.'
      });
    }

    console.log('✅ [DEBUG] Login: Credentials valid. Saving metadata and issuing tokens...');
    await saveUserMetadata(req, user._id);
    
    console.log('✅ [DEBUG] Login: Success. Calling handleLoginSuccess...');
    return handleLoginSuccess(res, user, req);

  } catch (err) {
    console.error('💥 [DEBUG] Login CRASH:', err.message, err.stack);
    return res.status(500).json({ message: 'Server error during login.' });
  }
};
