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
// Must be imported after body-parsing middleware is set up (see mounting order below)
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
//
// Tell Express to trust the first proxy in the chain
// (Render / Railway / Nginx / Cloudflare). Without this:
//   - req.ip returns the proxy's IP instead of the client's IP
//   - Rate limiters key on the wrong IP
//   - WAF logs wrong IPs
// ─────────────────────────────────────────────────────────────
app.set('trust proxy', 1);

// ─────────────────────────────────────────────────────────────
// 🔒 FORCE HTTPS IN PRODUCTION
//
// Redirect all HTTP traffic to HTTPS when running in production.
// Trust proxy must be enabled for this to work behind Nginx/Cloudflare.
// ─────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && !req.secure) {
    return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
  }
  next();
});

// Hide the fact that this is an Express server.
// Helmet sets this too, but being explicit is safer.
app.disable('x-powered-by');


// ─────────────────────────────────────────────────────────────
// REQUEST ID MIDDLEWARE
//
// Attaches a unique UUID to every request so you can trace a
// specific request across all log lines in production.
// Also sent back to the client via X-Request-ID so frontend
// developers can include it in bug reports.
// ─────────────────────────────────────────────────────────────
app.use((req, res, next) => {
    req.id = crypto.randomUUID();
    res.setHeader('X-Request-ID', req.id);
    next();
});


// ─────────────────────────────────────────────────────────────
// CORE MIDDLEWARE STACK
//
// ORDER MATTERS — each middleware depends on the one before it:
//
//   cors        → must run before any route (preflight OPTIONS)
//   helmet      → sets security headers on every response
//   json        → parses JSON body into req.body (WAF reads this)
//   urlencoded  → parses form data into req.body (WAF reads this)
//   cookieParser→ parses cookies (auth middleware reads these)
//   morgan      → logs the request AFTER body is parsed
//
// The WAF is mounted AFTER these — it needs req.body to be
// populated before it can scan for injection patterns.
// ─────────────────────────────────────────────────────────────
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));        // handle preflight for all routes
app.use(helmet(helmetOptions));
app.use(express.json({ limit: '200kb' }));   // JSON bodies — 200KB cap
app.use(express.urlencoded({ limit: '1mb', extended: true })); // form bodies — 1MB cap
app.use(cookieParser());
app.use(morgan('dev'));


// ─────────────────────────────────────────────────────────────
// HEALTH CHECK — mounted BEFORE the WAF
//
// The health check endpoint receives no user input and carries
// no security risk, so there is no value in running it through
// the WAF. Keeping it before the WAF also means:
//   - Load balancer pings are never accidentally blocked
//   - Health checks don't pollute WAF metrics / logs
// ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({
        status:      'ok',
        uptime:      process.uptime(),      // seconds the server has been running
        db:          mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        timestamp:   new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});


// ─────────────────────────────────────────────────────────────
// WAF — mounted AFTER body parsers, BEFORE all route handlers
//
// Why AFTER body parsers:
//   The WAF inspects req.body and req.query for injection patterns.
//   If mounted before express.json(), req.body would be undefined
//   and the WAF would silently skip body scanning.
//
// Why BEFORE routes:
//   Every API request must pass through the WAF before reaching
//   any controller. Mounting it here as app.use() (not per-router)
//   guarantees no route can accidentally bypass it.
//
// Why AFTER health check:
//   See health check comment above.
// ─────────────────────────────────────────────────────────────
app.use(waf);


// ─────────────────────────────────────────────────────────────
// ROUTE HANDLERS
// All routes below are protected by the WAF above.
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
// STATIC FRONTEND — React build output
//
// Cache-Control is set to no-store for HTML files only.
// HTML must always be fresh so users get the latest app version.
// Static assets (JS/CSS/images) can be cached by the browser
// because they have content-hashed filenames from the React build.
// ─────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend/build'), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        }
    },
}));


// ─────────────────────────────────────────────────────────────
// 404 HANDLER — unknown API routes
//
// Must come AFTER all app.use('/api/...') route mounts and
// BEFORE the React catch-all below, so unknown API calls get
// a proper JSON error instead of the React index.html.
// ─────────────────────────────────────────────────────────────
app.all('/api/*', (req, res, next) => {
    next(new AppError(`API route not found: ${req.originalUrl}`, 404));
});


// ─────────────────────────────────────────────────────────────
// REACT CATCH-ALL — must be the very last route
//
// Returns index.html for any non-API, non-static request so that
// React Router can handle client-side navigation (e.g. /dashboard,
// /reset-password, /login). Without this, a hard refresh on any
// non-root path would return a 404 from Express.
// ─────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
});


// ─────────────────────────────────────────────────────────────
// GLOBAL ERROR HANDLER — must be the very last middleware
//
// Express identifies error-handling middleware by its 4-argument
// signature (err, req, res, next). It catches errors thrown by
// routes and passed via next(err).
// ─────────────────────────────────────────────────────────────
app.use(globalErrorHandler);

export default app;