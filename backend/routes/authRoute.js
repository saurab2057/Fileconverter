import express from 'express';
import { authLimiter, refreshTokenLimiter, resetPasswordLimiter } from '../middleware/rateLimiter.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import {
    signupValidation,
    loginValidation,
    forgotPasswordValidation,
    tokenValidation,
    newPasswordValidation,
    handleValidationErrors,
    googleCallbackValidation,
} from '../middleware/validation.js';
import { verifyRecaptcha } from '../middleware/recaptchaMiddleware.js';

// ✅ Import from all three controllers
import { googleAuthInit, googleAuthCallback, signup, login } from '../controllers/Authentication/authController.js';
import { forgotPassword, validateResetToken, resetPassword } from '../controllers/Authentication/passwordController.js';
import { refreshToken, logout, logoutAllDevices, getActiveSessions, revokeSession } from '../controllers/Authentication/sessionController.js';

const router = express.Router();

// Prevent caching of auth responses
router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    next();
});

// 🔒 ROUTE DEFINITIONS
router.get('/google/init', authLimiter, googleAuthInit);
router.get('/google/callback', authLimiter, ...googleCallbackValidation, googleAuthCallback);
router.post('/signup', authLimiter, ...signupValidation, handleValidationErrors, verifyRecaptcha('signup'), signup);
router.post('/login', authLimiter, ...loginValidation, handleValidationErrors, verifyRecaptcha('login'), login);
router.post('/forgot-password', authLimiter, ...forgotPasswordValidation, handleValidationErrors, verifyRecaptcha('forgot_password'), forgotPassword);

// 🔒 No reCAPTCHA here — users arrive via email link and won't have a reCAPTCHA widget loaded.
// This route is already protected by the reset_session httpOnly cookie set in /validate-reset-token.
router.post('/reset-password', resetPasswordLimiter, ...newPasswordValidation, handleValidationErrors, resetPassword);


router.post('/validate-reset-token', authLimiter, ...tokenValidation, handleValidationErrors, validateResetToken);
router.post('/refresh-token', refreshTokenLimiter, refreshToken);
router.post('/logout', logout);

// 🔒 NEW: Session Management Routes (Protected)
router.post('/logout-all', authenticateToken, logoutAllDevices);
router.get('/sessions', authenticateToken, getActiveSessions);
router.delete('/sessions/:sessionId', authenticateToken, revokeSession);

export default router;