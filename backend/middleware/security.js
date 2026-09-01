import morgan from 'morgan';
import cookieParser from 'cookie-parser';

// ─────────────────────────────────────────────────────────────
// CORS CONFIGURATION
// ─────────────────────────────────────────────────────────────
const baseOrigins = [
  'http://localhost:5173',       // Vite dev server
  'http://localhost:4173',       // Vite preview server
  'https://fileconverter-mu.vercel.app' // Known production frontend
];

const corsOptions = {
  origin: (origin, callback) => {
    // 1. Allow requests with no origin (Postman, curl, mobile apps, server-to-server)
    if (!origin) {
      return callback(null, true);
    }

    // 2. Dynamically build allowed list at request time to ensure env vars are fully loaded
    const envOrigin = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.trim().replace(/\/$/, '') : null;
    const allowedOrigins = [...baseOrigins, envOrigin].filter(Boolean).map(url => url.replace(/\/$/, ''));

    // 3. Normalize the incoming origin for exact matching
    const cleanOrigin = origin.trim().replace(/\/$/, '');

    // 4. Validate
    if (allowedOrigins.includes(cleanOrigin)) {
      callback(null, true);
    } else {
      // 🔥 DEBUG: Log exactly what failed to instantly diagnose Render env issues
      console.error('🚨 CORS REJECTED:');
      console.error(`  - Requested Origin: "${cleanOrigin}"`);
      console.error(`  - FRONTEND_URL Env: "${envOrigin}"`);
      console.error(`  - Allowed List:`, allowedOrigins);
      
      callback(new Error('This origin is not allowed by the CORS policy.'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Request-ID'],
  credentials: true, // Required for httpOnly cookies
};

// ─────────────────────────────────────────────────────────────
// HELMET / CSP CONFIGURATION
// ─────────────────────────────────────────────────────────────
const helmetOptions = {
  crossOriginEmbedderPolicy: false, // Required for some third-party embeds
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }, // Required for Google OAuth popups
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "https://accounts.google.com/gsi/client",
        "https://apis.google.com",
        "https://www.google.com",
        "https://www.gstatic.com",
      ],
      styleSrc: [
        "'self'",
        "https://accounts.google.com",
        "https://fonts.googleapis.com",
      ],
      imgSrc: [
        "'self'",
        "data:",
        "https://*.googleusercontent.com",
        "https://lh3.googleusercontent.com",
        "https://lh4.googleusercontent.com",
        "https://res.cloudinary.com",
      ],
      frameSrc: [
        "'self'",
        "https://accounts.google.com",
        "https://www.google.com",
      ],
      connectSrc: [
        "'self'",
        "https://accounts.google.com",
        "https://www.googleapis.com",
        "https://www.google.com",
        "https://api.resend.com",
        "https://backend-kijk.onrender.com",
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com",
      ],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
      frameAncestors: ["'none'"], // Prevents clickjacking
    },
  },
  hsts: {
    maxAge: process.env.NODE_ENV === 'production' ? 63072000 : 0,
    includeSubDomains: true,
    preload: true,
  },
  noSniff: true,
};

// ─────────────────────────────────────────────────────────────
// EXPORTS (Matches original structure for app.js compatibility)
// ─────────────────────────────────────────────────────────────
export {
  corsOptions,
  helmetOptions,
  cookieParser,
  morgan,
};
