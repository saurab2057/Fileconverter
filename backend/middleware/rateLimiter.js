import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { getClientIp } from '../utils/clientIp.js';

const isTest = () => process.env.NODE_ENV === 'test';


// ═══════════════════════════════════════════════════════════════
// RATE LIMITERS — express-rate-limit
//
// There are two fundamentally different rate-limit identities:
//
// ┌─────────────────────────────────────────────────────────────┐
// │ 1. AUTHENTICATED LIMITERS                                   │
// │                                                             │
// │    Identity = req.user._id                                  │
// │                                                             │
// │    These protect operations performed by an already         │
// │    authenticated account. IP address is NOT the primary    │
// │    identity because users can legitimately change networks │
// │    (Wi-Fi → mobile data, VPN, etc.).                        │
// └─────────────────────────────────────────────────────────────┘
//
// ┌─────────────────────────────────────────────────────────────┐
// │ 2. UNAUTHENTICATED LIMITERS                                 │
// │                                                             │
// │    Identity = real client IP                               │
// │                                                             │
// │    These run before authentication, so req.user does not    │
// │    exist yet. The client IP is therefore the main available │
// │    abuse-control identity.                                   │
// │                                                             │
// │    IMPORTANT: Do NOT use req.ip for this deployment.        │
// │    Express currently sees Render's internal 10.x address    │
// │    because the application sits behind Vercel/Cloudflare/   │
// │    Render proxy layers.                                     │
// │                                                             │
// │    getClientIp(req) centralizes the extraction of the real  │
// │    originating client IP from the trusted proxy headers.    │
// └─────────────────────────────────────────────────────────────┘
//
// Store: in-memory (default)
//
//   → Fine for the current single Render instance.
//   → For multi-instance/clustered deployments, move the store
//     to Redis or another shared rate-limit store.
//
// ═══════════════════════════════════════════════════════════════



// ─────────────────────────────────────────────────────────────
// 🔐 AUTHENTICATED LIMITERS
// ─────────────────────────────────────────────────────────────
//
// These limiters run AFTER authenticateToken.
//
// PRIMARY IDENTITY:
//     req.user._id
//
// WHY NOT IP?
//     A logged-in user's identity is the account itself.
//     Their IP can legitimately change between Wi-Fi, mobile
//     data, VPN, etc.
//
// Therefore these limiters intentionally remain user-based.
//
// The IP helper is NOT needed for the normal case.
//
// ─────────────────────────────────────────────────────────────


// WHO   : Logged-in users
// ROUTE : GET /api/users/*
// WHY   : Prevents excessive profile/settings/dashboard reads.
export const userReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,

  skip: (req) => isTest() || !req.user || !req.user._id,

  // Account identity — intentionally NOT IP-based.
  keyGenerator: (req) => req.user._id.toString(),

  message: {
    message: 'Too many user data requests. Please try again later.',
  },

  standardHeaders: true,
  legacyHeaders: false,
});


// WHO   : Logged-in users
// ROUTE : PUT/PATCH /api/users/*
// WHY   : Prevents excessive profile/settings updates.
export const userWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,

  skip: (req) => isTest() || !req.user || !req.user._id,

  // Account identity — intentionally NOT IP-based.
  keyGenerator: (req) => req.user._id.toString(),

  message: {
    message: 'Too many profile update requests. Please wait 1 minute.',
  },

  standardHeaders: true,
  legacyHeaders: false,
});


// WHO   : Logged-in users
// ROUTE : POST /api/chat/*
// WHY   : AI requests are computationally expensive.
//
// PRIMARY IDENTITY:
//     user._id
//
// FALLBACK:
//     getClientIp(req)
//
// The fallback only protects the endpoint if authentication
// unexpectedly leaves req.user unavailable.
export const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,

  skip: (req) => isTest() || !req.user || !req.user._id,

  keyGenerator: (req) =>
    req.user?._id?.toString() ||
    ipKeyGenerator(getClientIp(req)),

  message: {
    message: 'Chat rate limit exceeded. Please slow down.',
  },

  standardHeaders: true,
  legacyHeaders: false,
});


// WHO   : Logged-in users
// ROUTE : POST /api/summarize/*
// WHY   : PDF summarization is particularly expensive.
//
// PRIMARY IDENTITY:
//     user._id
//
// FALLBACK:
//     getClientIp(req)
//
// Again, the account ID is the normal identity. The IP helper
// exists only as a defensive fallback.
export const summarizeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,

  skip: (req) => isTest() || !req.user || !req.user._id,

  keyGenerator: (req) =>
    req.user?._id?.toString() ||
    ipKeyGenerator(getClientIp(req)),

  message: {
    message: 'Summarization limit reached. Please try again later.',
  },

  standardHeaders: true,
  legacyHeaders: false,
});


// WHO   : Logged-in users
// ROUTE : POST /api/convert/*
// WHY   : Conversion jobs consume CPU/memory.
//
// Account identity is enough here because this limiter runs
// after authentication.
//
// IP-based identity is intentionally NOT used.
export const conversionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,

  skip: (req) => isTest() || !req.user || !req.user._id,

  keyGenerator: (req) => req.user._id.toString(),

  message: {
    message: 'Too many conversion requests. Please wait 1 minute.',
  },

  standardHeaders: true,
  legacyHeaders: false,
});


// WHO   : Logged-in users
// ROUTE : POST /api/compress/*
// WHY   : Compression is CPU-intensive.
//
// Account identity is enough here.
//
// IP-based identity is intentionally NOT used.
export const compressionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,

  skip: (req) => isTest() || !req.user || !req.user._id,

  keyGenerator: (req) => req.user._id.toString(),

  message: {
    message: 'Too many compression requests. Please wait 1 minute.',
  },

  standardHeaders: true,
  legacyHeaders: false,
});


// ─────────────────────────────────────────────────────────────
// 🛡️ ADMIN LIMITER
// ─────────────────────────────────────────────────────────────
//
// Admin requests currently use express-rate-limit's default
// identity handling.
//
// We are intentionally NOT changing this in the current IP
// migration because admin authentication/authorization has its
// own middleware and we should decide separately whether this
// limiter should be:
//     - admin-user based,
//     - IP based,
//     - or a combination.
//
// Keeping it unchanged avoids mixing two security changes at once.
// ─────────────────────────────────────────────────────────────

export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,

  skip: () => isTest(),

  message: {
    message: 'Admin rate limit exceeded. Please try again later.',
  },

  standardHeaders: true,
  legacyHeaders: false,
});



// ═══════════════════════════════════════════════════════════════
// 🌐 UNAUTHENTICATED / IP-BASED LIMITERS
// ═══════════════════════════════════════════════════════════════
//
// These endpoints run before authentication or intentionally
// protect authentication-related operations.
//
// There is no reliable req.user identity available at this stage.
//
// PRIMARY IDENTITY:
//     Real originating client IP
//
// IMPORTANT:
//     Do NOT use req.ip here.
//
// In production:
//
//     Browser
//        ↓
//     Vercel
//        ↓
//     Cloudflare
//        ↓
//     Render
//        ↓
//     Express
//
// Express currently sees Render's internal address:
//
//     req.ip = 10.x.x.x
//
// Therefore getClientIp(req) extracts the client address from
// the proxy headers that were observed in our production tests.
//
// express-rate-limit's ipKeyGenerator() is still used around
// that result because it provides IPv6-safe key normalization.
//
// ═══════════════════════════════════════════════════════════════



// ─────────────────────────────────────────────────────────────
// 🔑 AUTHENTICATION RATE LIMITER
// ─────────────────────────────────────────────────────────────
//
// ROUTES:
//     POST /api/auth/login
//     POST /api/auth/signup
//     POST /api/auth/forgot-password
//
// WHY getClientIp()?
//
// These requests happen BEFORE a user is authenticated.
// There is therefore no account identity we can reliably use.
//
// The real client IP is the appropriate coarse abuse-control
// identity for brute-force/credential-stuffing protection.
//
// ─────────────────────────────────────────────────────────────

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,

  skip: () => isTest(),

  // Use the actual originating client IP, not Render's
  // internal req.ip value.
  keyGenerator: (req) => ipKeyGenerator(getClientIp(req)),

  standardHeaders: true,
  legacyHeaders: false,

  handler: (req, res) => {
    console.warn(
      `🚨 [AUTH] Brute force suspected — IP: ${getClientIp(req)}`
    );

    return res.status(429).json({
      success: false,
      message:
        'Too many login attempts. Please wait 15 minutes before trying again.',
    });
  },
});



// ─────────────────────────────────────────────────────────────
// 🔑 PASSKEY RATE LIMITER
// ─────────────────────────────────────────────────────────────
//
// ROUTE:
//     /api/auth/passkey/*
//
// HYBRID IDENTITY:
//
// Authenticated:
//     user_<userId>
//
// Unauthenticated:
//     real client IP
//
// WHY getClientIp()?
//
// Passkey login can occur before authentication, so there is no
// user ID available during the login flow.
//
// For already-authenticated passkey management, the account ID
// remains the primary identity.
//
// ─────────────────────────────────────────────────────────────

export const passkeyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,

  skip: () => isTest(),

  keyGenerator: (req) => {
    // Authenticated passkey operation:
    // account identity is more reliable than IP.
    if (req.user?._id) {
      return `user_${req.user._id.toString()}`;
    }

    // Unauthenticated passkey login:
    // use the actual originating client IP.
    return ipKeyGenerator(getClientIp(req));
  },

  // express-rate-limit should not try to interpret our
  // application-level proxy configuration itself.
  validate: {
    trustProxy: false,
  },

  message: {
    message: 'Too many passkey attempts. Please wait 1 minute.',
  },

  standardHeaders: true,
  legacyHeaders: false,
});



// ─────────────────────────────────────────────────────────────
// 🔑 REFRESH TOKEN RATE LIMITER
// ─────────────────────────────────────────────────────────────
//
// ROUTE:
//     POST /api/auth/refresh-token
//
// WHY getClientIp()?
//
// Refresh-token requests happen before a new authenticated
// request context is established.
//
// Each request can cause session/database work, so an attacker
// must not be able to repeatedly hit this endpoint.
//
// The real client IP is therefore used as the abuse-control key.
//
// ─────────────────────────────────────────────────────────────

export const refreshTokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,

  skip: () => isTest(),

  // Use real client IP rather than Render's internal req.ip.
  keyGenerator: (req) => ipKeyGenerator(getClientIp(req)),

  standardHeaders: true,
  legacyHeaders: false,

  handler: (req, res) => {
    console.warn(
      `🚨 [REFRESH] Excessive refresh attempts — IP: ${getClientIp(req)}`
    );

    return res.status(429).json({
      success: false,
      message: 'Too many refresh attempts. Please try again later.',
    });
  },
});



// ═══════════════════════════════════════════════════════════════
// 🔐 RESET PASSWORD RATE LIMITER
// ═══════════════════════════════════════════════════════════════
//
// PRIMARY IDENTITY:
//
//     reset_session cookie
//
// FALLBACK:
//
//     real client IP
//
// WHY getClientIp()?
//
// A valid reset_session cookie gives us a stronger, more
// operation-specific identity, so that remains the preferred
// key.
//
// However, requests without that cookie still need protection.
// In that situation we use the actual client IP.
//
// req.ip is NOT used because Express sees Render's internal
// proxy address in production.
// ═══════════════════════════════════════════════════════════════

export const resetPasswordLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,

  skip: () => process.env.NODE_ENV === 'test',

  standardHeaders: true,
  legacyHeaders: false,

  keyGenerator: (req) => {
    // Prefer reset session as the identity when available.
    //
    // The cookie itself is not exposed directly as the
    // rate-limit key; only a prefix is used.
    const resetSession = req.cookies?.reset_session;

    if (resetSession) {
      return `reset_${resetSession.substring(0, 20)}`;
    }

    // No reset session:
    // fall back to the real originating client IP.
    return ipKeyGenerator(getClientIp(req));
  },

  message: {
    message:
      'Too many password reset attempts. Please wait 1 minute before trying again.',
  },

  handler: (req, res) => {
    console.warn(
      `🚨 [RESET] Excessive reset attempts — IP: ${getClientIp(req)}`
    );

    return res.status(429).json({
      message:
        'Too many password reset attempts. Please wait 1 minute before trying again.',
    });
  },
});