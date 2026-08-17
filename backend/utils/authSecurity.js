import crypto from 'crypto';


// ─────────────────────────────────────────────────────────────
// IP HASHING
//
// Salt is absorbed here so every caller (auditLogger, waf,
// collectUserMetadata) produces the same hash for the same IP.
//
// Previously: collectUserMetadata.js manually concatenated
// IP_HASH_SALT before calling hashIP(), all other callers did not.
// Same IP → different hashes across collections → correlation broken.
//
// Callers must pass the raw IP only. Do NOT concatenate the salt
// externally — that was the bug.
//
// Required env var: IP_HASH_SALT (32+ random chars)
// ─────────────────────────────────────────────────────────────
const IP_HASH_SALT = process.env.IP_HASH_SALT || '';

if (!IP_HASH_SALT) {
    console.warn('⚠️ [authSecurity] IP_HASH_SALT is not set — IP hashes are unsalted and reversible by brute force in production.');
}

export const hashIP = (ip) => {
    if (!ip) return 'unknown';
    return crypto.createHash('sha256').update(ip + IP_HASH_SALT).digest('hex');
};


// ─────────────────────────────────────────────────────────────
// JWT VALIDITY AFTER PASSWORD CHANGE
//
// Rejects tokens issued before a password change so stolen tokens
// cannot be used after the user secures their account.
// Depends on User.js pre-save hook stamping passwordChangedAt
// with a -1000ms offset to guard against clock skew.
// ─────────────────────────────────────────────────────────────
export const isTokenValidAfterChange = (jwtTimestamp, passwordChangedAt) => {
    if (!passwordChangedAt) return true; // OAuth / passkey users — no password on record
    const changedTimestamp = parseInt(passwordChangedAt.getTime() / 1000, 10);
    return jwtTimestamp > changedTimestamp;
};


// ─────────────────────────────────────────────────────────────
// JTI GENERATOR
//
// UUID v4 stamped into each access token at issue time.
// Stored in Session collection to enable per-device revocation
// without invalidating all sessions (unlike passwordChangedAt).
// ─────────────────────────────────────────────────────────────
export const generateJti = () => {
    return crypto.randomUUID();
};


// ─────────────────────────────────────────────────────────────
// DEVICE ID GENERATOR
//
// Creates a deterministic device fingerprint from the request:
//   IP address (x‑forwarded‑for or socket) + User‑Agent string
//
// Used to generate a server‑side deviceId for session tracking,
// eliminating the need for the client to send a deviceId.
//
// Why does this work?
//   - Same device + same browser → same IP+UA → same hash
//   - Different browser on same device → different UA → different hash
//   - IP changes (mobile network) → different hash → new session
//     (this is acceptable because session is per (user + deviceId);
//      a new session will be upserted, old one remains but lastActive won't update)
//
// Security note:
//   This is NOT a trusted device fingerprint – it's only a label
//   for session grouping. No security decision relies on it alone.
//   All authorisation still happens via JWT and refresh token rotation.
// ─────────────────────────────────────────────────────────────
export const generateDeviceId = (req) => {
    const ip = req.ip || req.socket?.remoteAddress || '';
    const userAgent = req.get('user-agent') || '';
    const raw = `${ip}|${userAgent}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
};