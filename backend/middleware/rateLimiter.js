import rateLimit, {ipKeyGenerator} from 'express-rate-limit';

const isTest = () => process.env.NODE_ENV === 'test';

export const userReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  skip: (req) => isTest() || !req.user || !req.user._id,
  keyGenerator: (req) => req.user._id.toString(),
  message: { message: 'Too many user data requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const userWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  skip: (req) => isTest() || !req.user || !req.user._id,
  keyGenerator: (req) => req.user._id.toString(),
  message: { message: 'Too many profile update requests. Please wait 1 minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  skip: () => isTest(),
  message: { message: 'Chat rate limit exceeded. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const summarizeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  skip: () => isTest(),
  message: { message: 'Summarization limit reached. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const conversionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  skip: (req) => isTest() || !req.user || !req.user._id,
  keyGenerator: (req) => req.user._id.toString(),
  message: { message: 'Too many conversion requests. Please wait 1 minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  skip: () => isTest(),
  message: { message: 'Admin rate limit exceeded. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  skip: () => isTest(),
  message: { success: false, message: 'Too many attempts. Please wait 1 minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const compressionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  skip: (req) => isTest() || !req.user || !req.user._id,
  keyGenerator: (req) => req.user._id.toString(),
  message: { message: 'Too many compression requests. Please wait 1 minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Tighter window than authLimiter because WebAuthn challenges
// are short-lived and repeated failures indicate probing.
// ─────────────────────────────────────────────────────────────
export const passkeyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  skip: () => isTest(),
  keyGenerator: (req) => {
    if (req.user?._id) return `user_${req.user._id.toString()}`;
    // Use req.ip directly — express-rate-limit handles IPv6 normalisation
    // internally when validate.trustProxy is set correctly
    return ipKeyGenerator(req);
  },
  validate: { trustProxy: false },  // ← this suppresses the IPv6 warning
  message: { message: 'Too many passkey attempts. Please wait 1 minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});