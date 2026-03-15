import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { isTokenValidAfterChange } from '../utils/authSecurity.js';


export async function authenticateToken(req, res, next) {
    console.log('🔐 authMiddleware: ACCESS_SECRET_KEY loaded?', !!process.env.ACCESS_SECRET_KEY);
    console.log('🔐 authMiddleware: NODE_ENV:', process.env.NODE_ENV);
    const accessTokenSecret = process.env.ACCESS_SECRET_KEY;
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ message: 'No token, authorization denied' });
        }

        const decoded = jwt.verify(token, accessTokenSecret);

        // ✅ Fetch user with security fields
        const freshUser = await User.findById(decoded.userInfo.id).select('+passwordChangedAt');

        if (!freshUser) {
            return res.status(401).json({ message: 'User not found, authorization denied' });
        }

        // ✅ Check if user is active (catches banned users instantly)
        if (freshUser.status !== 'active') {
            return res.status(403).json({ message: 'Account is not active.' });
        }

        // In authenticateToken, replace the passwordChangedAt block:
        if (freshUser.passwordChangedAt) {
            const iat = decoded.iat;
            const changedAt = freshUser.passwordChangedAt;
            const changedAtSeconds = changedAt.getTime() / 1000;

            console.log('🔍 DEBUG passwordChangedAt (raw):', changedAt);
            console.log('🔍 DEBUG passwordChangedAt (ms):', changedAt.getTime());
            console.log('🔍 DEBUG passwordChangedAt (seconds):', changedAtSeconds);
            console.log('🔍 DEBUG token iat (seconds):', iat);
            console.log('🔍 DEBUG changedAt > iat?:', changedAtSeconds > iat);

            const isValid = isTokenValidAfterChange(iat, changedAt);
            console.log('🔍 DEBUG isValid:', isValid);

            if (!isValid) {
                return res.status(401).json({ message: 'Password changed. Please login again.' });
            }
        }

        req.user = freshUser;
        next();

    } catch (err) {
        // 🔒 Handle JWT specific errors with correct status codes
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired' }); // ← interceptor catches this and refreshes
        }
        if (err.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Invalid token' });
        }
        return res.status(403).json({ message: 'Unauthorized' });
    }
}

export function isAdmin(req, res, next) {
    if (req.user?.role === 'admin') {
        return next();
    } else {
        return res.status(403).json({ message: 'Forbidden: Requires admin privileges.' });
    }
}