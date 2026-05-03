import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const isTest = () => process.env.NODE_ENV === 'test';

// ═══════════════════════════════════════════════════════════════
// RATE LIMITERS — express-rate-limit
//
// Two categories:
//
//   AUTHENTICATED (keyed by user._id)
//   → Run AFTER authenticateToken middleware
//   → Limits are per user account, not per IP
//   → Rotating IPs cannot bypass these — account is the identity
//   → Falls back to IP only if user is somehow missing (safety net)
//
//   UNAUTHENTICATED (keyed by IP)
//   → Run BEFORE auth (login, signup, passkey endpoints)
//   → No user identity exists yet, so IP is the only signal
//   → Combined with reCAPTCHA score for stronger bot detection
//
// Store: in-memory (default)
//   → Fine for single-server deployments (Render free tier)
//   → For multi-instance/clustered deployments, swap to Redis store
//     using `express-rate-limit` + `rate-limit-redis` packages
//
// ═══════════════════════════════════════════════════════════════


// ─────────────────────────────────────────────────────────────
// AUTHENTICATED LIMITERS
// These run AFTER authenticateToken, so req.user is guaranteed.
// Keyed by user._id — IP rotation cannot bypass these.
// ─────────────────────────────────────────────────────────────

// WHO   : Logged-in users
// ROUTE : GET /api/users/* (profile, settings, dashboard reads)
// WHY   : Prevents scraping of user data or abusing read endpoints
//         in a loop. 60 reads/min is generous for normal usage.
export const userReadLimiter = rateLimit({
  windowMs: 60 * 1000,           // 1 minute window
  max: 60,                        // 60 read requests per minute per user
  skip: (req) => isTest() || !req.user || !req.user._id,
  keyGenerator: (req) => req.user._id.toString(),
  message: { message: 'Too many user data requests. Please try again later.' },
  standardHeaders: true,          // Returns RateLimit-* headers (RFC 6585)
  legacyHeaders: false,           // Disables X-RateLimit-* (deprecated)
});

// WHO   : Logged-in users
// ROUTE : PUT/PATCH /api/users/* (profile updates, settings changes)
// WHY   : Write operations are more expensive than reads — tighter limit.
//         Also prevents mass update abuse (e.g. spamming profile changes).
//         15 writes/min is enough for any real user action.
export const userWriteLimiter = rateLimit({
  windowMs: 60 * 1000,           // 1 minute window
  max: 15,                        // 15 write requests per minute per user
  skip: (req) => isTest() || !req.user || !req.user._id,
  keyGenerator: (req) => req.user._id.toString(),
  message: { message: 'Too many profile update requests. Please wait 1 minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// WHO   : Logged-in users
// ROUTE : POST /api/chat/* (AI chat messages to FastAPI backend)
// WHY   : Each chat message triggers an AI model call — expensive in
//         compute and cost. 10 messages/min prevents abuse while
//         keeping the experience smooth for genuine users.
//         Keyed by user ID so rotating IPs don't bypass the limit.
export const chatLimiter = rateLimit({
  windowMs: 60 * 1000,           // 1 minute window
  max: 10,                        // 10 chat messages per minute per user
  skip: (req) => isTest() || !req.user || !req.user._id,
  keyGenerator: (req) => req.user?._id?.toString() || ipKeyGenerator(req),
  message: { message: 'Chat rate limit exceeded. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// WHO   : Logged-in users
// ROUTE : POST /api/summarize/* (PDF summarization via FastAPI + AI)
// WHY   : Summarization is the most expensive operation — it processes
//         a full PDF and runs it through the AI model. Strictest limit.
//         5 requests/min is enough for genuine use.
//         Keyed by user ID so rotating IPs don't bypass the limit.
export const summarizeLimiter = rateLimit({
  windowMs: 60 * 1000,           // 1 minute window
  max: 5,                         // 5 summarization requests per minute per user
  skip: (req) => isTest() || !req.user || !req.user._id,
  keyGenerator: (req) => req.user?._id?.toString() || ipKeyGenerator(req),
  message: { message: 'Summarization limit reached. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// WHO   : Logged-in users
// ROUTE : POST /api/convert/* (file format conversion)
// WHY   : Conversion jobs consume CPU and memory on the server.
//         10/min balances usability with server protection.
export const conversionLimiter = rateLimit({
  windowMs: 60 * 1000,           // 1 minute window
  max: 10,                        // 10 conversion requests per minute per user
  skip: (req) => isTest() || !req.user || !req.user._id,
  keyGenerator: (req) => req.user._id.toString(),
  message: { message: 'Too many conversion requests. Please wait 1 minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// WHO   : Logged-in users
// ROUTE : POST /api/compress/* (file compression)
// WHY   : Same reasoning as conversionLimiter — CPU-intensive job.
//         Kept as a separate limiter so compression and conversion
//         quotas don't share a counter and block each other.
export const compressionLimiter = rateLimit({
  windowMs: 60 * 1000,           // 1 minute window
  max: 10,                        // 10 compression requests per minute per user
  skip: (req) => isTest() || !req.user || !req.user._id,
  keyGenerator: (req) => req.user._id.toString(),
  message: { message: 'Too many compression requests. Please wait 1 minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// WHO   : Admin users only
// ROUTE : /api/admin/* (dashboard, user management, config)
// WHY   : Admin endpoints are high-value targets. A wider window (15 min)
//         with a higher cap (100 requests) suits real admin workflows
//         while still blocking automated admin endpoint probing.
export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,     // 15 minute window
  max: 100,                       // 100 requests per 15 minutes
  skip: () => isTest(),
  message: { message: 'Admin rate limit exceeded. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});


// ─────────────────────────────────────────────────────────────
// UNAUTHENTICATED LIMITERS
// These run BEFORE auth — no req.user exists yet.
// Keyed by IP — the only available identity at this stage.
// Pair with reCAPTCHA for stronger bot protection.
// ─────────────────────────────────────────────────────────────

// WHO   : Anyone (unauthenticated)
// ROUTE : POST /api/auth/login, /api/auth/signup, /api/auth/forgot-password
// WHY   : Primary defense against brute force and credential stuffing.
//         15 minute window makes automation painful — 10 failed attempts
//         locks the IP out for 15 minutes before they can try again.
//         Works alongside reCAPTCHA (score-based bot detection) for
//         dual-layer protection on all auth endpoints.
//         Custom handler logs the suspicious IP for production visibility.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,     // 15 minute window
  max: 10,                        // 10 attempts per 15 minutes per IP
  skip: () => isTest(),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    // Log the IP so you can spot brute force patterns in production logs
    console.warn(`🚨 [AUTH] Brute force suspected — IP: ${req.ip}`);
    return res.status(429).json({
      success: false,
      message: 'Too many login attempts. Please wait 15 minutes before trying again.',
    });
  },
});

// WHO   : Anyone (unauthenticated or authenticated)
// ROUTE : POST /api/auth/passkey/* (WebAuthn challenge + verification)
// WHY   : WebAuthn challenges are short-lived (typically 60s TTL).
//         Repeated failures in quick succession indicate active probing
//         of the passkey endpoint — tighter window catches this faster.
//         Hybrid keyGenerator:
//           - Authenticated (managing saved passkeys) → key by user._id
//           - Unauthenticated (passkey login/register) → key by IP
export const passkeyLimiter = rateLimit({
  windowMs: 60 * 1000,           // 1 minute window
  max: 10,                        // 10 passkey attempts per minute
  skip: () => isTest(),
  keyGenerator: (req) => {
    if (req.user?._id) return `user_${req.user._id.toString()}`;
    return ipKeyGenerator(req);
  },
  validate: { trustProxy: false }, // Suppresses IPv6 normalisation warning
  message: { message: 'Too many passkey attempts. Please wait 1 minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});


// WHO   : Anyone (unauthenticated)
// ROUTE : POST /api/auth/refresh-token
// WHY   : Prevents brute force on expired/invalid refresh tokens.
//         Each attempt does DB lookups (session + user). Limits IP to 30 tries/15min.
//         Even valid tokens are rate-limited per IP to slow credential stuffing.
export const refreshTokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,     // 15 minutes
  max: 30,                       // 30 attempts per 15 minutes per IP
  skip: () => isTest(),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`🚨 [REFRESH] Excessive refresh attempts — IP: ${req.ip}`);
    return res.status(429).json({
      success: false,
      message: 'Too many refresh attempts. Please try again later.',
    });
  },
});