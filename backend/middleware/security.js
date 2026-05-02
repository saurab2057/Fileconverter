// middleware/security.js
import morgan from 'morgan';
import cookieParser from 'cookie-parser';


// ─────────────────────────────────────────────────────────────
// CORS
// ─────────────────────────────────────────────────────────────
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:4173',
    'http://localhost:3000',
    process.env.FRONTEND_URL
].filter(Boolean);

const corsOptions = {
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('This origin is not allowed by the CORS policy.'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
    credentials: true,
};


// ─────────────────────────────────────────────────────────────
// HELMET / CSP
//
// reCAPTCHA v3 browser requirements (all three directives needed):
//
//   scriptSrc  → https://www.google.com   (api.js entry point)
//               https://www.gstatic.com  (additional scripts loaded by api.js)
//
//   connectSrc → https://www.google.com   (score API calls made by the
//                                          reCAPTCHA script at runtime)
//
//   frameSrc   → https://www.google.com   (reCAPTCHA badge iframe)
//
// Note: the server-side siteverify call (recaptchaMiddleware.js) is
// server-to-server via axios — it does not need a CSP entry.
// ─────────────────────────────────────────────────────────────
const helmetOptions = {
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'",
                "https://accounts.google.com/gsi/client",
                "https://apis.google.com",
                "https://www.google.com",   // reCAPTCHA v3 entry script
                "https://www.gstatic.com",  // reCAPTCHA v3 secondary scripts
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
                "https://res.cloudinary.com",
            ],
            frameSrc: [
                "'self'",
                "https://accounts.google.com",
                "https://www.google.com",   // reCAPTCHA v3 badge iframe
            ],
            connectSrc: [
                "'self'",
                "https://accounts.google.com",
                "https://www.googleapis.com",
                "https://www.google.com",   // reCAPTCHA v3 runtime API calls
                "https://api.resend.com",
            ],
            fontSrc: [
                "'self'",
                "https://fonts.gstatic.com",
            ],
            baseUri:                ["'self'"],
            formAction:             ["'self'"],
            objectSrc:              ["'none'"],
            upgradeInsecureRequests: [],
        },
    },
    hsts: {
        maxAge: 63072000, // 2 years
        includeSubDomains: true,
        preload: true,
    },
};


export {
    corsOptions,
    helmetOptions,
    cookieParser,
    morgan,
};