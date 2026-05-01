// backend/index.js
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import cluster from 'cluster';
import os from 'os';

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

    const productionSecrets = [
        'CLOUDINARY_CLOUD_NAME',
        'CLOUDINARY_API_KEY',
        'CLOUDINARY_API_SECRET',
        'CLOUDCONVERT_API_KEY',
        'RESEND_API_KEY',
        'FRONTEND_URL',
        'RECAPTCHA_SECRET_KEY',
    ];

    const missing = [];
    const warnings = [];

    criticalSecrets.forEach(varName => {
        if (!process.env[varName]?.trim()) {
            missing.push(`❌ ${varName} (CRITICAL)`);
        } else if (process.env[varName].length < 32) {
            warnings.push(`⚠️ ${varName} too short (${process.env[varName].length})`);
        }
    });

    if (process.env.NODE_ENV === 'production') {
        productionSecrets.forEach(varName => {
            if (!process.env[varName]?.trim()) {
                missing.push(`❌ ${varName} (PRODUCTION REQUIRED)`);
            }
        });

        if (process.env.FRONTEND_URL?.includes('localhost')) {
            warnings.push('⚠️ FRONTEND_URL uses localhost in production');
        }

        if (!process.env.PORT || isNaN(Number(process.env.PORT))) {
            missing.push('❌ PORT must be valid in production');
        }
    }

    if (missing.length) {
        console.error('\n❌ FATAL ENV ERROR\n');
        missing.forEach(m => console.error(m));
        process.exit(1);
    }

    if (warnings.length) {
        console.warn('\n⚠️ WARNINGS\n');
        warnings.forEach(w => console.warn(w));
    }
}

validateEnvironmentVariables();

// ─────────────────────────────────────────────────────────────
// 🔧 COMMON BOOTSTRAP
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
// 🚀 WORKER (HTTP SERVER)
// ─────────────────────────────────────────────────────────────
async function startWorker() {
    const { default: app } = await import('./app.js');

    const PORT = process.env.PORT || 5000;

    await bootstrap();

    const server = app.listen(PORT, () => {
        console.log(`🚀 Worker ${process.pid} running on port ${PORT}`);
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
        console.log(`\n🚨 Worker ${process.pid} shutting down (${signal})`);

        try {
            await new Promise((resolve, reject) => {
                server.close(err => err ? reject(err) : resolve());
            });

            await mongoose.connection.close();

            console.log('✅ Worker shutdown complete');
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
// 🧠 MASTER (CLUSTER ORCHESTRATOR)
// ─────────────────────────────────────────────────────────────
async function startMaster() {
    const { registerCronJobs } = await import('./cronJobs.js');

    await bootstrap();

    // ✅ ONLY MASTER runs cron
    registerCronJobs();

    const numCPUs = os.cpus().length;

    console.log(`🔧 Master ${process.pid} starting ${numCPUs} workers`);

    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
        console.warn(`⚠️ Worker ${worker.process.pid} died. Restarting...`);
        cluster.fork();
    });
}

// ─────────────────────────────────────────────────────────────
// 🧭 ENTRYPOINT CONTROL
// ─────────────────────────────────────────────────────────────
async function start() {
    const isProd = process.env.NODE_ENV === 'production';

    if (isProd) {
        if (cluster.isPrimary) {
            await startMaster();
        } else {
            await startWorker();
        }
    } else {
        // Dev: single process = worker + cron
        const { registerCronJobs } = await import('./cronJobs.js');

        await bootstrap();
        registerCronJobs();
        await startWorker();
    }
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
// ▶️ START APP
// ─────────────────────────────────────────────────────────────
start().catch(err => {
    console.error('❌ Startup failed:', err);
    process.exit(1);
});


/*
You are still:
Connecting MongoDB in every worker
That’s correct for Node cluster, but:
👉 In very high-scale systems:
You’d introduce connection pooling strategies or move beyond cluster
For your level and CV:
✔️ This is exactly right
✔️ Don’t overcomplicate it further
*/
