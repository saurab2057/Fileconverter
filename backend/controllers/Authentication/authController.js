import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../../models/User.js';
import Session from '../../models/Session.js';
import { saveUserMetadata } from '../../middleware/collectUserMetadata.js';
import { hashIP, generateJti, generateDeviceId } from '../../utils/authSecurity.js'; // ✅ added generateDeviceId
import { logUserActivity } from '../../middleware/auditLogger.js';
import { OAuth2Client } from 'google-auth-library';

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
// ─────────────────────────────────────────────────────────────
export const handleLoginSuccess = async (res, user, req) => {

    // Environment secrets & token config
    const accessTokenSecret = process.env.ACCESS_SECRET_KEY;
    const refreshTokenSecret = process.env.REFRESH_SECRET_KEY;
    const accessTokenExpiry = process.env.ACCESS_TOKEN_EXPIRY || '15m';
    const refreshTokenExpiry = process.env.REFRESH_TOKEN_EXPIRY || '7d';

    try {
        // Step 1: Sign short-lived access token with user info
        // Note: user._id.toString() ensures string type (safe for frontend)
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

        // Step 2: Generate unique JTI and refresh token
        const jti = generateJti();
        const refreshToken = jwt.sign(
            { userId: user._id.toString(), jti },
            refreshTokenSecret,
            { expiresIn: refreshTokenExpiry }
        );

        // Step 3: Collect request metadata and generate deviceId server‑side
        // Use re.ip - Express computes it correctly (trust proxy is set to 1 in app.js)
        const ip = req.ip || req.socket.remoteAddress || '';
        const userAgent = req.get('user-agent') || 'unknown';
        const deviceId = generateDeviceId(req);  // ✅ FIX: generated, not from body

        // Step 4: Upsert session (one per user + deviceId)
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

        // Step 5: Set refresh token as httpOnly cookie
        res.cookie('jwt_refresh', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/',
        });

        // Step 6: Build sanitised user info (no password, no sensitive fields)
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

        // Step 7: Log successful login
        await logUserActivity(
            user._id,
            'USER_LOGIN',
            `User:${user._id}`,
            { authProvider: user.authProvider, deviceId },
            ip,
            userAgent
        );

        return res.json({ accessToken, user: userInfo });

    } catch (error) {
        console.error('Token generation error:', error);
        // ✅ FIX: return JSON instead of throwing (unhandled rejection)
        return res.status(500).json({ message: 'Server error during token generation' });
    }
};


// ─────────────────────────────────────────────────────────────
// GOOGLE AUTH: googleAuth
// Handles login/signup via Google OAuth.
//
// Flow:
//   1. Verify Google access token with Google's userinfo API
//   2. Check if user exists by email
//      a. New → create with authProvider: 'google'
//      b. Existing + email provider → block (provider conflict)
//      c. Existing + google provider → allow, update picture if changed
//   3. Block suspended users
//   4. Save metadata + proceed to handleLoginSuccess (deviceId generated inside)
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// GOOGLE AUTH: googleAuth
//
// Frontend uses @react-oauth/google -> useGoogleLogin()
// which gives us an OAuth ACCESS TOKEN, not an ID token.
//
// Therefore:
// ❌ Do NOT use client.verifyIdToken()
// ✅ Use Google's userinfo endpoint with the access token
// ─────────────────────────────────────────────────────────────
export const googleAuth = async (req, res) => {
    const { access_token } = req.body;

    if (!access_token) {
        return res.status(400).json({
            message: 'Google access token missing.'
        });
    }

    try {
        // ─────────────────────────────────────────────────────
        // 1. Verify the Google OAuth access token
        //    by requesting the authenticated user's profile.
        // ─────────────────────────────────────────────────────
        const googleResponse = await fetch(
            'https://www.googleapis.com/oauth2/v3/userinfo',
            {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${access_token}`,
                },
            }
        );

        if (!googleResponse.ok) {
            console.error(
                'Google userinfo request failed:',
                googleResponse.status
            );

            return res.status(401).json({
                message: 'Invalid or expired Google authentication.'
            });
        }

        const payload = await googleResponse.json();

        // ─────────────────────────────────────────────────────
        // 2. Validate Google profile response
        // ─────────────────────────────────────────────────────
        if (!payload || !payload.email) {
            return res.status(401).json({
                message: 'Google authentication did not return a valid email.'
            });
        }

        const {
            name,
            email,
            picture,
            email_verified,
            sub: googleId,
        } = payload;

        // Require Google's email verification
        if (email_verified !== true) {
            return res.status(401).json({
                message: 'Your Google email address is not verified.'
            });
        }

        // ─────────────────────────────────────────────────────
        // 3. Find existing user
        // ─────────────────────────────────────────────────────
        let user = await User.findOne({ email });

        // ─────────────────────────────────────────────────────
        // 4. Create new Google user
        // ─────────────────────────────────────────────────────
        if (!user) {
            user = new User({
                name: name || 'Google User',
                email,
                authProvider: 'google',
                profilePictureUrl: picture || null,
            });

            await user.save();
        }

        // ─────────────────────────────────────────────────────
        // 5. Existing email/password account
        // ─────────────────────────────────────────────────────
        else if (user.authProvider === 'email') {
            return res.status(400).json({
                message:
                    'This email is registered with a password. Please login with your email and password.'
            });
        }

        // ─────────────────────────────────────────────────────
        // 6. Existing Google account
        //    Update profile picture if Google changed it.
        // ─────────────────────────────────────────────────────
        else {
            if (
                picture &&
                user.profilePictureUrl !== picture
            ) {
                user.profilePictureUrl = picture;
                await user.save();
            }
        }

        // ─────────────────────────────────────────────────────
        // 7. Block inactive/banned accounts
        // ─────────────────────────────────────────────────────
        if (user.status !== 'active') {
            return res.status(403).json({
                message:
                    'Your account has been banned. Please contact support.'
            });
        }

        // ─────────────────────────────────────────────────────
        // 8. Save login metadata
        // ─────────────────────────────────────────────────────
        await saveUserMetadata(req, user._id);

        // ─────────────────────────────────────────────────────
        // 9. Create your normal application session/JWTs
        // ─────────────────────────────────────────────────────
        return handleLoginSuccess(res, user, req);

    } catch (err) {
        console.error('Google Auth Error:', err);

        return res.status(401).json({
            message: 'Google authentication failed.'
        });
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