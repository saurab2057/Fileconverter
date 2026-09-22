// backend/app.js
import express from 'express';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

// 🔒 SECURITY IMPORTS
import {
    corsOptions,
    helmetOptions,
    cookieParser,
    morgan,
} from './middleware/security.js';
import helmet from 'helmet';
import cors from 'cors';

// 🔒 WAF IMPORT
import { waf } from './middleware/waf.js';

// 🔒 CLIENT IP
import { getClientIp } from './utils/clientIp.js';

// 🔒 ROUTE IMPORTS
import authRoutes        from './routes/authRoute.js';
import userRoutes        from './routes/userRoute.js';
import chatRoutes        from './routes/chatbotRoute.js';
import conversionRoutes  from './routes/conversionRoute.js';
import historyRoutes     from './routes/historyRoute.js';
import adminRoutes       from './routes/adminRoute.js';
import aiRoutes          from './routes/aisummarizerRoute.js';
import compressionRoutes from './routes/compressionRoute.js';
import passkeyRoutes     from './routes/passkeyRoute.js';

// 🔒 ERROR HANDLING
import { AppError, globalErrorHandler } from './middleware/errorHandling.js';
import mongoose from 'mongoose';

// ES Module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app = express();


// ─────────────────────────────────────────────────────────────
// PROXY TRUST
// ─────────────────────────────────────────────────────────────
// Render sits behind one trusted proxy layer for Express.
//
// NOTE:
// req.ip is not being used by our security/IP metadata logic.
// Client IP extraction is centralized in getClientIp().
// ─────────────────────────────────────────────────────────────
app.set('trust proxy', 1);


// ─────────────────────────────────────────────────────────────
// 🔒 FORCE HTTPS IN PRODUCTION
// ─────────────────────────────────────────────────────────────
app.use((req, res, next) => {
    if (process.env.NODE_ENV === 'production' && !req.secure) {
        return res.redirect(
            301,
            `https://${req.headers.host}${req.originalUrl}`
        );
    }

    next();
});

app.disable('x-powered-by');


// ─────────────────────────────────────────────────────────────
// REQUEST ID MIDDLEWARE
// ─────────────────────────────────────────────────────────────
app.use((req, res, next) => {
    req.id = crypto.randomUUID();
    res.setHeader('X-Request-ID', req.id);
    next();
});


// ─────────────────────────────────────────────────────────────
// ⚠️ EXPRESS 5 WARNING
//
// If you upgrade Express from v4 to v5, the wildcard syntax `'*'`
// changes to `'/{*splat}'` for route matching.
//
// ❌ Express 4:
// app.options('*', cors(corsOptions));
//
// ✅ Express 5:
// app.options('/{*splat}', cors(corsOptions));
//
// The same change applies to:
//     app.all('/api/*', ...) → app.all('/api/{*splat}', ...)
//     app.get('*', ...)      → app.get('/{*splat}', ...)
// ─────────────────────────────────────────────────────────────
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(helmet(helmetOptions));


// ─────────────────────────────────────────────────────────────
// 🔒 PAYLOAD SIZE LIMITS – ROUTE-SPECIFIC
//
// ORDER MATTERS: more specific routes must come BEFORE
// less specific ones. We mount route-specific parsers
// BEFORE the global parser so Express picks the right one.
// ─────────────────────────────────────────────────────────────

// 1. STRICT LIMIT for AUTH routes (15 KB)
app.use('/api/auth', express.json({ limit: '15kb' }));

// Auth never uses URL-encoded forms, but if it did:
// app.use('/api/auth', express.urlencoded({
//     limit: '15kb',
//     extended: true
// }));

// 2. ADMIN routes (100 KB)
app.use('/api/admin', express.json({ limit: '100kb' }));
app.use('/api/admin', express.urlencoded({
    limit: '100kb',
    extended: true
}));

// 3. GLOBAL fallback (200 KB)
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({
    limit: '200kb',
    extended: true
}));


// ─────────────────────────────────────────────────────────────
// OTHER MIDDLEWARE
// ─────────────────────────────────────────────────────────────
app.use(cookieParser());


// ─────────────────────────────────────────────────────────────
// SAFE REQUEST LOGGING
//
// Never log query strings.
//
// OAuth codes, reset tokens, state values, session identifiers,
// API keys, etc. can appear in URLs.
// ─────────────────────────────────────────────────────────────
morgan.token('safe-url', (req) => req.baseUrl + req.path);

app.use(
    morgan(
        ':method :safe-url :status :res[content-length] - :response-time ms'
    )
);


// ─────────────────────────────────────────────────────────────
// HEALTH CHECK – before WAF
// ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        db: mongoose.connection.readyState === 1
            ? 'connected'
            : 'disconnected',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});


// ─────────────────────────────────────────────────────────────
// 🔒 GLOBAL WAF – SKIP FOR MULTIPART UPLOAD ROUTES
//
// The global WAF runs on every request EXCEPT these three
// path groups:
//
//     - /api/convert/*
//     - /api/compress/*
//     - /api/ai/*
//
// Why we skip them at the GLOBAL level:
//
// 1. These endpoints handle file uploads using
//    multipart/form-data.
//
// 2. At this point (before multer runs), req.body is EMPTY.
//
// 3. The global WAF would therefore scan nothing useful.
//
// 4. Scanning raw multipart payloads containing binary data
//    can cause false positives and unnecessary CPU overhead.
//
// 5. The global WAF's injection/XSS checks rely on parsed
//    fields, which do not exist yet.
//
// How these routes are STILL protected:
//
// - Each route applies the WAF after multer has parsed
//   the request.
//
// - The route-level WAF scans actual req.body fields such as
//   settings and toFormat.
//
// - Controllers additionally call validateFileSecurity()
//   for deep file-level checks such as steganography,
//   entropy analysis, and related security checks.
//
// Therefore:
//
//     Global skip + route-level WAF = secure and efficient.
// ─────────────────────────────────────────────────────────────
app.use((req, res, next) => {
    if (
        req.path.startsWith('/api/convert') ||
        req.path.startsWith('/api/compress') ||
        req.path.startsWith('/api/ai')
    ) {
        return next();
    }

    return waf(req, res, next);
});


// ─────────────────────────────────────────────────────────────
// ROUTE HANDLERS
// ─────────────────────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/user',      userRoutes);
app.use('/api/chat',      chatRoutes);
app.use('/api/convert',   conversionRoutes);
app.use('/api/compress',  compressionRoutes);
app.use('/api/history',   historyRoutes);
app.use('/api/admin',     adminRoutes);
app.use('/api/ai',        aiRoutes);
app.use('/api/passkeys',  passkeyRoutes);


// ─────────────────────────────────────────────────────────────
// 404 CATCH-ALL HANDLERS
//
// The React frontend is hosted separately on Vercel, so this
// Express server on Render operates purely as a headless REST API.
//
// Static file serving and React index.html delivery are removed
// because Vercel handles frontend assets and CDN caching.
//
// Route matching uses dual-pattern arrays to support both
// Express v4 and Express v5 syntax.
// ─────────────────────────────────────────────────────────────

// 1. Unmatched API endpoints
app.all(['/api/*', '/api/{*splat}'], (req, res, next) => {
    next(
        new AppError(
            `API route not found: ${req.originalUrl}`,
            404
        )
    );
});


// 2. Global unmatched routes
app.all(['*', '/{*splat}'], (req, res, next) => {
    next(
        new AppError(
            `Route not found on API server: ${req.originalUrl}`,
            404
        )
    );
});


// ─────────────────────────────────────────────────────────────
// GLOBAL ERROR HANDLER
// ─────────────────────────────────────────────────────────────
app.use(globalErrorHandler);

export default app;