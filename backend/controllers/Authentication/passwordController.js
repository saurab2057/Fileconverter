import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../../models/User.js';
import Session from '../../models/Session.js';
import PasswordResetToken from '../../models/PasswordResetToken.js';
import { Resend } from 'resend';
import { logUserActivity } from '../../middleware/auditLogger.js';
import { getClientIp } from '../../utils/clientIp.js';

const resend = new Resend(process.env.RESEND_API_KEY);

// -----------------------------------------------------------------------------
// SECURITY CONSTANTS
// -----------------------------------------------------------------------------

// The reset flow has one absolute 3-minute lifetime.
//
// IMPORTANT:
// We do NOT give the reset session another fresh 3 minutes after token exchange.
//
// Example:
//   Link generated:       10:00:00
//   User opens link:      10:02:20
//   Remaining lifetime:   40 seconds
//   Reset session expiry: 10:03:00
//
// This prevents extending the reset window by repeatedly exchanging the link.
const RESET_TOKEN_LIFETIME_MS = 3 * 60 * 1000;

// Generic message used when a reset token cannot be used.
// Do not reveal whether the token was expired, already used, invalid, etc.
const INVALID_RESET_TOKEN_MESSAGE =
    'This reset link is invalid or has expired. Please request a new password reset link.';

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------

/**
 * Creates a cryptographically secure random password-reset token.
 *
 * 32 random bytes = 256 bits of entropy.
 *
 * The raw token is sent through HTTPS/email.
 * Only its SHA-256 hash is stored in MongoDB.
 */
const generateResetToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

/**
 * Hashes the reset token before database storage/lookup.
 *
 * SHA-256 is appropriate here because the reset token itself has
 * 256 bits of cryptographically secure randomness.
 */
const hashResetToken = (token) => {
    return crypto
        .createHash('sha256')
        .update(token, 'utf8')
        .digest('hex');
};

/**
 * Calculates the remaining lifetime of a reset session.
 *
 * Returns milliseconds remaining, or 0 if the deadline has passed.
 */
const getRemainingLifetime = (expiresAt) => {
    return Math.max(
        0,
        new Date(expiresAt).getTime() - Date.now()
    );
};

// -----------------------------------------------------------------------------
// FORGOT PASSWORD
// -----------------------------------------------------------------------------

export const forgotPassword = async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });

        if (
            user &&
            user.status === 'active' &&
            user.authProvider === 'email'
        ) {
            // -----------------------------------------------------------------
            // INVALIDATE PREVIOUS RESET LINKS
            // -----------------------------------------------------------------
            //
            // If the user requests another reset link, previous unused links
            // should no longer be usable.
            //
            // This gives the user one active reset flow at a time.
            await PasswordResetToken.updateMany(
                {
                    user: user._id,
                    usedAt: null,
                },
                {
                    $set: {
                        usedAt: new Date(),
                    },
                }
            );

            // -----------------------------------------------------------------
            // GENERATE NEW RANDOM RESET TOKEN
            // -----------------------------------------------------------------

            const rawResetToken = generateResetToken();
            const tokenHash = hashResetToken(rawResetToken);

            const expiresAt = new Date(
                Date.now() + RESET_TOKEN_LIFETIME_MS
            );

            await PasswordResetToken.create({
                user: user._id,
                tokenHash,
                expiresAt,
            });

            // The raw token is sent only through the reset URL.
            // It is never stored in MongoDB.
            const resetLink =
                `${process.env.FRONTEND_URL}/reset-password?token=${rawResetToken}`;

            await resend.emails.send({
                from:
                    process.env.EMAIL_FROM ||
                    'onboarding@resend.dev',
                to: user.email,
                subject: 'Your Password Reset Link',
                html: `
                    <p>Hello ${user.name || 'User'},</p>

                    <p>
                        We received a request to reset your password.
                    </p>

                    <p>
                        <a
                            href="${resetLink}"
                            style="
                                display:inline-block;
                                padding:10px 16px;
                                background:#2563eb;
                                color:#ffffff;
                                text-decoration:none;
                                border-radius:8px;
                            "
                        >
                            Reset Password
                        </a>
                    </p>

                    <p>
                        This password reset link expires in
                        <strong>3 minutes</strong> and can only be used once.
                    </p>

                    <p>
                        If you did not request a password reset,
                        you can safely ignore this email.
                    </p>
                `,
            });

            const ip = getClientIp(req);

            await logUserActivity(
                user._id,
                'PASSWORD_RESET_REQUESTED',
                `User:${user._id}`,
                {},
                ip,
                req.get('user-agent')
            );
        }

        // ---------------------------------------------------------------------
        // ACCOUNT ENUMERATION PROTECTION
        // ---------------------------------------------------------------------
        //
        // Always return the same successful response regardless of whether
        // the email exists.
        return res.status(200).json({
            message:
                'If an active email account exists, you will receive a reset link. Please check your spam folder.',
        });
    } catch (error) {
        console.error('Forgot Password Error:', error);

        return res.status(500).json({
            message:
                'Server error during password reset process.',
        });
    }
};

// -----------------------------------------------------------------------------
// VALIDATE / EXCHANGE RESET TOKEN
// -----------------------------------------------------------------------------

export const validateResetToken = async (req, res) => {
    const resetSessionSecret =
        process.env.COOKIE_SECRET_KEY;

    const { token } = req.body;

    if (!token || typeof token !== 'string') {
        return res.status(401).json({
            message: INVALID_RESET_TOKEN_MESSAGE,
        });
    }

    try {
        const tokenHash = hashResetToken(token);
        const now = new Date();

        // ---------------------------------------------------------------------
        // ATOMIC TOKEN CONSUMPTION
        // ---------------------------------------------------------------------
        //
        // This is the critical security operation.
        //
        // The query requires:
        //   - matching token hash
        //   - token has never been used
        //   - token has not expired
        //
        // MongoDB performs the update atomically.
        //
        // Therefore two simultaneous requests cannot both successfully
        // exchange the same reset token.
        const resetToken = await PasswordResetToken.findOneAndUpdate(
            {
                tokenHash,
                usedAt: null,
                expiresAt: { $gt: now },
            },
            {
                $set: {
                    usedAt: now,
                },
            },
            {
                new: true,
            }
        );

        if (!resetToken) {
            return res.status(401).json({
                message: INVALID_RESET_TOKEN_MESSAGE,
            });
        }

        // ---------------------------------------------------------------------
        // CHECK REMAINING ABSOLUTE LIFETIME
        // ---------------------------------------------------------------------

        const remainingLifetime =
            getRemainingLifetime(resetToken.expiresAt);

        if (remainingLifetime <= 0) {
            return res.status(401).json({
                message: INVALID_RESET_TOKEN_MESSAGE,
            });
        }

        // ---------------------------------------------------------------------
        // CREATE RESTRICTED RESET SESSION
        // ---------------------------------------------------------------------
        //
        // The reset session expires at the SAME absolute deadline as the
        // original email token.
        //
        // It does NOT receive a fresh 3-minute lifetime.
        const resetSession = jwt.sign(
            {
                userId: resetToken.user.toString(),
                purpose: 'password_reset',
                jti: crypto.randomUUID(),
            },
            resetSessionSecret,
            {
                expiresIn: Math.max(
                    1,
                    Math.ceil(remainingLifetime / 1000)
                ),
            }
        );

        res.cookie('reset_session', resetSession, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',

            // Cookie lifetime cannot extend beyond the reset deadline.
            maxAge: remainingLifetime,

            path: '/api/auth/reset-password',
        });

        return res.json({
            valid: true,
            redirectUrl: '/reset-password-form',
            expiresAt: resetToken.expiresAt,
        });
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                message: INVALID_RESET_TOKEN_MESSAGE,
            });
        }

        console.error(
            'Token validation error:',
            error
        );

        return res.status(500).json({
            message: 'Validation failed.',
        });
    }
};

// -----------------------------------------------------------------------------
// RESET PASSWORD
// -----------------------------------------------------------------------------

export const resetPassword = async (req, res) => {
    const resetSessionSecret =
        process.env.COOKIE_SECRET_KEY;

    const resetSession =
        req.cookies.reset_session;

    if (!resetSession) {
        return res.status(401).json({
            message:
                'Reset session expired. Please request a new reset link.',
        });
    }

    const { newPassword } = req.body;

    if (!newPassword) {
        return res.status(400).json({
            message: 'New password required.',
        });
    }

    try {
        // ---------------------------------------------------------------------
        // VERIFY RESET SESSION
        // ---------------------------------------------------------------------

        const decoded = jwt.verify(
            resetSession,
            resetSessionSecret
        );

        if (
            decoded.purpose !== 'password_reset' ||
            !decoded.userId ||
            !decoded.jti
        ) {
            return res.status(401).json({
                message: 'Invalid reset session.',
            });
        }

        // ---------------------------------------------------------------------
        // FIND USER
        // ---------------------------------------------------------------------

        const userToReset =
            await User.findById(decoded.userId)
                .select('+password');

        if (!userToReset) {
            return res.status(401).json({
                message:
                    'Reset session is no longer valid.',
            });
        }

        if (userToReset.status !== 'active') {
            return res.status(403).json({
                message:
                    'Account is not active. Cannot reset password.',
            });
        }

        if (userToReset.authProvider !== 'email') {
            return res.status(400).json({
                message:
                    'This account uses Google login. No password to reset.',
            });
        }

        // ---------------------------------------------------------------------
        // CHANGE PASSWORD
        // ---------------------------------------------------------------------

        userToReset.password = newPassword;
        await userToReset.save();

        // ---------------------------------------------------------------------
        // REVOKE ALL NORMAL SESSIONS
        // ---------------------------------------------------------------------
        //
        // If an attacker previously obtained a valid login session, resetting
        // the password must invalidate that session as well.
        await Session.deleteMany({
            user: decoded.userId,
        });

        // ---------------------------------------------------------------------
        // AUDIT
        // ---------------------------------------------------------------------

        const ip = getClientIp(req);

        await logUserActivity(
            decoded.userId,
            'PASSWORD_RESET_COMPLETED',
            `User:${decoded.userId}`,
            {},
            ip,
            req.get('user-agent')
        );

        // ---------------------------------------------------------------------
        // DESTROY RESET SESSION
        // ---------------------------------------------------------------------

        res.clearCookie('reset_session', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/api/auth/reset-password',
        });

        return res.status(200).json({
            message:
                'Password reset successful. All sessions revoked. Please login again.',
        });
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                message:
                    'Reset session expired. Please request a new reset link.',
            });
        }

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                message: 'Invalid reset session.',
            });
        }

        console.error(
            'Reset password error:',
            error
        );

        return res.status(500).json({
            message: 'Password reset failed.',
        });
    }
};