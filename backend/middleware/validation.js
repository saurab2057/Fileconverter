import { body, validationResult } from 'express-validator';
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
// Prevents invalid values (e.g., negative file size) that could
// break file conversion or system stability.
// ─────────────────────────────────────────────────────────────
export const validateConfigUpdate = [
    body('maxFileSize')
        .optional()
        .isInt({ min: 1, max: 500 })
        .withMessage('Max file size must be 1-500 MB'),
    body('conversionLimit')
        .optional()
        .isInt({ min: 1, max: 1000 })
        .withMessage('Conversion limit must be 1-1000'),
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