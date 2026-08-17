import jwt from 'jsonwebtoken';
import User from '../../models/User.js';
import Session from '../../models/Session.js';
import { hashIP, generateJti, isTokenValidAfterChange } from '../../utils/authSecurity.js';
import { logUserActivity } from '../../middleware/auditLogger.js';

// ─────────────────────────────────────────────────────────────
// REFRESH TOKEN
//
// Validates the refresh token cookie, rotates the token (new JTI),
// updates the session, and issues a new access token.
//
// Flow:
//   1. Verify refresh token and extract userId + jti
//   2. Find session matching user + jti (prevents reuse attacks)
//   3. Fetch user with passwordChangedAt (to enforce password change)
//   4. Check if session was created after last password change
//   5. Generate new JTI, rotate refresh token, update session
//   6. Issue new access token and return user info
//
// FIXES applied:
//   - Added audit logging for successful refresh
//   - Replaced user.id with user._id.toString() for consistency
//   - Added proper comments
// ─────────────────────────────────────────────────────────────
export const refreshToken = async (req, res) => {
    const refreshTokenSecret = process.env.REFRESH_SECRET_KEY;
    const accessTokenSecret = process.env.ACCESS_SECRET_KEY;
    const accessTokenExpiry = process.env.ACCESS_TOKEN_EXPIRY || '15m';
    const refreshTokenExpiry = process.env.REFRESH_TOKEN_EXPIRY || '7d';

    const token = req.cookies.jwt_refresh;

    if (!token) {
        return res.status(401).json({ message: 'No refresh token provided.' });
    }

    try {
        const decoded = jwt.verify(token, refreshTokenSecret);
        const { userId, jti } = decoded;

        // Step 1: Validate session exists with this JTI
        const session = await Session.findOne({ user: userId, jti });

        if (!session) {
            // Token reuse detected: revoke all sessions for this user
            await Session.deleteMany({ user: userId });
            return res.status(403).json({
                message: 'Security alert: Token reuse detected. All sessions revoked. Please login again.'
            });
        }

        // Step 2: Fetch user with passwordChangedAt
        const user = await User.findById(userId).select('+passwordChangedAt');

        if (!user || user.status !== 'active') {
            await Session.deleteMany({ user: userId });
            return res.status(403).json({ message: 'User inactive or not found.' });
        }

        // Step 3: Check if token was issued before password change
        if (user.passwordChangedAt) {
            const isValid = isTokenValidAfterChange(
                Math.floor(session.createdAt.getTime() / 1000),
                user.passwordChangedAt
            );
            if (!isValid) {
                await Session.deleteMany({ user: userId });
                return res.status(403).json({
                    message: 'Password changed. All sessions revoked. Please login again.'
                });
            }
        }

        // Step 4: Extract deviceId from existing session
        const deviceId = session.deviceId;

        // Step 5: Generate new JTI and refresh token
        const newJti = generateJti();
        // ✅ FIX: Use user._id.toString() for consistency
        const newRefreshToken = jwt.sign(
            { userId: user._id.toString(), jti: newJti },
            refreshTokenSecret,
            { expiresIn: refreshTokenExpiry }
        );

        // Step 6: Update session with new JTI and metadata
        const ip = req.ip || req.socket.remoteAddress || '';
        const userAgent = req.get('user-agent') || 'unknown';
        await Session.findOneAndUpdate(
            { user: user._id, deviceId },
            {
                jti: newJti,
                userAgent,
                ipHash: hashIP(ip),
                lastActive: Date.now(),
            },
            { upsert: true, setDefaultsOnInsert: true }
        );

        // Step 7: Set new refresh token cookie
        res.cookie('jwt_refresh', newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/',
        });

        // Step 8: Generate new access token
        const accessToken = jwt.sign(
            {
                userInfo: {
                    id: user._id.toString(),
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    status: user.status,
                    profilePictureUrl: user.profilePictureUrl || null,
                    authProvider: user.authProvider || 'email'
                }
            },
            accessTokenSecret,
            { expiresIn: accessTokenExpiry }
        );

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

        // ✅ FIX: Add audit log for token refresh
        await logUserActivity(
            userId,
            'TOKEN_REFRESHED',
            `User:${userId}`,
            { deviceId },
            ip,
            userAgent
        );

        console.log('✅ Refresh successful - Token rotated, new session created');
        return res.json({ accessToken, user: userInfo });

    } catch (err) {
        console.error('Refresh token invalid or expired:', err.name);
        return res.status(403).json({ message: 'Refresh token invalid or expired.' });
    }
};

// ─────────────────────────────────────────────────────────────
// LOGOUT
//
// Deletes the specific session document matching the refresh token's JTI,
// then clears the refresh token cookie.
//
// Flow:
//   1. Verify refresh token (if present)
//   2. Delete the exact session using userId + jti
//   3. Clear the cookie regardless of token validity
// ─────────────────────────────────────────────────────────────
export const logout = async (req, res) => {
    const refreshTokenSecret = process.env.REFRESH_SECRET_KEY;
    const token = req.cookies.jwt_refresh;

    if (token) {
        try {
            const decoded = jwt.verify(token, refreshTokenSecret);
            const { userId, jti } = decoded;
            await Session.deleteOne({ user: userId, jti });
            console.log(`✅ Session deleted for user ${userId}`);
        } catch (err) {
            console.log('Logout: Invalid token, clearing cookie anyway');
        }
    }

    res.clearCookie('jwt_refresh', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/'
    });

    return res.sendStatus(204);
};

// ─────────────────────────────────────────────────────────────
// LOGOUT ALL DEVICES
//
// Deletes ALL sessions belonging to the authenticated user,
// clears the refresh token cookie, and logs the event.
//
// FIXES applied:
//   - Corrected logUserActivity call: third argument is string, fourth is details object
// ─────────────────────────────────────────────────────────────
export const logoutAllDevices = async (req, res) => {
    try {
        const userId = req.user._id;
        await Session.deleteMany({ user: userId });

        res.clearCookie('jwt_refresh', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/'
        });

        const ip = req.ip || req.socket.remoteAddress || '';
        // ✅ FIX: target is string, details is object
        await logUserActivity(
            userId,
            'SESSION_REVOKED',
            `User:${userId}`,           // target as string
            { action: 'logout_all_devices' },  // details object
            ip,
            req.get('user-agent')
        );

        console.log(`✅ All sessions revoked for user ${userId}`);
        return res.sendStatus(204);
    } catch (err) {
        console.error('Logout all devices error:', err);
        return res.status(500).json({ message: 'Failed to logout all devices.' });
    }
};

// ─────────────────────────────────────────────────────────────
// GET ACTIVE SESSIONS
//
// Returns a list of active sessions for the authenticated user,
// grouped by deviceId. Marks the session using the current refresh token JTI.
// ─────────────────────────────────────────────────────────────
export const getActiveSessions = async (req, res) => {
    const refreshTokenSecret = process.env.REFRESH_SECRET_KEY;
    try {
        const userId = req.user._id;

        // Aggregate: one document per deviceId (most recent per device)
        const sessions = await Session.aggregate([
            { $match: { user: userId } },
            { $sort: { lastActive: -1 } },
            {
                $group: {
                    _id: '$deviceId',
                    sessionId: { $first: '$_id' },
                    jti: { $first: '$jti' },
                    userAgent: { $first: '$userAgent' },
                    ipHash: { $first: '$ipHash' },
                    createdAt: { $first: '$createdAt' },
                    lastActive: { $first: '$lastActive' },
                }
            },
            { $sort: { lastActive: -1 } }
        ]);

        const currentToken = req.cookies.jwt_refresh;
        let currentJti = null;
        try {
            const dec = jwt.verify(currentToken, refreshTokenSecret);
            currentJti = dec.jti;
        } catch (e) {
            // No valid current token – fine
        }

        return res.json({
            sessions: sessions.map(s => ({
                id: s.sessionId,
                deviceId: s._id,
                device: s.userAgent,
                ipHash: s.ipHash,
                createdAt: s.createdAt,
                lastActive: s.lastActive,
                current: s.jti === currentJti
            }))
        });
    } catch (err) {
        console.error('Get active sessions error:', err);
        return res.status(500).json({ message: 'Failed to get active sessions.' });
    }
};

// ─────────────────────────────────────────────────────────────
// REVOKE SESSION
//
// Deletes a specific session by ID (only if it belongs to the authenticated user).
// Logs the revocation event.
// ─────────────────────────────────────────────────────────────
export const revokeSession = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const userId = req.user._id;

        const result = await Session.deleteOne({
            _id: sessionId,
            user: userId
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Session not found.' });
        }

        const ip = req.ip || req.socket.remoteAddress || '';
        await logUserActivity(
            userId,
            'SESSION_REVOKED',
            `Session:${sessionId}`,
            { revokedBy: userId },
            ip,
            req.get('user-agent')
        );

        console.log(`✅ Session ${sessionId} revoked for user ${userId}`);
        return res.sendStatus(204);
    } catch (err) {
        console.error('Revoke session error:', err);
        return res.status(500).json({ message: 'Failed to revoke session.' });
    }
};