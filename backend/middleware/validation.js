// bacekend/middleware/validation.js
import { body, query, validationResult } from 'express-validator';

// ─────────────────────────────────────────────────────────────
// INPUT VALIDATION: USER UPDATE (admin only)
// Prevents privilege escalation by blocking role/status fields
// from being updated through non-admin routes.
// ─────────────────────────────────────────────────────────────
export const validateUserUpdate = [
    body('status')
        .optional()
        .isIn(['active', 'banned'])
        .withMessage('Status must be active or banned'),

    body('role')
        .optional()
        .isIn(['user', 'admin'])
        .withMessage('Role must be user or admin'),

    (req, res, next) => {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return res.status(400).json({
                errors: errors.array()
            });
        }

        next();
    }
];


// ─────────────────────────────────────────────────────────────
// INPUT VALIDATION: CONFIG UPDATE (system settings)
//
// Validates the actual configuration schema fields with
// appropriate bounds to ensure data integrity and proper
// user feedback.
// ─────────────────────────────────────────────────────────────
export const validateConfigUpdate = [
    body('freeUserMaxFileSize')
        .optional()
        .isInt({ min: 1, max: 500 })
        .withMessage('Free user max file size must be 1-500 MB'),

    body('proUserMaxFileSize')
        .optional()
        .isInt({ min: 1, max: 2000 })
        .withMessage('Pro user max file size must be 1-2000 MB'),

    body('maxJobsPerHour')
        .optional()
        .isInt({ min: 1, max: 1000 })
        .withMessage('Max jobs per hour must be 1-1000'),

    body('maxProcessingTime')
        .optional()
        .isInt({ min: 10, max: 3600 })
        .withMessage('Max processing time must be 10-3600 seconds'),

    body('maxConcurrentJobs')
        .optional()
        .isInt({ min: 1, max: 50 })
        .withMessage('Max concurrent jobs must be 1-50'),

    body('cleanupInterval')
        .optional()
        .isInt({ min: 1, max: 168 })
        .withMessage('Cleanup interval must be 1-168 hours'),

    body('logRetentionDays')
        .optional()
        .isInt({ min: 1, max: 365 })
        .withMessage('Log retention must be 1-365 days'),

    body('enableRateLimit')
        .optional()
        .isBoolean()
        .withMessage('enableRateLimit must be true/false'),

    body('maxRequestsPerMinute')
        .optional()
        .isInt({ min: 1, max: 1000 })
        .withMessage('Max requests per minute must be 1-1000'),

    body('enableFileTypeValidation')
        .optional()
        .isBoolean()
        .withMessage('enableFileTypeValidation must be true/false'),

    body('allowedFileTypes')
        .optional()
        .isString()
        .withMessage('allowedFileTypes must be a comma-separated string'),

    body('enableEmailNotifications')
        .optional()
        .isBoolean()
        .withMessage('enableEmailNotifications must be true/false'),

    body('enableSlackAlerts')
        .optional()
        .isBoolean()
        .withMessage('enableSlackAlerts must be true/false'),

    body('alertThreshold')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Alert threshold must be 1-100%'),

    body('tempFileRetention')
        .optional()
        .isInt({ min: 1, max: 72 })
        .withMessage('Temp file retention must be 1-72 hours'),

    body('maxStorageGB')
        .optional()
        .isInt({ min: 1, max: 10000 })
        .withMessage('Max storage must be 1-10000 GB'),

    body('enableAutoBackup')
        .optional()
        .isBoolean()
        .withMessage('enableAutoBackup must be true/false'),

    (req, res, next) => {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return res.status(400).json({
                errors: errors.array()
            });
        }

        next();
    }
];


// ─────────────────────────────────────────────────────────────
// HELPER: CENTRALISED VALIDATION ERROR HANDLER
// Used after validation rules to return 400 with error details.
// ─────────────────────────────────────────────────────────────
export const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({
            errors: errors.array()
        });
    }

    next();
};


// ─────────────────────────────────────────────────────────────
// VALIDATION: SIGNUP (legacy/full signup validation)
//
// NOTE:
// The new signup flow does NOT use this validator for the initial
// email-verification step.
//
// New flow:
//   /signup/start        → signupStartValidation
//   /signup/verify-email → signupVerificationTokenValidation
//   /signup/complete     → future signupCompleteValidation
//
// Keep this validator for now until the old signup route/controller
// is removed from auth routes.
// ─────────────────────────────────────────────────────────────
export const signupValidation = [
    body('email')
        .isEmail()
        .normalizeEmail(),

    body('password')
        .isStrongPassword({
            minLength: 8,
            minLowercase: 1,
            minUppercase: 1,
            minNumbers: 1,
            minSymbols: 1
        }),

    body('confirmPassword')
        .custom((v, { req }) => {
            if (v !== req.body.password) {
                throw new Error('Passwords do not match');
            }

            return true;
        }),

    body('name')
        .trim()
        .escape()
        .notEmpty()
];


// ─────────────────────────────────────────────────────────────
// VALIDATION: SIGNUP EMAIL VERIFICATION START
//
// First step of the new signup flow.
//
// The user provides only an email address.
// This endpoint does NOT create a User.
// ─────────────────────────────────────────────────────────────
export const signupStartValidation = [
    body('email')
        .isEmail()
        .withMessage('Please provide a valid email address.')
        .normalizeEmail()
        .trim()
];


// ─────────────────────────────────────────────────────────────
// VALIDATION: SIGNUP EMAIL VERIFICATION TOKEN
//
// Validates the token received from the verification email.
//
// The controller performs the actual cryptographic hash lookup
// and atomic token consumption.
//
// Tokens are generated with:
//
//   crypto.randomBytes(32).toString('hex')
//
// Therefore:
//   32 random bytes × 2 hex characters = 64 characters.
// ─────────────────────────────────────────────────────────────
export const signupVerificationTokenValidation = [
    body('token')
        .isString()
        .withMessage('Verification token must be a string.')
        .trim()
        .isLength({
            min: 64,
            max: 64
        })
        .withMessage('Invalid verification token.')
        .matches(/^[a-fA-F0-9]+$/)
        .withMessage('Invalid verification token.')
];


// ─────────────────────────────────────────────────────────────
// VALIDATION: COMPLETE EMAIL SIGNUP
//
// Final signup step after successful email verification.
//
// Email is deliberately NOT accepted from the frontend.
// The backend obtains the verified email from the signup_session
// httpOnly cookie.
// ─────────────────────────────────────────────────────────────
export const signupCompleteValidation = [
    body('name')
        .isString()
        .withMessage('Name must be a string.')
        .trim()
        .escape()
        .isLength({
            min: 1,
            max: 100
        })
        .withMessage('Name must be between 1 and 100 characters.'),

    body('password')
        .isStrongPassword({
            minLength: 8,
            minLowercase: 1,
            minUppercase: 1,
            minNumbers: 1,
            minSymbols: 1
        })
        .withMessage(
            'Password must be at least 8 characters and contain at least one lowercase letter, uppercase letter, number, and symbol.'
        ),

    body('confirmPassword')
        .custom((value, { req }) => {
            if (value !== req.body.password) {
                throw new Error('Passwords do not match.');
            }

            return true;
        }),

    body('termsAccepted')
        .isBoolean()
        .withMessage('Terms acceptance is required.')
        .custom((value) => {
            if (value !== true) {
                throw new Error(
                    'You must accept the terms and conditions.'
                );
            }

            return true;
        })
];

// ─────────────────────────────────────────────────────────────
// VALIDATION: LOGIN
//
// Basic email format and non-empty password.
// Email is trimmed and normalised to avoid case/space issues.
//
// Password strength is NOT checked here because login should
// not reject passwords based on the current signup policy.
// This also avoids unnecessary information leakage.
// ─────────────────────────────────────────────────────────────
export const loginValidation = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .trim(),

    body('password')
        .notEmpty()
];


// ─────────────────────────────────────────────────────────────
// VALIDATION: FORGOT PASSWORD
//
// Only validates email format.
//
// If the email exists, a reset link is sent.
// If it does not exist, a generic response is returned.
// ─────────────────────────────────────────────────────────────
export const forgotPasswordValidation = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .trim()
];


// ─────────────────────────────────────────────────────────────
// VALIDATION: RESET TOKEN VALIDATION
//
// Ensures the reset token string is present before the
// password-reset controller attempts to hash and consume it.
// ─────────────────────────────────────────────────────────────
export const tokenValidation = [
    body('token')
        .notEmpty()
];


// ─────────────────────────────────────────────────────────────
// VALIDATION: NEW PASSWORD (password reset)
//
// Enforces the strong password policy on the new password.
// ─────────────────────────────────────────────────────────────
export const newPasswordValidation = [
    body('newPassword')
        .isStrongPassword({
            minLength: 8,
            minLowercase: 1,
            minUppercase: 1,
            minNumbers: 1,
            minSymbols: 1
        }),

    handleValidationErrors
];


// ─────────────────────────────────────────────────────────────
// VALIDATION: CHANGE PASSWORD (authenticated user)
//
// Matches the UI fields:
//   currentPassword
//   newPassword
//   confirmNewPassword
//
// Used in POST /api/user/change-password.
// ─────────────────────────────────────────────────────────────
export const changePasswordValidation = [
    body('currentPassword')
        .notEmpty()
        .withMessage('Current password required'),

    body('newPassword')
        .isStrongPassword({
            minLength: 8,
            minLowercase: 1,
            minUppercase: 1,
            minNumbers: 1,
            minSymbols: 1
        })
        .withMessage(
            'New password must be at least 8 chars with 1 lowercase, 1 uppercase, 1 number, 1 symbol'
        ),

    body('confirmNewPassword')
        .custom((value, { req }) => {
            if (value !== req.body.newPassword) {
                throw new Error('Passwords do not match');
            }

            return true;
        }),

    handleValidationErrors
];


// ─────────────────────────────────────────────────────────────
// VALIDATION: PASSKEY LABEL UPDATE
//
// Ensures label is 1-50 characters and trimmed.
//
// Used in PUT /api/auth/passkeys/:passkeyId/label.
// ─────────────────────────────────────────────────────────────
export const passkeyLabelValidation = [
    body('label')
        .trim()
        .isLength({
            min: 1,
            max: 50
        })
        .withMessage('Label must be 1-50 characters'),

    handleValidationErrors
];


// ─────────────────────────────────────────────────────────────
// VALIDATION: GOOGLE OAUTH CALLBACK
//
// 'code' and 'error' are optional — Google sends exactly one of
// them depending on whether the user consented or cancelled.
//
// 'state' is required — it's the CSRF token issued in
// googleAuthInit and must come back on every real callback.
//
// The controller performs the actual state comparison against
// the cookie; this only validates/sanitises the query fields.
// ─────────────────────────────────────────────────────────────
export const googleCallbackValidation = [
    query('code')
        .optional()
        .trim()
        .isLength({
            max: 2048
        }),

    query('error')
        .optional()
        .trim()
        .isLength({
            max: 256
        }),

    query('state')
        .notEmpty()
        .trim()
        .isLength({
            min: 1,
            max: 128
        }),

    (req, res, next) => {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            // Malformed query string — treat like any other Google
            // authentication failure rather than exposing raw validation
            // details to the browser.
            return res.redirect(
                `${process.env.FRONTEND_URL}/login?error=google_auth_failed`
            );
        }

        next();
    }
];
