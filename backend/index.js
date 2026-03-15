// backend/index.js
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import cluster from 'cluster';
import os from 'os';

// 🔒 STEP 1: LOAD ENV IMMEDIATELY
dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || '.env' });

// 🔒 STEP 2: CRITICAL ENV VALIDATION (HALTS STARTUP ON MISSING SECRETS)
function validateEnvironmentVariables() {
    // CRITICAL SECRETS (MUST EXIST IN ALL ENVIRONMENTS)
    const criticalSecrets = [
        "ACCESS_SECRET_KEY",
        "REFRESH_SECRET_KEY",
        "COOKIE_SECRET_KEY",
        "RESET_PASSWORD_SECRET_KEY",
        "MONGO_URI",
    ];

    // PRODUCTION-ONLY SECRETS (REQUIRED ONLY IN PRODUCTION)
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

    // Validate critical secrets (all environments)
    criticalSecrets.forEach(varName => {
        if (!process.env[varName] || process.env[varName].trim() === '') {
            missing.push(`❌ ${varName} (CRITICAL - required in all environments)`);
        } else if (process.env[varName].length < 32) {
            warnings.push(`⚠️ ${varName} is too short (${process.env[varName].length} chars). Minimum 32 recommended.`);
        }
    });

    // Validate production secrets (only in production)
    if (process.env.NODE_ENV === 'production') {
        productionSecrets.forEach(varName => {
            if (!process.env[varName] || process.env[varName].trim() === '') {
                missing.push(`❌ ${varName} (REQUIRED IN PRODUCTION)`);
            }
        });

        // Production-specific validations
        if (process.env.FRONTEND_URL?.startsWith('http://localhost')) {
            warnings.push('⚠️ FRONTEND_URL uses localhost in production. Must be HTTPS domain.');
        }
        if (!process.env.PORT || isNaN(Number(process.env.PORT))) {
            missing.push('❌ PORT must be a valid number in production');
        }
    }

    // EXIT ON CRITICAL ERRORS
    if (missing.length > 0) {
        console.error('\n' + '='.repeat(70));
        console.error('❌ FATAL: MISSING ENVIRONMENT VARIABLES');
        console.error('='.repeat(70));
        missing.forEach(msg => console.error(msg));
        console.error('\n💡 FIX: Create .env file with all required variables');
        console.error('   Example: cp .env.example .env && nano .env');
        console.error('='.repeat(70) + '\n');
        process.exit(1);
    }

    // LOG WARNINGS (don't exit, just inform)
    if (warnings.length > 0) {
        console.warn('\n' + '='.repeat(70));
        console.warn('⚠️ SECURITY WARNINGS');
        console.warn('='.repeat(70));
        warnings.forEach(msg => console.warn(msg));
        console.warn('='.repeat(70) + '\n');
    }
}

// 🔒 STEP 3: RUN VALIDATION BEFORE ANYTHING ELSE
validateEnvironmentVariables();

// --- REST OF STARTUP LOGIC ---
async function startServer() {
    const { default: app } = await import('./app.js');
    const connectDB = await import('./config/db.js');
    const { default: Config } = await import('./models/Config.js');
    const { registerCronJobs } = await import('./cronJobs.js');

    const PORT = process.env.PORT || 5000;

    // Connect to database
    await connectDB.default();

    // Initialize default config
    try {
        await Config.initialize();
        console.log('✅ Default config initialized');
    } catch (err) {
        console.error('⚠️ Failed to initialize default config:', err.message);
    }

    // ✅ Register cron jobs AFTER DB is connected and config is ready
    // ⚠️ Cluster guard inside registerCronJobs ensures only master process runs them
    registerCronJobs();

    // Clustering for scalability (production only)
    if (process.env.NODE_ENV === 'production' && cluster.isMaster) {
        const numCPUs = os.cpus().length;
        console.log(`🔧 Master process ${process.pid} started. Forking ${numCPUs} workers...`);
        
        for (let i = 0; i < numCPUs; i++) {
            cluster.fork();
        }

        cluster.on('exit', (worker, code, signal) => {
            console.log(`⚠️ Worker ${worker.process.pid} died (code: ${code}, signal: ${signal}). Forking new one...`);
            cluster.fork();
        });
    } else {
        // Development mode (single process)
        if (process.env.NODE_ENV !== 'test') {
            const server = app.listen(PORT, () => {
                console.log(`\n🚀 Backend server running in ${process.env.NODE_ENV} mode`);
                console.log(`📍 URL: http://localhost:${PORT}`);
                console.log(`🔖 PID: ${process.pid}`);
                console.log(`📅 Time: ${new Date().toISOString()}\n`);
            });

            // Graceful shutdown handler
            const gracefulShutdown = async (signal) => {
                console.log(`\n🚨 Received ${signal}. Starting graceful shutdown...`);
                try {
                    await new Promise((resolve, reject) => {
                        server.close((err) => {
                            if (err) return reject(err);
                            console.log('✅ HTTP server closed.');
                            resolve();
                        });
                    });
                    await mongoose.connection.close();
                    console.log('✅ MongoDB connection closed.');
                    console.log('✅ Graceful shutdown completed.');
                    process.exit(0);
                } catch (err) {
                    console.error('💥 Error during graceful shutdown:', err);
                    process.exit(1);
                }
            };

            process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
            process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        }
    }
}

// --- GLOBAL ERROR HANDLERS ---
process.on('unhandledRejection', (err) => {
    console.error('💥 UNHANDLED REJECTION! Shutting down...', err);
    process.exit(1);
});

process.on('uncaughtException', (err) => {
    console.error('💥 UNCAUGHT EXCEPTION! Shutting down...', err);
    process.exit(1);
});

// --- START APPLICATION ---
startServer().catch(err => {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
});