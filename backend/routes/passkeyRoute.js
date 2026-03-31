// routes/passkeyRoute.js
import express from 'express';
import { body, param } from 'express-validator';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { passkeyLimiter } from '../middleware/rateLimiter.js';
import { handleValidationErrors } from '../middleware/validation.js';
import {
  startRegistration,
  verifyRegistration,
  startAuthentication,
  verifyAuthentication,
  getPasskeys,
  deletePasskey,
  updatePasskeyLabel,
} from '../controllers/Authentication/passkeyController.js';

const router = express.Router();

// Never cache passkey responses
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});

// ─────────────────────────────────────────────────────────────
// REGISTRATION FLOW
// User must already be logged in (JWT required).
// Entry point: Dashboard → Security tab → "Add Passkey" button.
// ─────────────────────────────────────────────────────────────

// Step 1 — Server generates challenge + options, stores challenge in cookie
router.post(
  '/register/start',
  authenticateToken,
  passkeyLimiter,
  startRegistration
);

// Step 2 — Browser signs the challenge, sends credential back
// Label is NOT accepted here — auto-generated from User-Agent.
// User renames it later via PATCH /:passkeyId/label.
router.post(
  '/register/finish',
  authenticateToken,
  passkeyLimiter,
  body('response')
    .notEmpty()
    .withMessage('WebAuthn registration response is required.'),
  handleValidationErrors,
  verifyRegistration
);

// ─────────────────────────────────────────────────────────────
// AUTHENTICATION FLOW
// Public — no JWT required.
// Entry point: Login page → "Continue with Passkey" button.
// ─────────────────────────────────────────────────────────────

// Step 1 — User provides email, server returns challenge + allowed credentials
router.post(
  '/login/start',
  passkeyLimiter,
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('A valid email address is required.'),
  handleValidationErrors,
  startAuthentication
);

// Step 2 — Browser signs the challenge, server verifies and issues JWT
router.post(
  '/login/finish',
  passkeyLimiter,
  body('response')
    .notEmpty()
    .withMessage('WebAuthn authentication response is required.'),
  handleValidationErrors,
  verifyAuthentication
);

// ─────────────────────────────────────────────────────────────
// PASSKEY MANAGEMENT
// All routes below require a valid JWT.
// ─────────────────────────────────────────────────────────────

// List all passkeys for the logged-in user
router.get(
  '/',
  authenticateToken,
  passkeyLimiter,
  getPasskeys
);

// Rename a passkey label (the ONLY editable field)
router.patch(
  '/:passkeyId/label',
  authenticateToken,
  passkeyLimiter,
  param('passkeyId')
    .isMongoId()
    .withMessage('Invalid passkey ID.'),
  body('label')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Label cannot be empty.')
    .isLength({ max: 50 })
    .withMessage('Label must be 50 characters or fewer.'),
  handleValidationErrors,
  updatePasskeyLabel
);

// Delete a passkey (e.g. user lost a device)
router.delete(
  '/:passkeyId',
  authenticateToken,
  passkeyLimiter,
  param('passkeyId')
    .isMongoId()
    .withMessage('Invalid passkey ID.'),
  handleValidationErrors,
  deletePasskey
);

export default router;