// middleware/authMiddleware.js
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { isTokenValidAfterChange } from '../utils/authSecurity.js';


// ─────────────────────────────────────────────────────────────
// AUTHENTICATE TOKEN
//
// Validates the Bearer token on every protected route.
// Pipeline:
//   1. Extract token from Authorization header
//   2. Verify signature + expiry via jwt.verify
//   3. Re-fetch user from DB (catches banned accounts in real time)
//   4. Reject if token was issued before the last password change
//   5. Attach freshUser to req.user for downstream middleware
//
// Why re-fetch instead of trusting the JWT payload:
//   The payload is only as fresh as when the token was signed.
//   Re-fetching catches bans, role changes, and deletions that
//   happened after the token was issued.
// ─────────────────────────────────────────────────────────────
export async function authenticateToken(req, res, next) {
    const accessTokenSecret = process.env.ACCESS_SECRET_KEY;

    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ message: 'No token, authorization denied' });
        }

        const decoded = jwt.verify(token, accessTokenSecret);

        // Re-fetch user to get live status + passwordChangedAt.
        // passwordChangedAt is select: false in the schema — must be explicitly requested.
        const freshUser = await User.findById(decoded.userInfo.id).select('+passwordChangedAt');

        if (!freshUser) {
            return res.status(401).json({ message: 'User not found, authorization denied' });
        }

        // Catches bans applied after the token was issued.
        if (freshUser.status !== 'active') {
            return res.status(403).json({ message: 'Account is not active.' });
        }

        // Reject tokens issued before the last password change.
        // isTokenValidAfterChange handles the -1000ms clock skew
        // that User.js stamps on passwordChangedAt.
        if (!isTokenValidAfterChange(decoded.iat, freshUser.passwordChangedAt)) {
            return res.status(401).json({ message: 'Password changed. Please login again.' });
        }

        req.user = freshUser;
        next();

    } catch (err) {
        // Return the correct status per JWT error type so the frontend
        // interceptor can distinguish expiry (→ refresh) from tampering (→ logout).
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired' });
        }
        if (err.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Invalid token' });
        }
        return res.status(403).json({ message: 'Unauthorized' });
    }
}


// ─────────────────────────────────────────────────────────────
// IS ADMIN
//
// Must run after authenticateToken — depends on req.user being set.
// Role is read from the live DB record (attached by authenticateToken),
// not from the JWT payload, so role downgrades take effect immediately.
// ─────────────────────────────────────────────────────────────
export function isAdmin(req, res, next) {
    if (req.user?.role === 'admin') {
        return next();
    }
    return res.status(403).json({ message: 'Forbidden: Requires admin privileges.' });
}