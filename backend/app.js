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

// 🔒 ROUTE IMPORTS (Updated to plural names)
import authRoutes from './routes/authRoute.js';
import userRoutes from './routes/userRoute.js';
import chatRoutes from './routes/chatbotRoute.js';
import conversionRoutes from './routes/conversionRoute.js';
import historyRoutes from './routes/historyRoute.js';
import adminRoutes from './routes/adminRoute.js';
import aiRoutes from './routes/aisummarizerRoute.js';
import compressionRoutes from './routes/compressionRoute.js'

// 🔒 ERROR HANDLING IMPORTS (Updated path & exports)
import { AppError, globalErrorHandler } from './middleware/errorHandling.js';
import mongoose from 'mongoose';

// Get __dirname equivalent in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();


// ✅ Trust the first proxy (Render/Railway/Nginx/Cloudflare)
// Without this: req.ip = proxy IP, rate limiting breaks in production
app.set('trust proxy', 1);

// ✅ Never tell attackers you use Express
// Helmet does this too but being explicit is safer
app.disable('x-powered-by');

// --- REQUEST ID MIDDLEWARE ---
// Attaches a unique ID to every request so you can trace
// a specific request across all log messages in production
app.use((req, res, next) => {
    req.id = crypto.randomUUID();          // unique ID per request
    res.setHeader('X-Request-ID', req.id); // send it back in response headers too
    next();
});

// --- APPLY MIDDLEWARES ---
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(helmet(helmetOptions));
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));
app.use(cookieParser());
app.use(morgan('dev'));

// --- HEALTH CHECK ---
// Used by load balancers and deployment platforms (Render, Railway etc.)
// to check if the server is alive and database is connected
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),          // how long server has been running (seconds)
        db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});


// --- MOUNT ROUTES ---
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);           
app.use('/api/chat', chatRoutes);
app.use('/api/convert', conversionRoutes);
app.use('/api/compress', compressionRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);

// --- SERVE FRONTEND (React App) ---
app.use(express.static(path.join(__dirname, '../frontend/build'), { // ✅ Updated: client → frontend
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        }
    },
}));

// --- 404 HANDLER for unknown API routes ---
app.all('/api/*', (req, res, next) => {
    next(new AppError(`API route not found: ${req.originalUrl}`, 404));
});

// --- SERVE FRONTEND (React catch-all MUST be last) ---
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
});

// --- GLOBAL ERROR HANDLER ---
app.use(globalErrorHandler);

export default app;