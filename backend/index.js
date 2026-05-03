// backend/index.js
import dotenv from 'dotenv';
import mongoose from 'mongoose';

// ─────────────────────────────────────────────────────────────
// 🔒 STEP 1: LOAD ENV
// ─────────────────────────────────────────────────────────────
dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || '.env' });

// ─────────────────────────────────────────────────────────────
// 🔒 STEP 2: ENV VALIDATION
// ─────────────────────────────────────────────────────────────
function validateEnvironmentVariables() {
    const criticalSecrets = [
        "ACCESS_SECRET_KEY",
        "REFRESH_SECRET_KEY",
        "COOKIE_SECRET_KEY",
        "RESET_PASSWORD_SECRET_KEY",
        "MONGO_URI",
    ];

    const serviceSecrets = [
        'CLOUDINARY_CLOUD_NAME',
        'CLOUDINARY_API_KEY',
        'CLOUDINARY_API_SECRET',
        'CLOUDCONVERT_API_KEY',
        'RESEND_API_KEY',
        'FRONTEND_URL',
        'RECAPTCHA_SECRET_KEY',
        'EMAIL_FROM',
        'ADMIN_EMAIL',
        'INTERNAL_API_KEY',
        'AUDIT_CHECKPOINT_SALT',
        'IP_HASH_SALT',
    ];

    const optionalWarnings = [
        { key: 'HF_TOKEN', msg: 'Hugging Face token missing – AI features will be disabled' },
        { key: 'AI_SUMMARIZE_URL', msg: 'AI summarization service URL missing' },
        { key: 'RP_NAME', msg: 'WebAuthn RP_NAME is not set' },
        { key: 'RP_ID', msg: 'WebAuthn RP_ID is not set' },
        { key: 'RP_ORIGIN', msg: 'WebAuthn RP_ORIGIN is not set' },
    ];

    const missing = [];
    const warnings = [];

    // Critical secrets
    criticalSecrets.forEach(varName => {
        if (!process.env[varName]?.trim()) {
            missing.push(`❌ ${varName} (CRITICAL)`);
        } else if (process.env[varName].length < 32) {
            warnings.push(`⚠️ ${varName} too short (${process.env[varName].length})`);
        }
    });

    // Service secrets – mandatory in production, warning in dev
    serviceSecrets.forEach(varName => {
        if (!process.env[varName]?.trim()) {
            if (process.env.NODE_ENV === 'production') {
                missing.push(`❌ ${varName} (REQUIRED IN PRODUCTION)`);
            } else {
                warnings.push(`⚠️ ${varName} is empty – some features may fail`);
            }
        }
    });

    // Additional production checks
    if (process.env.NODE_ENV === 'production') {
        if (process.env.FRONTEND_URL?.includes('localhost')) {
            warnings.push('⚠️ FRONTEND_URL uses localhost in production');
        }
        if (!process.env.PORT || isNaN(Number(process.env.PORT))) {
            missing.push('❌ PORT must be a valid number in production');
        }
    }

    // Optional but recommended
    optionalWarnings.forEach(({ key, msg }) => {
        if (!process.env[key]?.trim()) {
            warnings.push(`ℹ️ ${key}: ${msg}`);
        }
    });

    if (missing.length) {
        console.error('\n❌ FATAL ENV ERROR\n');
        missing.forEach(m => console.error(m));
        process.exit(1);
    }

    if (warnings.length) {
        console.warn('\n⚠️ ENV WARNINGS\n');
        warnings.forEach(w => console.warn(w));
    }
}

validateEnvironmentVariables();

// ─────────────────────────────────────────────────────────────
// 🔧 COMMON BOOTSTRAP (DB + Config)
// ─────────────────────────────────────────────────────────────
async function bootstrap() {
    const connectDB = await import('./config/db.js');
    const { default: Config } = await import('./models/Config.js');

    await connectDB.default();

    try {
        await Config.initialize();
        console.log('✅ Config initialized');
    } catch (err) {
        console.warn('⚠️ Config init failed:', err.message);
    }
}

// ─────────────────────────────────────────────────────────────
// 🚀 SINGLE PROCESS: HTTP SERVER + CRON JOBS
// ─────────────────────────────────────────────────────────────
async function startServer() {
    const { default: app } = await import('./app.js');
    const { registerCronJobs } = await import('./cronJobs.js');

    const PORT = process.env.PORT || 5000;

    // 1. Connect to MongoDB and initialize configuration
    await bootstrap();

    // 2. Register cron jobs (only once, perfect in single process)
    registerCronJobs();

    // 3. Start listening
    const server = app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT} [PID ${process.pid}]`);
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
        console.log(`\n🚨 Shutting down (${signal})`);

        try {
            await new Promise((resolve, reject) => {
                server.close(err => err ? reject(err) : resolve());
            });
            await mongoose.connection.close();
            console.log('✅ Shutdown complete');
            process.exit(0);
        } catch (err) {
            console.error('💥 Shutdown error:', err);
            process.exit(1);
        }
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
}

// ─────────────────────────────────────────────────────────────
// ❌ GLOBAL ERROR HANDLERS
// ─────────────────────────────────────────────────────────────
process.on('unhandledRejection', (err) => {
    console.error('💥 UNHANDLED REJECTION', err);
    process.exit(1);
});

process.on('uncaughtException', (err) => {
    console.error('💥 UNCAUGHT EXCEPTION', err);
    process.exit(1);
});

// ─────────────────────────────────────────────────────────────
// ▶️ ENTRYPOINT
// ─────────────────────────────────────────────────────────────
startServer().catch(err => {
    console.error('❌ Startup failed:', err);
    process.exit(1);
});