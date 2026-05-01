// controllers/Authentication/passkeyController.js
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import Passkey from '../../models/Passkey.js';
import User from '../../models/User.js';
import { handleLoginSuccess } from './authController.js';
import { logUserActivity } from '../../middleware/auditLogger.js';
import { saveUserMetadata } from '../../middleware/collectUserMetadata.js';
import { UAParser } from 'ua-parser-js';

// ─────────────────────────────────────────────────────────────
// WEBAUTHN CONFIG HELPER
// Centralised — change RP settings once in .env, affects all
// four WebAuthn handlers automatically.
// ─────────────────────────────────────────────────────────────
const getWebAuthnConfig = () => ({
  rpName: process.env.RP_NAME || 'FileConvert Pro',
  rpID: process.env.RP_ID || 'localhost',
  origin: process.env.RP_ORIGIN || 'http://localhost:5173',
});

// ─────────────────────────────────────────────────────────────
// CHALLENGE COOKIE HELPERS
//
// WebAuthn requires the server to issue a challenge, then verify
// the client signed that exact challenge. We store it in a
// short-lived httpOnly cookie instead of express-session
// (session middleware is not configured in this project).
//
// Security properties:
//   httpOnly  → JS cannot read it (XSS protection)
//   secure    → HTTPS only in production
//   sameSite  → strict (no cross-site request leakage)
//   maxAge    → 5 minutes (WebAuthn timeout is 60s, cookie is
//               slightly longer to cover slow networks)
// ─────────────────────────────────────────────────────────────
const CHALLENGE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 5 * 60 * 1000,
  path: '/',
};

const setChallengeCookie = (res, name, value) =>
  res.cookie(name, value, CHALLENGE_COOKIE_OPTIONS);

const clearChallengeCookie = (res, name) =>
  res.clearCookie(name, { path: '/' });

// ─────────────────────────────────────────────────────────────
// USER-AGENT HELPERS
// Parse the request User-Agent into human-readable device info.
// Used to auto-label passkeys at registration time.
// ─────────────────────────────────────────────────────────────
const detectDeviceType = (userAgent) => {
  const parser = new UAParser(userAgent);
  const device = parser.getDevice();
  if (device.type === 'mobile') return 'mobile';
  if (device.type === 'tablet') return 'tablet';
  return 'desktop';
};

const getDeviceName = (userAgent) => {
  const parser = new UAParser(userAgent);
  const browser = parser.getBrowser();
  const os = parser.getOS();
  const b = browser.name || 'Unknown';
  const o = os.name || 'Unknown';
  return `${b} on ${o}`;
};

const getClientIP = (req) =>
  req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';


// ─────────────────────────────────────────────────────────────
// START REGISTRATION
//
// Called when a logged-in user clicks "Add Passkey" in their
// Security tab. Generates a WebAuthn challenge and registration
// options, stores the challenge in a cookie, and returns the
// options to the frontend for the browser WebAuthn API.
//
// Protected: requires valid JWT (user must already be logged in).
// ─────────────────────────────────────────────────────────────
export const startRegistration = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Fetch already-registered credentials for this user.
    // Passing them as excludeCredentials prevents the browser from
    // registering the same device twice.
    const existingPasskeys = await Passkey.find({ user: userId })
      .select('credentialID');

    const excludeCredentials = existingPasskeys.map((pk) => ({
      id: pk.credentialID,
      type: 'public-key',
    }));

    const { rpName, rpID } = getWebAuthnConfig();

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: Buffer.from(userId.toString()),
      userName: user.email,
      userDisplayName: user.name,
      attestationType: 'none',
      excludeCredentials,
      authenticatorSelection: {
        residentKey: 'preferred', // enables discoverable credential (passkey)
        userVerification: 'preferred', // request biometric / PIN if available
      },
      timeout: 60000,
    });

    setChallengeCookie(res, 'passkey_reg_challenge', options.challenge);

    return res.json(options);
  } catch (error) {
    console.error('❌ startRegistration Error:', error);
    return res.status(500).json({ message: 'Failed to start passkey registration.' });
  }
};


// ─────────────────────────────────────────────────────────────
// VERIFY REGISTRATION
//
// Called after the browser WebAuthn API returns a new credential.
// Validates the challenge, saves the passkey to the DB, and
// logs the PASSKEY_REGISTERED activity event.
//
// Label is auto-generated from the device User-Agent — the user
// never types a label at registration time. They can rename it
// later from the Security tab.
//
// Protected: requires valid JWT.
// ─────────────────────────────────────────────────────────────
export const verifyRegistration = async (req, res) => {
  try {
    const userId = req.user._id;
    const { response } = req.body;

    const challenge = req.cookies?.passkey_reg_challenge;
    if (!challenge) {
      return res.status(400).json({
        message: 'Registration session expired. Please try again.',
      });
    }

    const { rpID, origin } = getWebAuthnConfig();

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: false,
      });
    } catch (verifyError) {
      clearChallengeCookie(res, 'passkey_reg_challenge');
      console.error('❌ verifyRegistrationResponse failed:', verifyError.message);
      return res.status(400).json({
        message: 'Passkey verification failed. Please try again.',
      });
    }

    const { verified, registrationInfo } = verification;

    if (!verified || !registrationInfo) {
      clearChallengeCookie(res, 'passkey_reg_challenge');
      return res.status(400).json({ message: 'Passkey verification failed.' });
    }

    const { credential } = registrationInfo;

    // Defensive check — should never fire because excludeCredentials
    // already prevents re-registration, but be safe.
    const existing = await Passkey.findOne({ credentialID: credential.id });
    if (existing) {
      clearChallengeCookie(res, 'passkey_reg_challenge');
      return res.status(400).json({
        message: 'This passkey is already registered to an account.',
      });
    }

    const userAgent = req.get('user-agent') || '';
    const deviceType = detectDeviceType(userAgent);
    const deviceName = getDeviceName(userAgent);

    // Duplicate device check — warn if this user already has a passkey
    // from the same browser + OS combination (e.g. "Chrome on Windows").
    // Each browser on a device shares the same credential store, so two
    // passkeys from "Chrome on Windows" would be redundant.
    const duplicate = await Passkey.findOne({ user: userId, deviceName });
    if (duplicate) {
      clearChallengeCookie(res, 'passkey_reg_challenge');
      return res.status(400).json({
        message: `A passkey for "${deviceName}" is already registered. Each browser on a device can only have one passkey.`,
      });
    }

    // Auto-generate label from deviceName.
    // Falls back to a date string if UA parsing returns nothing useful.
    const autoLabel =
      deviceName && deviceName !== 'Unknown on Unknown'
        ? deviceName.substring(0, 50)
        : `Passkey ${new Date().toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}`;

    const passkey = new Passkey({
      user: userId,
      credentialID: credential.id,
      credentialPublicKey: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter,
      deviceType,
      deviceName,
      label: autoLabel,
    });

    await passkey.save();
    clearChallengeCookie(res, 'passkey_reg_challenge');

    await logUserActivity(
      userId,
      'PASSKEY_REGISTERED',
      `Passkey:${credential.id.substring(0, 16)}...`,
      { deviceType, deviceName, label: passkey.label },
      getClientIP(req),
      userAgent
    );

    console.log(`✅ Passkey registered for user ${userId} — "${passkey.label}"`);

    return res.status(201).json({
      message: 'Passkey registered successfully.',
      passkey: {
        id: passkey._id,
        deviceType: passkey.deviceType,
        deviceName: passkey.deviceName,
        label: passkey.label,
        createdAt: passkey.createdAt,
        lastUsed: passkey.lastUsed,
      },
    });
  } catch (error) {
    console.error('❌ verifyRegistration Error:', error);
    if (error.statusCode === 400) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Failed to complete passkey registration.' });
  }
};


// ─────────────────────────────────────────────────────────────
// START AUTHENTICATION
//
// Public route — called when user clicks "Continue with Passkey"
// on the login page and submits their email.
//
// Looks up the user's registered passkeys and returns a WebAuthn
// authentication challenge. The browser then prompts the user
// for their biometric / device PIN.
//
// If the user has no passkeys → returns a clear message so the
// frontend can tell them to add one from their Security tab.
// ─────────────────────────────────────────────────────────────
export const startAuthentication = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    // Use a generic message to avoid confirming whether an email
    // exists in the system (email enumeration protection).
    if (!user) {
      return res.status(404).json({
        message: 'No passkey found for this account.',
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ message: 'Account is not active.' });
    }

    const passkeys = await Passkey.find({ user: user._id }).select('credentialID');

    if (passkeys.length === 0) {
      return res.status(404).json({
        message: 'No passkey found for this account.',
      });
    }

    const allowCredentials = passkeys.map((pk) => ({
      id: pk.credentialID,
      type: 'public-key',
    }));

    const { rpID } = getWebAuthnConfig();

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials,
      userVerification: 'preferred',
      timeout: 60000,
    });

    // Store challenge + userId in cookies.
    // userId is stored server-side so we never trust the client
    // to tell us which user is authenticating.
    setChallengeCookie(res, 'passkey_auth_challenge', options.challenge);
    setChallengeCookie(res, 'passkey_auth_userid', user._id.toString());

    return res.json(options);
  } catch (error) {
    console.error('❌ startAuthentication Error:', error);
    return res.status(500).json({ message: 'Failed to start passkey authentication.' });
  }
};


// ─────────────────────────────────────────────────────────────
// VERIFY AUTHENTICATION
//
// Public route — called after the browser returns the signed
// WebAuthn assertion. Verifies the signature, updates the
// replay-attack counter, logs the event, and issues JWT tokens
// via the shared handleLoginSuccess helper (same as normal login).
// ─────────────────────────────────────────────────────────────
export const verifyAuthentication = async (req, res) => {
  try {
    const { response } = req.body;

    const challenge = req.cookies?.passkey_auth_challenge;
    const userId = req.cookies?.passkey_auth_userid;

    if (!challenge || !userId) {
      return res.status(400).json({
        message: 'Authentication session expired. Please try again.',
      });
    }

    // Always clear auth cookies — whether we succeed or fail.
    // Prevents reuse of a challenge.
    clearChallengeCookie(res, 'passkey_auth_challenge');
    clearChallengeCookie(res, 'passkey_auth_userid');

    const user = await User.findById(userId);
    if (!user || user.status !== 'active') {
      return res.status(401).json({ message: 'User not found or account is inactive.' });
    }

    const passkey = await Passkey.findOne({
      user: userId,
      credentialID: response.id,
    });

    if (!passkey) {
      await logUserActivity(
        userId,
        'PASSKEY_LOGIN_FAILED',
        `User:${userId}`,
        { reason: 'credential_not_found', credentialID: response.id },
        getClientIP(req),
        req.get('user-agent') || ''
      );
      return res.status(401).json({ message: 'Passkey not recognised for this account.' });
    }

    const { rpID, origin } = getWebAuthnConfig();

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: passkey.credentialID,
          publicKey: Buffer.from(passkey.credentialPublicKey, 'base64url'),
          counter: passkey.counter,
        },
        requireUserVerification: false,
      });
    } catch (verifyError) {
      console.error('❌ verifyAuthenticationResponse failed:', verifyError.message);
      await logUserActivity(
        userId,
        'PASSKEY_LOGIN_FAILED',
        `User:${userId}`,
        { reason: 'verification_error', error: verifyError.message },
        getClientIP(req),
        req.get('user-agent') || ''
      );
      return res.status(401).json({ message: 'Passkey verification failed. Please try again.' });
    }

    const { verified, authenticationInfo } = verification;

    if (!verified) {
      await logUserActivity(
        userId,
        'PASSKEY_LOGIN_FAILED',
        `User:${userId}`,
        { reason: 'not_verified' },
        getClientIP(req),
        req.get('user-agent') || ''
      );
      return res.status(401).json({ message: 'Passkey verification failed.' });
    }

    // Update replay-attack counter — if new counter ≤ stored counter,
    // @simplewebauthn/server throws automatically before we get here.
    passkey.counter = authenticationInfo.newCounter;
    passkey.lastUsed = new Date();
    await passkey.save();

    // consistent with authController.js login() and googleAuth()
    await saveUserMetadata(req, userId);  // metadata first

    await logUserActivity(
      userId,
      'PASSKEY_LOGIN',
      `User:${userId}`,
      { deviceType: passkey.deviceType, deviceName: passkey.deviceName, label: passkey.label },
      getClientIP(req),
      req.get('user-agent') || ''
    );

    // Issue JWT + refresh cookie — identical to normal password login
    return handleLoginSuccess(res, user, req);
  } catch (error) {
    console.error('❌ verifyAuthentication Error:', error);
    return res.status(500).json({ message: 'Failed to complete passkey authentication.' });
  }
};


// ─────────────────────────────────────────────────────────────
// GET PASSKEYS
//
// Returns the logged-in user's registered passkeys.
// Only safe metadata is returned — the cryptographic key material
// (credentialID, credentialPublicKey, counter) is never exposed.
//
// Protected: requires valid JWT.
// ─────────────────────────────────────────────────────────────
export const getPasskeys = async (req, res) => {
  try {
    const userId = req.user._id;

    const passkeys = await Passkey.find({ user: userId })
      .select('deviceType deviceName label createdAt lastUsed')
      .sort({ createdAt: -1 });

    return res.json({ passkeys });
  } catch (error) {
    console.error('❌ getPasskeys Error:', error);
    return res.status(500).json({ message: 'Failed to fetch passkeys.' });
  }
};


// ─────────────────────────────────────────────────────────────
// DELETE PASSKEY
//
// User removes one of their own passkeys — e.g. after losing
// a device they want to revoke access for that device.
//
// Ownership is enforced — user can only delete their own passkeys.
// The cryptographic credential on the device is not affected;
// only the server record is removed, so that device can no
// longer authenticate against this account.
//
// Protected: requires valid JWT.
// ─────────────────────────────────────────────────────────────
export const deletePasskey = async (req, res) => {
  try {
    const userId = req.user._id;
    const { passkeyId } = req.params;

    const passkey = await Passkey.findOneAndDelete({
      _id: passkeyId,
      user: userId,   // ownership check
    });

    if (!passkey) {
      return res.status(404).json({ message: 'Passkey not found.' });
    }

    await logUserActivity(
      userId,
      'PASSKEY_DELETED',
      `Passkey:${passkeyId}`,
      { deviceType: passkey.deviceType, deviceName: passkey.deviceName, label: passkey.label },
      getClientIP(req),
      req.get('user-agent') || ''
    );

    console.log(`✅ Passkey "${passkey.label}" deleted by user ${userId}`);

    return res.json({ message: 'Passkey removed successfully.' });
  } catch (error) {
    console.error('❌ deletePasskey Error:', error);
    return res.status(500).json({ message: 'Failed to delete passkey.' });
  }
};


// ─────────────────────────────────────────────────────────────
// UPDATE PASSKEY LABEL
//
// The label is the ONLY user-editable field on a passkey.
// The cryptographic credential (key, counter, deviceName) is
// immutable after registration.
//
// User renames from Security tab — e.g.
//   "Chrome on Windows"  →  "My Work Laptop"
//   "Safari on iOS"      →  "iPhone 15"
//
// Protected: requires valid JWT.
// ─────────────────────────────────────────────────────────────
export const updatePasskeyLabel = async (req, res) => {
  try {
    const userId = req.user._id;
    const { passkeyId } = req.params;
    const { label } = req.body;

    if (!label || typeof label !== 'string' || label.trim().length === 0) {
      return res.status(400).json({ message: 'Label cannot be empty.' });
    }

    const passkey = await Passkey.findOneAndUpdate(
      { _id: passkeyId, user: userId },   // ownership check
      { label: label.trim().substring(0, 50) },
      { new: true, runValidators: true }
    ).select('deviceType deviceName label createdAt lastUsed');

    if (!passkey) {
      return res.status(404).json({ message: 'Passkey not found.' });
    }

    await logUserActivity(
      userId,
      'PASSKEY_RENAMED',
      `Passkey:${passkeyId}`,
      { newLabel: passkey.label, deviceName: passkey.deviceName },
      getClientIP(req),
      req.get('user-agent') || ''
    );

    console.log(`✅ Passkey ${passkeyId} renamed to "${passkey.label}" by user ${userId}`);

    return res.json({
      message: 'Passkey renamed successfully.',
      passkey,
    });
  } catch (error) {
    console.error('❌ updatePasskeyLabel Error:', error);
    return res.status(500).json({ message: 'Failed to rename passkey.' });
  }
};