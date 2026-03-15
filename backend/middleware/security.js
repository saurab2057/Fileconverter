import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import cors from 'cors';

// --- CORS OPTIONS ---
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

// --- HELMET OPTIONS (FIXED & OPTIMIZED) ---
const helmetOptions = {
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'",
                "https://accounts.google.com/gsi/client", // ✅ Fixed: Removed trailing spaces
                "https://apis.google.com"
            ],
            styleSrc: [
                "'self'",
                "https://accounts.google.com",
                "https://fonts.googleapis.com"
            ],
            imgSrc: [
                "'self'",
                "data:",
                "https://lh3.googleusercontent.com",
                "https://lh4.googleusercontent.com",
                "https://*.googleusercontent.com",
                "https://res.cloudinary.com",
            ],
            frameSrc: [
                "'self'",
                "https://accounts.google.com"
            ],
            connectSrc: [
                "'self'",
                "https://accounts.google.com",
                "https://www.googleapis.com",
                "https://api.resend.com"
            ],
            fontSrc: [
                "'self'",
                "https://fonts.gstatic.com"
            ],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: []
        },
    },
    hsts: {
        maxAge: 63072000, // 2 years in seconds
        includeSubDomains: true,
        preload: true,
    },
};

// --- EXPORT EVERYTHING ---
export {
    corsOptions,
    helmetOptions,
    cookieParser,
    morgan,
};