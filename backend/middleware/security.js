// middleware/security.js
import morgan from 'morgan';
import cookieParser from 'cookie-parser';


// ─────────────────────────────────────────────────────────────
// CORS
// ─────────────────────────────────────────────────────────────
const allowedOrigins = [
    'http://localhost:5173', // Vite dev server
    'http://localhost:4173', // Vite preview server
    'http://localhost:3000', // local backend/frontend testing
    process.env.FRONTEND_URL // deployed frontend
].filter(Boolean);

const corsOptions = {
    origin: (origin, callback) => {
        // allow no-origin requests (server-to-server, curl, mobile apps)
        // and requests from whitelisted origins only
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('This origin is not allowed by the CORS policy.'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // allowed HTTP verbs
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'], // headers the client is allowed to send
    credentials: true, // allow cookies/auth headers to be sent cross-origin
};


// ─────────────────────────────────────────────────────────────
// HELMET / CSP
// Note: the server-side siteverify call (recaptchaMiddleware.js) is
// server-to-server via axios — it does not need a CSP entry.
// ─────────────────────────────────────────────────────────────
const helmetOptions = {
    crossOriginEmbedderPolicy: false, // disabled — would block some third-party embeds (Google, Cloudinary) otherwise
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }, // needed so Google OAuth popup flow can communicate back
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"], // fallback: only allow same-origin by default

            scriptSrc: [
                "'self'",
                "https://accounts.google.com/gsi/client", // Google Identity Services (login button/script)
                "https://apis.google.com",                // Google API client library
                "https://www.google.com",   // reCAPTCHA v3 entry script
                "https://www.gstatic.com",  // reCAPTCHA v3 secondary scripts
            ],

            styleSrc: [
                "'self'",
                "https://accounts.google.com", // styles injected by Google login widget
                "https://fonts.googleapis.com", // Google Fonts stylesheet
            ],

            imgSrc: [
                "'self'",
                "data:", // inline/base64 images
                "https://*.googleusercontent.com", // Google user profile pictures
                "https://lh3.googleusercontent.com", // Google profile pic CDN (variant)
                "https://lh4.googleusercontent.com", // Google profile pic CDN (variant)
                "https://res.cloudinary.com", // app's image hosting/CDN
            ],

            frameSrc: [
                "'self'",
                "https://accounts.google.com", // Google login popup/iframe
                "https://www.google.com",   // reCAPTCHA v3 badge iframe
            ],

            connectSrc: [
                "'self'",
                "https://accounts.google.com", // OAuth token exchange calls
                "https://www.googleapis.com",  // Google API calls (e.g. userinfo)
                "https://www.google.com",   // reCAPTCHA v3 runtime API calls
                "https://api.resend.com", // transactional email API (called from client, if any)
            ],

            fontSrc: [
                "'self'",
                "https://fonts.gstatic.com", // Google Fonts font files
            ],

            baseUri: ["'self'"],   // prevents <base> tag hijacking (protects relative URLs)
            formAction: ["'self'"], // forms can only submit to same origin
            objectSrc: ["'none'"], // blocks <object>/<embed>/<applet> — legacy plugin vectors
            upgradeInsecureRequests: [], // auto-upgrade http:// requests to https://

            // 🔒 PREVENT CLICKJACKING
            // Blocks all attempts to embed your site in iframes.
            frameAncestors: ["'none'"],
        },
    },
    hsts: {
        maxAge: process.env.NODE_ENV === 'production' ? 63072000 : 0, // 2 years — force HTTPS for this long once seen
        includeSubDomains: true, // apply HSTS to all subdomains too
        preload: true, // eligible for browser HSTS preload lists
    },
    noSniff: true,
    // Note: Helmet sets X-Content-Type-Options: nosniff by default.
};


export {
    corsOptions,
    helmetOptions,
    cookieParser,
    morgan,
};