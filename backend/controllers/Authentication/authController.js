import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../../models/User.js';
import Session from '../../models/Session.js';
import { saveUserMetadata } from '../../middleware/collectUserMetadata.js';
import { hashIP, generateJti } from '../../utils/authSecurity.js';
import { logUserActivity } from '../../middleware/auditLogger.js';


// ─────────────────────────────────────────────────────────────
// CORE HELPER: handleLoginSuccess
// Called after any successful login (local or Google).
// Responsibilities:
//   1. Generate a short-lived access token (JWT)
//   2. Generate a long-lived refresh token with a unique JTI
//   3. Save the session to the Session collection (for tracking)
//   4. Set the refresh token as an httpOnly cookie
//   5. Return the access token + user info to the client
//   6. Log the login event to the activity log
// ─────────────────────────────────────────────────────────────
export const handleLoginSuccess = async (res, user, req) => {

    // ─────────────────────────────────────────────────────────────
    // Environment secrets & token config
    // ─────────────────────────────────────────────────────────────
    const accessTokenSecret = process.env.ACCESS_SECRET_KEY;
    const refreshTokenSecret = process.env.REFRESH_SECRET_KEY;
    const accessTokenExpiry = process.env.ACCESS_TOKEN_EXPIRY || '15m';
    const refreshTokenExpiry = process.env.REFRESH_TOKEN_EXPIRY || '7d';


    try {
        // Step 1: Sign a short-lived access token containing essential user info
        const accessToken = jwt.sign(
            {
                userInfo: {
                    id: user.id,
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

        // Step 2: Generate a unique JTI (JWT ID) for the refresh token
        // JTI allows us to invalidate specific sessions (e.g., on logout)
        const jti = generateJti();
        const refreshToken = jwt.sign(
            { userId: user.id, jti },
            refreshTokenSecret,
            { expiresIn: refreshTokenExpiry }
        );

        // Step 3: Collect request metadata for session tracking
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
        const userAgent = req.get('user-agent') || 'unknown';
        const deviceId = req.body.deviceId;

        if (!deviceId) {
            return res.status(400).json({ message: 'Device ID is required.' });
        }
        // Step 4: Persist the session in the database
        // UPSERT session (one per user+device)
        await Session.findOneAndUpdate(
            { user: user._id, deviceId },
            {
                jti,
                userAgent,
                ipHash: hashIP(ip),
                lastActive: Date.now(),
                // createdAt is only set on insert
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        // Step 5: Set the refresh token as a secure httpOnly cookie
        // httpOnly = not accessible via JS (XSS protection)
        // secure = HTTPS only in production
        // sameSite = lax to allow cookie on normal navigations
        res.cookie('jwt_refresh', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
            path: '/',
        });

        // Step 6: Build the user info object to send back to the client
        // Note: sensitive fields like password are intentionally excluded
        const userInfo = {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            status: user.status,
            profilePictureUrl: user.profilePictureUrl || null,
            createdAt: user.createdAt,
            authProvider: user.authProvider || 'email',
        };

        // Step 7: Log the login event for audit/activity tracking
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
        throw new Error('Server error during token generation');
    }
};


// ─────────────────────────────────────────────────────────────
// GOOGLE AUTH: googleAuth
// Handles login/signup via Google OAuth.
// Flow:
//   1. Verify the Google access token with Google's userinfo API
//   2. Check if a user with this email already exists
//      a. If NOT → create a new user with authProvider: 'google'
//      b. If YES + authProvider is 'local' → block (provider conflict)
//      c. If YES + authProvider is 'google' → allow, update picture if changed
//   3. Block suspended users
//   4. Save metadata + proceed to handleLoginSuccess
// ─────────────────────────────────────────────────────────────
export const googleAuth = async (req, res) => {
    const { access_token } = req.body;

    // Reject if no Google token was provided
    if (!access_token) {
        return res.status(400).json({ message: 'Google access token missing.' });
    }

    try {
        // Step 1: Verify the Google token by calling Google's userinfo endpoint
        const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${access_token}` },
        });

        if (!response.ok) {
            return res.status(401).json({ message: 'Invalid Google token.' });
        }

        const data = await response.json();

        // Ensure Google returned a valid email (required for user lookup)
        if (!data.email) {
            return res.status(401).json({ message: 'Google auth did not return a valid email.' });
        }

        const { name, email, picture } = data;

        // Step 2: Look up the user by email
        let user = await User.findOne({ email });

        if (!user) {
            // 2a. New user → create account with Google as the auth provider
            user = new User({ name, email, authProvider: 'google', profilePictureUrl: picture });
            await user.save();
        } else {
            // 2b. Email exists but was registered with email/password → block
            // Prevents someone from hijacking a local account via Google OAuth
            if (user.authProvider === 'email') {
                return res.status(400).json({
                    message: 'This email is registered with a password. Please login with your email and password.'
                });
            }

            // 2c. Existing Google user → update profile picture if it has changed
            if (user.profilePictureUrl !== picture) {
                user.profilePictureUrl = picture;
                await user.save();
            }
        }

        // Step 3: Block suspended users from logging in
        if (user.status !== 'active') {
            return res.status(403).json({ message: 'Your account has been suspended. Please contact support.' });
        }

        // Step 4: Save request metadata (IP, device, etc.) then complete login
        await saveUserMetadata(req, user._id);
        return handleLoginSuccess(res, user, req);

    } catch (err) {
        console.error('Google Auth Error:', err);
        return res.status(401).json({ message: 'Google authentication failed.' });
    }
};


// ─────────────────────────────────────────────────────────────
// SIGNUP: signup
// Registers a new user with email + password.
// Flow:
//   1. Check if the email is already taken
//      a. If taken by Google account → tell user to use Google login
//      b. If taken by local account → tell user to login instead
//   2. Create the new user (password hashing handled by User model pre-save hook)
//   3. Log the signup event
// ─────────────────────────────────────────────────────────────
export const signup = async (req, res) => {
    try {
        const { email, password, name } = req.body;

        // Step 1: Check if this email is already registered
        const existingUser = await User.findOne({ email });

        if (existingUser) {
            // 1a. Email belongs to a Google account → direct to Google login
            if (existingUser.authProvider === 'google') {
                return res.status(400).json({
                    message: 'This email is registered with Google. Please use Google login.'
                });
            }
            // 1b. Email belongs to a local account → direct to login
            return res.status(400).json({ message: 'Email already registered. Please login.' });
        }

        // Step 2: Create the new user
        // Password is hashed automatically via the User model's pre-save hook
        const user = new User({ email, password, name });
        await user.save();

        // Step 3: Log the signup event for audit tracking
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
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
        // Fallback duplicate key error (race condition safety net)
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
// Flow:
//   1. Find user by email (include password field which is excluded by default)
//   2. If no user or no password → could be a Google-only account → reject
//   3. Compare provided password with the stored hash
//   4. Save metadata + proceed to handleLoginSuccess
// ─────────────────────────────────────────────────────────────
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Step 1: Find user by email, explicitly selecting the password field
        // (password is excluded by default in the User model schema)
        const user = await User.findOne({ email }).select('+password');

        // Step 2: Reject if user not found or has no password (Google-only account)
        if (!user || !user.password) {
            return res.status(401).json({
                message: 'Invalid credentials or please use your social login provider.'
            });
        }

        // Step 3: Compare the provided plain-text password against the stored hash
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        // Step 4: Save request metadata then complete login
        await saveUserMetadata(req, user._id);
        return handleLoginSuccess(res, user, req);

    } catch (err) {
        console.error('Login Error:', err.message);
        return res.status(500).json({ message: 'Server error during login.' });
    }
};