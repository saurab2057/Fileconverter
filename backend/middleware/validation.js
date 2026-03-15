import { body, validationResult } from 'express-validator';
import User from '../models/User.js';


// 🔒 INPUT VALIDATION: USER UPDATE (PREVENTS PRIVILEGE ESCALATION)
// WHY: Blocks malicious payloads like {"role": "admin"} from non-admin users
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

// 🔒 INPUT VALIDATION: CONFIG UPDATE (PREVENTS SYSTEM INSTABILITY)
// WHY: Blocks invalid values that could break conversion system (e.g., negative file size)
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


// 🔒 HELPER: Handle validation errors
export const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

// 🔒 VALIDATION RULES: SIGNUP
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

// 🔒 VALIDATION RULES: LOGIN
export const loginValidation = [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
];

// 🔒 VALIDATION RULES: FORGOT PASSWORD
export const forgotPasswordValidation = [
    body('email').isEmail().normalizeEmail()
];

// 🔒 VALIDATION RULES: TOKEN VALIDATION
export const tokenValidation = [
    body('token').notEmpty()
];

// 🔒 VALIDATION RULES: NEW PASSWORD (RESET)
export const newPasswordValidation = [
    body('newPassword').isStrongPassword({ 
        minLength: 8, 
        minLowercase: 1, 
        minUppercase: 1, 
        minNumbers: 1, 
        minSymbols: 1 
    })
];