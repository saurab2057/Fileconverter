// backend/app.js
import express from 'express';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

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

// 🔒 ROUTE IMPORTS
import authRoutes       from './routes/authRoute.js';
import userRoutes       from './routes/userRoute.js';
import chatRoutes       from './routes/chatbotRoute.js';
import conversionRoutes from './routes/conversionRoute.js';
import historyRoutes    from './routes/historyRoute.js';
import adminRoutes      from './routes/adminRoute.js';
import aiRoutes         from './routes/aisummarizerRoute.js';
import compressionRoutes from './routes/compressionRoute.js';
import passkeyRoutes    from './routes/passkeyRoute.js';

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
app.set('trust proxy', 1);

// ─────────────────────────────────────────────────────────────
// 🔒 FORCE HTTPS IN PRODUCTION
// ─────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && !req.secure) {
    return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
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
// CORE MIDDLEWARE STACK
// ─────────────────────────────────────────────────────────────
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(helmet(helmetOptions));

// ─────────────────────────────────────────────────────────────
// 🔒 PAYLOAD SIZE LIMITS – ROUTE‑SPECIFIC
//    ORDER MATTERS: more specific routes must come BEFORE
//    less specific ones. We mount the route‑specific parsers
//    BEFORE the global parser so Express picks the right one.
// ─────────────────────────────────────────────────────────────

// 1. STRICT LIMIT for AUTH routes (15 KB) – login, signup, tokens, etc.
app.use('/api/auth', express.json({ limit: '15kb' }));
// Auth never uses URL‑encoded forms, but if it did, we'd also set:
// app.use('/api/auth', express.urlencoded({ limit: '15kb', extended: true }));

// 2. ADMIN routes (100 KB) – config updates can be larger
app.use('/api/admin', express.json({ limit: '100kb' }));
app.use('/api/admin', express.urlencoded({ limit: '100kb', extended: true }));

// 3. GLOBAL fallback (200 KB) – for all other JSON endpoints
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ limit: '200kb', extended: true }));

// ─────────────────────────────────────────────────────────────
// OTHER MIDDLEWARE (run after body parsing)
// ─────────────────────────────────────────────────────────────
app.use(cookieParser());
app.use(morgan('dev'));


// ─────────────────────────────────────────────────────────────
// HEALTH CHECK – before WAF
// ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({
        status:      'ok',
        uptime:      process.uptime(),
        db:          mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        timestamp:   new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});


// ─────────────────────────────────────────────────────────────
// WAF – mounted after body parsers, before routes
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
// STATIC FRONTEND
// ─────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend/build'), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        }
    },
}));


// ─────────────────────────────────────────────────────────────
// 404 HANDLER – unknown API routes
// ─────────────────────────────────────────────────────────────
app.all('/api/*', (req, res, next) => {
    next(new AppError(`API route not found: ${req.originalUrl}`, 404));
});


// ─────────────────────────────────────────────────────────────
// REACT CATCH‑ALL
// ─────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
});


// ─────────────────────────────────────────────────────────────
// GLOBAL ERROR HANDLER
// ─────────────────────────────────────────────────────────────
app.use(globalErrorHandler);

export default app;