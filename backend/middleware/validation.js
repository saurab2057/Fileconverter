import { body, query, validationResult } from 'express-validator';
import User from '../models/User.js';


// ─────────────────────────────────────────────────────────────
// INPUT VALIDATION: USER UPDATE (admin only)
// Prevents privilege escalation by blocking role/status fields
// from being updated through non‑admin routes.
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
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }
];


// ─────────────────────────────────────────────────────────────
// INPUT VALIDATION: CONFIG UPDATE (system settings)
// 
//    🔥 WHY THIS MATTERS:
//      Without this correction, an admin could submit a request with
//      `maxFileSize` and the validation would pass, but the update would
//      silently fail (since Mongoose would ignore unknown fields) – giving
//      the admin a false sense that the config was updated.
//      Worse, they might think their changes applied, but they didn't.
//
//    ✅ The fix below validates the actual schema fields with
//       appropriate bounds to ensure data integrity and proper user feedback.
//       Some are for future reference
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
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }
];


// ─────────────────────────────────────────────────────────────
// HELPER: Centralised validation error handler
// Used after validation rules to return 400 with error details.
// ─────────────────────────────────────────────────────────────
export const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

// ─────────────────────────────────────────────────────────────
// VALIDATION: SIGNUP
// Ensures email format, strong password, password confirmation match,
// and name is trimmed + escaped (prevents XSS in display names).
// ─────────────────────────────────────────────────────────────
export const signupValidation = [
    body('email').isEmail().normalizeEmail(),
    body('password').isStrongPassword({ 
        minLength: 8, 
        minLowercase: 1, 
        minUppercase: 1, 
        minNumbers: 1, 
        minSymbols: 1 
    }),
    body('confirmPassword').custom((v, { req }) => {
        if (v !== req.body.password) throw new Error('Passwords do not match');
        return true;
    }),
    body('name').trim().escape().notEmpty()
];

// ─────────────────────────────────────────────────────────────
// VALIDATION: LOGIN
// Basic email format and non‑empty password.
// Email is trimmed and normalised to avoid case/space issues.
// Password strength is NOT checked here (avoids user enumeration).
// ─────────────────────────────────────────────────────────────
export const loginValidation = [
    body('email').isEmail().normalizeEmail().trim(),
    body('password').notEmpty()
];

// ─────────────────────────────────────────────────────────────
// VALIDATION: FORGOT PASSWORD
// Only validates email format. If email exists, a reset link is sent;
// if not, a generic message is returned (security by obscurity).
// ─────────────────────────────────────────────────────────────
export const forgotPasswordValidation = [
    body('email').isEmail().normalizeEmail().trim()
];

// ─────────────────────────────────────────────────────────────
// VALIDATION: RESET TOKEN VALIDATION
// Ensures the token string is present before attempting to verify it.
// ─────────────────────────────────────────────────────────────
export const tokenValidation = [
    body('token').notEmpty()
];

// ─────────────────────────────────────────────────────────────
// VALIDATION: NEW PASSWORD (for password reset)
// Enforces strong password policy on the new password.
// ─────────────────────────────────────────────────────────────
export const newPasswordValidation = [
    body('newPassword').isStrongPassword({ 
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
// Matches your UI fields: currentPassword, newPassword, confirmNewPassword
// Used in POST /api/user/change-password
// ─────────────────────────────────────────────────────────────
export const changePasswordValidation = [
    body('currentPassword').notEmpty().withMessage('Current password required'),
    body('newPassword').isStrongPassword({
        minLength: 8,
        minLowercase: 1,
        minUppercase: 1,
        minNumbers: 1,
        minSymbols: 1
    }).withMessage('New password must be at least 8 chars with 1 lowercase, 1 uppercase, 1 number, 1 symbol'),
    body('confirmNewPassword').custom((value, { req }) => {
        if (value !== req.body.newPassword) {
            throw new Error('Passwords do not match');
        }
        return true;
    }),
    handleValidationErrors
];

// ─────────────────────────────────────────────────────────────
// VALIDATION: PASSKEY LABEL UPDATE
// Ensures label is 1‑50 characters and trimmed.
// Used in PUT /api/auth/passkeys/:passkeyId/label
// ─────────────────────────────────────────────────────────────
export const passkeyLabelValidation = [
    body('label').trim().isLength({ min: 1, max: 50 }).withMessage('Label must be 1-50 characters'),
    handleValidationErrors
];

// ─────────────────────────────────────────────────────────────
// VALIDATION: GOOGLE OAUTH CALLBACK
// 'code' and 'error' are optional — Google sends exactly one of
// them depending on whether the user consented or cancelled.
// 'state' is required — it's the CSRF token we issued in
// googleAuthInit and must come back on every real callback.
// The controller (googleAuthCallback) does the actual state
// comparison against the cookie; this just sanitises the field.
// ─────────────────────────────────────────────────────────────
export const googleCallbackValidation = [
    query('code').optional().trim().isLength({ max: 2048 }),
    query('error').optional().trim().isLength({ max: 256 }),
    query('state').notEmpty().trim().isLength({ min: 1, max: 128 }),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            // Malformed query string — treat like any other Google
            // auth failure rather than surfacing a raw 400 JSON error.
            return res.redirect(`${process.env.FRONTEND_URL}/login?error=google_auth_failed`);
        }
        next();
    }
];