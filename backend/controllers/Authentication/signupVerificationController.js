import crypto from 'crypto';
import { Resend } from 'resend';

import User from '../../models/User.js';
import SignupVerification from '../../models/SignUpemailVerification.js';

const resend = new Resend(process.env.RESEND_API_KEY);

// -----------------------------------------------------------------------------
// SECURITY CONSTANTS
// -----------------------------------------------------------------------------

// Maximum time allowed to use the email verification link.
const SIGNUP_VERIFICATION_EXPIRY_MS = 3 * 60 * 1000;

// Time allowed to complete signup after email verification succeeds.
const SIGNUP_SESSION_EXPIRY_MS = 5 * 60 * 1000;

// Generic response used for signup-start/resend operations.
//
// Do not reveal whether an email is already registered.
const SIGNUP_VERIFICATION_MESSAGE =
    'If this email can be used for a new account, a verification email has been sent.';

// Generic verification-link failure.
//
// Do not reveal whether the token was invalid, expired, or already used.
const INVALID_SIGNUP_VERIFICATION_MESSAGE =
    'This verification link is invalid or has expired. Please request a new verification link.';

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------

/**
 * Creates a cryptographically secure random token.
 *
 * 32 random bytes = 256 bits of entropy.
 *
 * The raw token is sent through the email/browser flow.
 * Only its SHA-256 hash is stored in MongoDB.
 */
const createSecureToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

/**
 * Hashes a token before storing or searching for it in MongoDB.
 *
 * SHA-256 is appropriate because the token has 256 bits
 * of cryptographically secure randomness.
 */
const hashToken = (token) => {
    return crypto
        .createHash('sha256')
        .update(token, 'utf8')
        .digest('hex');
};

/**
 * Normalizes an email address consistently before database operations.
 */
const normalizeEmail = (email) => {
    return email.toLowerCase().trim();
};

/**
 * Sends the signup verification email through Resend.
 *
 * The raw verification token exists only in memory during this request.
 * It is never stored in MongoDB or written to application logs.
 */
const sendSignupVerificationEmail = async ({
    email,
    token,
}) => {
    const verificationUrl =
        `${process.env.FRONTEND_URL}/signup/verify-email?token=${encodeURIComponent(token)}`;

    const { data, error } = await resend.emails.send({
        from:
            process.env.EMAIL_FROM ||
            'onboarding@resend.dev',

        to: email,

        subject: 'Verify your FileTools email',

        html: `
            <div>
                <h2>Verify your email</h2>

                <p>Hello,</p>

                <p>
                    We received a request to create a FileTools account
                    using this email address.
                </p>

                <p>
                    Please verify your email address by clicking the button below.
                </p>

                <p>
                    <a
                        href="${verificationUrl}"
                        style="
                            display:inline-block;
                            padding:10px 16px;
                            background:#2563eb;
                            color:#ffffff;
                            text-decoration:none;
                            border-radius:8px;
                        "
                    >
                        Verify Email
                    </a>
                </p>

                <p>
                    This verification link expires in
                    <strong>3 minutes</strong>
                    and can only be used once.
                </p>

                <p>
                    If you did not request this account,
                    you can safely ignore this email.
                </p>
            </div>
        `,
    });

    if (error) {
        throw new Error(
            `Signup verification email failed: ${error.message || 'Unknown Resend error'}`
        );
    }

    return data;
};

// -----------------------------------------------------------------------------
// START SIGNUP VERIFICATION
// -----------------------------------------------------------------------------

/**
 * Starts the email-verification stage of signup.
 *
 * This endpoint DOES NOT create a User.
 *
 * Flow:
 *
 * 1. Normalize email.
 * 2. Check whether a User already exists.
 * 3. Invalidate previous unfinished verification attempts.
 * 4. Generate a 256-bit random verification token.
 * 5. Store only its SHA-256 hash.
 * 6. Give the token a 3-minute lifetime.
 * 7. Send the raw token through the verification email.
 */
export const startSignupVerification = async (req, res) => {
    const { email } = req.body;

    try {
        if (!email || typeof email !== 'string') {
            return res.status(400).json({
                message: 'Email is required.',
            });
        }

        const normalizedEmail = normalizeEmail(email);

        // ---------------------------------------------------------------------
        // EXISTING USER CHECK
        // ---------------------------------------------------------------------

        const existingUser = await User.findOne({
            email: normalizedEmail,
        }).select('_id');

        if (existingUser) {
            return res.status(200).json({
                message: SIGNUP_VERIFICATION_MESSAGE,
            });
        }

        // ---------------------------------------------------------------------
        // INVALIDATE PREVIOUS VERIFICATION ATTEMPTS
        // ---------------------------------------------------------------------

        await SignupVerification.deleteMany({
            email: normalizedEmail,
            usedAt: null,
        });

        // ---------------------------------------------------------------------
        // GENERATE VERIFICATION TOKEN
        // ---------------------------------------------------------------------

        const rawToken = createSecureToken();
        const tokenHash = hashToken(rawToken);

        const expiresAt = new Date(
            Date.now() + SIGNUP_VERIFICATION_EXPIRY_MS
        );

        const verification = await SignupVerification.create({
            email: normalizedEmail,
            tokenHash,
            expiresAt,
        });

        try {
            // -----------------------------------------------------------------
            // SEND EMAIL
            // -----------------------------------------------------------------

            await sendSignupVerificationEmail({
                email: normalizedEmail,
                token: rawToken,
            });
        } catch (emailError) {
            // -----------------------------------------------------------------
            // EMAIL FAILURE CLEANUP
            // -----------------------------------------------------------------

            await SignupVerification.deleteOne({
                _id: verification._id,
            });

            throw emailError;
        }

        return res.status(200).json({
            message: SIGNUP_VERIFICATION_MESSAGE,
        });
    } catch (error) {
        console.error(
            'Signup verification start error:',
            error.message
        );

        return res.status(500).json({
            message: 'Unable to start email verification.',
        });
    }
};

// -----------------------------------------------------------------------------
// VERIFY SIGNUP EMAIL
// -----------------------------------------------------------------------------

/**
 * Verifies the email verification link.
 *
 * The verification token is consumed immediately when this succeeds.
 *
 * After successful verification, a separate 5-minute signup session
 * is created.
 *
 * This endpoint does NOT create the User.
 */
export const verifySignupEmail = async (req, res) => {
    const { token } = req.body;

    try {
        if (!token || typeof token !== 'string') {
            return res.status(400).json({
                message: INVALID_SIGNUP_VERIFICATION_MESSAGE,
            });
        }

        const tokenHash = hashToken(token);
        const now = new Date();

        // ---------------------------------------------------------------------
        // CREATE SIGNUP SESSION TOKEN
        // ---------------------------------------------------------------------

        const rawSignupSession = createSecureToken();
        const signupSessionHash = hashToken(rawSignupSession);

        const signupSessionExpiresAt = new Date(
            Date.now() + SIGNUP_SESSION_EXPIRY_MS
        );

        // ---------------------------------------------------------------------
        // ATOMIC VERIFICATION + SESSION CREATION
        // ---------------------------------------------------------------------

        const verification = await SignupVerification.findOneAndUpdate(
            {
                tokenHash,
                usedAt: null,
                verifiedAt: null,
                expiresAt: { $gt: now },
            },
            {
                $set: {
                    verifiedAt: now,
                    signupSessionHash,
                    signupSessionExpiresAt,

                    // Move the MongoDB TTL deadline from the
                    // original 3-minute verification deadline to
                    // the new 5-minute signup-session deadline.
                    expiresAt: signupSessionExpiresAt,
                },
            },
            {
                new: true,
            }
        );

        if (!verification) {
            return res.status(400).json({
                message: INVALID_SIGNUP_VERIFICATION_MESSAGE,
            });
        }

        // ---------------------------------------------------------------------
        // CREATE HTTP-ONLY SIGNUP SESSION COOKIE
        // ---------------------------------------------------------------------

        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite:
                process.env.NODE_ENV === 'production'
                    ? 'none'
                    : 'lax',
            maxAge: SIGNUP_SESSION_EXPIRY_MS,
            path: '/',
        };

        res.cookie(
            'signup_session',
            rawSignupSession,
            cookieOptions
        );

        return res.status(200).json({
            message: 'Email verified successfully.',
        });
    } catch (error) {
        console.error(
            'Signup email verification error:',
            error.message
        );

        return res.status(500).json({
            message: 'Unable to verify email.',
        });
    }
};

// -----------------------------------------------------------------------------
// RESEND SIGNUP VERIFICATION
// -----------------------------------------------------------------------------

/**
 * Invalidates the previous signup verification and sends a new link.
 */
export const resendSignupVerification = async (req, res) => {
    const { email } = req.body;

    try {
        if (!email || typeof email !== 'string') {
            return res.status(400).json({
                message: 'Email is required.',
            });
        }

        const normalizedEmail = normalizeEmail(email);

        // ---------------------------------------------------------------------
        // EXISTING USER CHECK
        // ---------------------------------------------------------------------

        const existingUser = await User.findOne({
            email: normalizedEmail,
        }).select('_id');

        if (existingUser) {
            return res.status(200).json({
                message: SIGNUP_VERIFICATION_MESSAGE,
            });
        }

        // ---------------------------------------------------------------------
        // INVALIDATE PREVIOUS VERIFICATION
        // ---------------------------------------------------------------------

        await SignupVerification.deleteMany({
            email: normalizedEmail,
            usedAt: null,
        });

        // ---------------------------------------------------------------------
        // CREATE NEW VERIFICATION TOKEN
        // ---------------------------------------------------------------------

        const rawToken = createSecureToken();
        const tokenHash = hashToken(rawToken);

        const expiresAt = new Date(
            Date.now() + SIGNUP_VERIFICATION_EXPIRY_MS
        );

        const verification = await SignupVerification.create({
            email: normalizedEmail,
            tokenHash,
            expiresAt,
        });

        try {
            await sendSignupVerificationEmail({
                email: normalizedEmail,
                token: rawToken,
            });
        } catch (emailError) {
            await SignupVerification.deleteOne({
                _id: verification._id,
            });

            throw emailError;
        }

        return res.status(200).json({
            message: SIGNUP_VERIFICATION_MESSAGE,
        });
    } catch (error) {
        console.error(
            'Signup verification resend error:',
            error.message
        );

        return res.status(500).json({
            message: 'Unable to resend verification email.',
        });
    }
};