import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../../models/User.js';
import Session from '../../models/Session.js';
import { Resend } from 'resend';
import { logUserActivity } from '../../middleware/auditLogger.js';

const resend = new Resend(process.env.RESEND_API_KEY);

// ─────────────────────────────────────────────────────────────
// FORGOT PASSWORD
//
// Flow:
//   1. Find user by email (only if exists, active, and has email provider)
//   2. Generate a short-lived JWT (10 min) containing only userId
//   3. Send reset link to user's email
//   4. Always return generic success (prevents email enumeration)
//
// FIXES applied:
//   - Added check for authProvider === 'email' and status === 'active'
//   - Changed JWT payload from { user: { id } } to { userId } (consistent structure)
//   - Only sends email if user qualifies; otherwise silently ignores
// ─────────────────────────────────────────────────────────────
export const forgotPassword = async (req, res) => {
    const resetPasswordSecret = process.env.RESET_PASSWORD_SECRET_KEY;
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });

        // ✅ FIX: Only proceed if user exists, is active, and uses email login
        if (user && user.status === 'active' && user.authProvider === 'email') {
            // ✅ FIX: JWT payload now { userId } – flat, not nested
            const resetToken = jwt.sign(
                { userId: user._id.toString() },
                resetPasswordSecret,
                { expiresIn: '10m' }
            );

            const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

            await resend.emails.send({
                from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
                to: user.email,
                subject: 'Your Password Reset Link',
                html: `<p>Hello ${user.name || 'User'},</p>
                       <p>Click this link to reset your password. It is valid for 10 minutes.</p>
                       <p><a href="${resetLink}"><strong>Reset Password</strong></a></p>
                       <p style="color:#666;font-size:12px;margin-top:20px">
                         If you didn't request this, please ignore this email.
                       </p>`
            });

            const forwarded = req.headers['x-forwarded-for'];
            const ip = forwarded ? forwarded.split(',')[0].trim() : req.socket.remoteAddress || '';
            await logUserActivity(
                user._id,
                'PASSWORD_RESET_REQUESTED',
                `User:${user._id}`,
                {},
                ip,
                req.get('user-agent')
            );
        }
        // Always return generic message (security: don't reveal if email exists)
        return res.status(200).json({
            message: 'If an active email account exists, you will receive a reset link. Please check your spam folder.'
        });
    } catch (error) {
        console.error('Forgot Password Error:', error);
        return res.status(500).json({ message: 'Server error during password reset process.' });
    }
};

// ─────────────────────────────────────────────────────────────
// VALIDATE RESET TOKEN
//
// Flow:
//   1. Verify the reset token (from email link)
//   2. On success, issue a short-lived httpOnly cookie 'reset_session'
//   3. The cookie is used in resetPassword to complete the operation
//
// FIXES applied:
//   - Now uses decoded.userId (matching new JWT structure from forgotPassword)
// ─────────────────────────────────────────────────────────────
export const validateResetToken = async (req, res) => {
    const resetPasswordSecret = process.env.RESET_PASSWORD_SECRET_KEY;
    const resetSessionSecret = process.env.COOKIE_SECRET_KEY;

    const { token } = req.body;
    if (!token) {
        return res.status(400).json({ message: 'Reset token required.' });
    }

    try {
        const decoded = jwt.verify(token, resetPasswordSecret);

        // ✅ FIX: Access userId directly (no nested user.id)
        const resetSession = jwt.sign(
            {
                userId: decoded.userId,
                purpose: 'password_reset',
                jti: crypto.randomUUID()
            },
            resetSessionSecret,
            { expiresIn: '10m' }
        );

        res.cookie('reset_session', resetSession, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 10 * 60 * 1000,
            path: '/api/auth/reset-password',
        });

        return res.json({
            valid: true,
            redirectUrl: '/reset-password-form'
        });
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Reset link expired. Request a new link.' });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Invalid reset link.' });
        }
        console.error('Token validation error:', error);
        return res.status(500).json({ message: 'Validation failed.' });
    }
};

// ─────────────────────────────────────────────────────────────
// RESET PASSWORD
//
// Flow:
//   1. Verify the reset_session cookie (httpOnly)
//   2. Find user and validate status + provider (must be active email account)
//   3. Hash and save new password (automatic via User model pre-save)
//   4. Revoke all sessions for this user
//   5. Clear reset cookie and return success
//
// FIXES applied:
//   - Added status check: only active users can reset
//   - Added provider check: only email accounts can reset
//   - Already used decoded.userId correctly (no change needed here)
// ─────────────────────────────────────────────────────────────
export const resetPassword = async (req, res) => {
    const resetSessionSecret = process.env.COOKIE_SECRET_KEY;

    const resetSession = req.cookies.reset_session;
    if (!resetSession) {
        return res.status(401).json({
            message: 'Reset session expired. Request a new reset link.'
        });
    }

    const { newPassword } = req.body;
    if (!newPassword) {
        return res.status(400).json({ message: 'New password required.' });
    }

    try {
        const decoded = jwt.verify(resetSession, resetSessionSecret);

        if (decoded.purpose !== 'password_reset') {
            return res.status(401).json({ message: 'Invalid reset session.' });
        }

        const userToReset = await User.findById(decoded.userId).select('+password');

        if (!userToReset) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // ✅ FIX: Block inactive accounts
        if (userToReset.status !== 'active') {
            return res.status(403).json({ message: 'Account is not active. Cannot reset password.' });
        }

        // ✅ FIX: Block Google-only accounts from setting a password
        if (userToReset.authProvider !== 'email') {
            return res.status(400).json({ message: 'This account uses Google login. No password to reset.' });
        }

        userToReset.password = newPassword;
        await userToReset.save();

        // Revoke all sessions after password change
        await Session.deleteMany({ user: decoded.userId });

        const forwarded = req.headers['x-forwarded-for'];
        const ip = forwarded ? forwarded.split(',')[0].trim() : req.socket.remoteAddress || '';
        await logUserActivity(
            decoded.userId,
            'PASSWORD_RESET_COMPLETED',
            `User:${decoded.userId}`,
            {},
            ip,
            req.get('user-agent')
        );

        res.clearCookie('reset_session', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/api/auth/reset-password'
        });

        return res.status(200).json({
            message: 'Password reset successful. All sessions revoked. Please login again.'
        });
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Reset session expired. Request a new link.' });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Invalid reset session.' });
        }
        console.error('Reset password error:', error);
        return res.status(500).json({ message: 'Password reset failed.' });
    }
};