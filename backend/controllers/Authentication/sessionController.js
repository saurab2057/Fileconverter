import jwt from 'jsonwebtoken';
import User from '../../models/User.js';
import Session from '../../models/Session.js';
import { hashIP, generateJti, isTokenValidAfterChange } from '../../utils/authSecurity.js';
import { logUserActivity } from '../../middleware/auditLogger.js';

/**
 * 🔒 REFRESH TOKEN: Validates Session collection + Token Rotation
 */
export const refreshToken = async (req, res) => {
    const refreshTokenSecret = process.env.REFRESH_SECRET_KEY;
    const accessTokenSecret = process.env.ACCESS_SECRET_KEY;
    const accessTokenExpiry = process.env.ACCESS_TOKEN_EXPIRY || '15m';
    const refreshTokenExpiry = process.env.REFRESH_TOKEN_EXPIRY || '7d';

    console.log('Cookies received:', req.cookies);
    const token = req.cookies.jwt_refresh;

    if (!token) {
        console.log('Refresh failed: No token');
        return res.status(401).json({ message: 'No refresh token provided.' });
    }

    try {
        const decoded = jwt.verify(token, refreshTokenSecret);
        const { userId, jti } = decoded;
        //First find the existing session using jti from the refresh token
        const session = await Session.findOne({ user: userId, jti });

        if (!session) {
            console.log('Refresh failed: Session not found (possible token reuse attack)');
            await Session.deleteMany({ user: userId });
            return res.status(403).json({
                message: 'Security alert: Token reuse detected. All sessions revoked. Please login again.'
            });
        }

        const user = await User.findById(userId).select('+passwordChangedAt');

        if (!user || user.status !== 'active') {
            await Session.deleteMany({ user: userId });
            return res.status(403).json({ message: 'User inactive or not found.' });
        }

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

        //extract device id from existing session
        const deviceId = session.deviceId;

        //generate new jti and refresh token, update session with new jti (same deviceId)
        const newJti = generateJti();
        const newRefreshToken = jwt.sign(
            { userId: user.id, jti: newJti },
            refreshTokenSecret,
            { expiresIn: refreshTokenExpiry }
        );

        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
        const userAgent = req.get('user-agent') || 'unknown';
        // UPSERT the session (same deviceId)
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

        res.cookie('jwt_refresh', newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/',
        });

        const accessToken = jwt.sign(
            {
                userInfo: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    status: user.status,
                    profilePictureUrl: user.profilePictureUrl || null,
                    authProvider: user.authProvider || 'local'
                }
            },
            accessTokenSecret,
            { expiresIn: accessTokenExpiry }
        );

        const userInfo = {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            status: user.status,
            profilePictureUrl: user.profilePictureUrl || null,
            createdAt: user.createdAt,
            authProvider: user.authProvider || 'local',
        };

        console.log('✅ Refresh successful - Token rotated, new session created');
        return res.json({ accessToken, user: userInfo });

    } catch (err) {
        console.log('Refresh error:', err.name);
        return res.status(403).json({ message: 'Refresh token invalid or expired.' });
    }
};

/**
 * 🔒 LOGOUT: Deletes Session document + clears cookie
 */
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

/**
 * 🔒 LOGOUT ALL DEVICES: Deletes ALL sessions for user
 */
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

        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
        await logUserActivity(
            userId,
            'SESSION_REVOKED',
            `User:${userId}`,
            { action: 'logout_all_devices' },
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

/**
 * 🔒 GET ACTIVE SESSIONS: List all active sessions for user
 */
export const getActiveSessions = async (req, res) => {
    const refreshTokenSecret = process.env.REFRESH_SECRET_KEY;
    try {
        const userId = req.user._id;

        // Aggregate: one document per deviceId
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
        } catch (e) {}

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
/**
 * 🔒 REVOKE SESSION: Delete specific session by ID
 */
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

        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
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