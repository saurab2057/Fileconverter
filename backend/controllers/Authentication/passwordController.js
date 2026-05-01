import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../../models/User.js';
import Session from '../../models/Session.js';
import { Resend } from 'resend';
import { logUserActivity } from '../../middleware/auditLogger.js';


/**
 * 🔒 FORGOT PASSWORD: Sends reset link (token in URL - frontend will exchange)
 */
export const forgotPassword = async (req, res) => {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const resetPasswordSecret = process.env.RESET_PASSWORD_SECRET_KEY;

    const { email } = req.body;
    try {
        const user = await User.findOne({ email });
        if (user) {
            const resetToken = jwt.sign(
                { user: { id: user.id } },
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

            const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
            await logUserActivity(
                user._id,
                'PASSWORD_RESET_REQUESTED',
                `User:${user._id}`,
                {},
                ip,
                req.get('user-agent')
            );
        }
        return res.status(200).json({
            message: 'Please check your registered email for the password reset link. If you do not receive an email, please check your spam folder or try again.'
        });
    } catch (error) {
        console.error('Forgot Password Error:', error);
        return res.status(500).json({ message: 'Server error during password reset process.' });
    }
};

/**
 * 🔒 VALIDATE RESET TOKEN
 */
export const validateResetToken = async (req, res) => {
    const resetPasswordSecret = process.env.RESET_PASSWORD_SECRET_KEY;
    const resetSessionSecret = process.env.COOKIE_SECRET_KEY;

    const { token } = req.body;
    if (!token) {
        return res.status(400).json({ message: 'Reset token required.' });
    }

    try {
        const decoded = jwt.verify(token, resetPasswordSecret);

        const resetSession = jwt.sign(
            {
                userId: decoded.user.id,
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

/**
 * 🔒 RESET PASSWORD
 */
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
        userToReset.password = newPassword;
        await userToReset.save();

        await Session.deleteMany({ user: decoded.userId });

        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
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