import express from 'express';

import {
    authLimiter,
    refreshTokenLimiter,
    resetPasswordLimiter,
} from '../middleware/rateLimiter.js';

import { authenticateToken } from '../middleware/authMiddleware.js';

import {
    signupStartValidation,
    signupVerificationTokenValidation,
    signupCompleteValidation,
    loginValidation,
    forgotPasswordValidation,
    tokenValidation,
    newPasswordValidation,
    handleValidationErrors,
    googleCallbackValidation,
} from '../middleware/validation.js';

import { verifyRecaptcha } from '../middleware/recaptchaMiddleware.js';

// Authentication controller
import {
    googleAuthInit,
    googleAuthCallback,
    completeSignup,
    login,
} from '../controllers/Authentication/authController.js';

// Signup verification controller
import {
    startSignupVerification,
    verifySignupEmail,
    resendSignupVerification,
} from '../controllers/Authentication/signupVerificationController.js';

// Password controller
import {
    forgotPassword,
    validateResetToken,
    resetPassword,
} from '../controllers/Authentication/passwordController.js';

// Session controller
import {
    refreshToken,
    logout,
    logoutAllDevices,
    getActiveSessions,
    revokeSession,
} from '../controllers/Authentication/sessionController.js';

const router = express.Router();

// Prevent caching of authentication responses.
router.use((req, res, next) => {
    res.set(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, private'
    );

    next();
});


// ─────────────────────────────────────────────────────────────
// GOOGLE OAUTH
// ─────────────────────────────────────────────────────────────

router.get(
    '/google/init',
    authLimiter,
    googleAuthInit
);

router.get(
    '/google/callback',
    authLimiter,
    ...googleCallbackValidation,
    googleAuthCallback
);


// ─────────────────────────────────────────────────────────────
// EMAIL SIGNUP — STEP 1
//
// User submits only their email address.
//
// No User document is created here.
//
// A 3-minute verification link is sent by email.
// ─────────────────────────────────────────────────────────────

router.post(
    '/signup/start',
    authLimiter,
    ...signupStartValidation,
    handleValidationErrors,
    verifyRecaptcha('signup_start'),
    startSignupVerification
);


// ─────────────────────────────────────────────────────────────
// EMAIL SIGNUP — STEP 2
//
// User submits the token received through email.
//
// Successful verification:
//   - consumes the verification token,
//   - creates a 5-minute signup session,
//   - sets signup_session as an httpOnly cookie.
//
// No User document is created yet.
// ─────────────────────────────────────────────────────────────

router.post(
    '/signup/verify-email',
    authLimiter,
    ...signupVerificationTokenValidation,
    handleValidationErrors,
    verifySignupEmail
);


// ─────────────────────────────────────────────────────────────
// EMAIL SIGNUP — STEP 3
//
// User provides:
//   - name
//   - password
//   - confirmPassword
//   - termsAccepted
//
// The email is NOT accepted from the frontend.
//
// completeSignup obtains the verified email from the
// server-side signup_session cookie.
//
// Successful completion creates the real User account.
// ─────────────────────────────────────────────────────────────

router.post(
    '/signup/complete',
    authLimiter,
    ...signupCompleteValidation,
    handleValidationErrors,
    completeSignup
);


// ─────────────────────────────────────────────────────────────
// EMAIL SIGNUP — RESEND VERIFICATION
//
// Generates a new 3-minute verification link.
//
// The previous unfinished verification flow is invalidated.
//
// authLimiter is currently used here.
// ─────────────────────────────────────────────────────────────

router.post(
    '/signup/resend-verification',
    authLimiter,
    ...signupStartValidation,
    handleValidationErrors,
    verifyRecaptcha('signup_resend'),
    resendSignupVerification
);


// ─────────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────────

router.post(
    '/login',
    authLimiter,
    ...loginValidation,
    handleValidationErrors,
    verifyRecaptcha('login'),
    login
);


// ─────────────────────────────────────────────────────────────
// PASSWORD RESET — REQUEST
// ─────────────────────────────────────────────────────────────

router.post(
    '/forgot-password',
    authLimiter,
    ...forgotPasswordValidation,
    handleValidationErrors,
    verifyRecaptcha('forgot_password'),
    forgotPassword
);


// ─────────────────────────────────────────────────────────────
// PASSWORD RESET — FINAL PASSWORD CHANGE
// ─────────────────────────────────────────────────────────────

router.post(
    '/reset-password',
    resetPasswordLimiter,
    ...newPasswordValidation,
    handleValidationErrors,
    resetPassword
);


// ─────────────────────────────────────────────────────────────
// PASSWORD RESET — TOKEN VALIDATION
// ─────────────────────────────────────────────────────────────

router.post(
    '/validate-reset-token',
    authLimiter,
    ...tokenValidation,
    handleValidationErrors,
    validateResetToken
);


// ─────────────────────────────────────────────────────────────
// REFRESH TOKEN
// ─────────────────────────────────────────────────────────────

router.post(
    '/refresh-token',
    refreshTokenLimiter,
    refreshToken
);


// ─────────────────────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────────────────────

router.post(
    '/logout',
    logout
);


// ─────────────────────────────────────────────────────────────
// SESSION MANAGEMENT
// ─────────────────────────────────────────────────────────────

router.post(
    '/logout-all',
    authenticateToken,
    logoutAllDevices
);

router.get(
    '/sessions',
    authenticateToken,
    getActiveSessions
);

router.delete(
    '/sessions/:sessionId',
    authenticateToken,
    revokeSession
);


export default router;