// --- CRON JOBS ---
import cron from 'node-cron';
import cluster from 'cluster';
import fs from 'fs/promises';
import path from 'path';
import User from './models/User.js';
import Session from './models/Session.js';
import FileHistory from './models/FileHistory.js';
import { logAdminAction } from './middleware/auditLogger.js';
import UserMetadata from './models/UserMetadata.js';

const BANNED_USER_TTL_DAYS = 30;

/**
 * 🔒 AUTO-DELETE BANNED USERS
 * Runs daily at midnight.
 * Finds users banned 30+ days ago and permanently deletes all their data.
 */
const autoDeleteBannedUsers = async () => {
    console.log('🕐 [CRON] Running auto-delete for expired banned users...');

    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - BANNED_USER_TTL_DAYS);

        // Find all users banned more than 30 days ago
        const expiredUsers = await User.find({
            status: 'banned',
            bannedAt: { $lte: cutoffDate }
        }).select('_id email name');

        if (expiredUsers.length === 0) {
            console.log('✅ [CRON] No expired banned users found.');
            return;
        }

        console.log(`🗑️ [CRON] Found ${expiredUsers.length} expired banned user(s) to delete.`);

        for (const user of expiredUsers) {
            try {
                const userId = user._id.toString();

                // 1. Delete all active sessions
                await Session.deleteMany({ user: user._id });

                // 2. Fetch and delete local files from disk
                const fileRecords = await FileHistory.find({ userId: user._id }).select('filePath outputPath');
                for (const record of fileRecords) {
                    // Delete input file if exists
                    if (record.filePath) {
                        try {
                            await fs.unlink(path.resolve(record.filePath));
                        } catch (e) {
                            // File may already be gone — not a fatal error
                            console.warn(`⚠️ [CRON] Could not delete file ${record.filePath}:`, e.message);
                        }
                    }
                    // Delete output file if exists
                    if (record.outputPath) {
                        try {
                            await fs.unlink(path.resolve(record.outputPath));
                        } catch (e) {
                            console.warn(`⚠️ [CRON] Could not delete file ${record.outputPath}:`, e.message);
                        }
                    }
                }

                // 3. Delete FileHistory records
                await FileHistory.deleteMany({ userId: user._id });

                // 4. Delete UserMetadata (GDPR Art.17 — right to erasure)
                await UserMetadata.deleteMany({ user: user._id });

                // 5. Delete the user document
                await User.findByIdAndDelete(user._id);

                // 6. Audit log the auto-deletion
                await logAdminAction(
                    null,           // ✅ No human actor — automated system action
                    'USER_DELETED',
                    `User:${userId}`,
                    {
                        reason: 'auto_delete_banned_user',
                        bannedAt: user.bannedAt,
                        deletedEmail: user.email,
                        deletedName: user.name,
                        filesDeleted: fileRecords.length
                    },
                    'system',
                    'cron-job',
                    'system'        // ✅ source = 'system' so audit log is clearly automated
                );

                console.log(`✅ [CRON] Deleted banned user: ${user.email} (${userId})`);

            } catch (userError) {
                // Don't let one failure stop the rest
                console.error(`🚨 [CRON] Failed to delete user ${user._id}:`, userError.message);
            }
        }

        console.log(`✅ [CRON] Auto-delete complete. Processed ${expiredUsers.length} user(s).`);

    } catch (error) {
        console.error('🚨 [CRON] Auto-delete cron job failed:', error);
    }
};

/**
 * 🔒 REGISTER ALL CRON JOBS
 * Call this once at app startup, after DB is connected.
 * 
 * ⚠️ CLUSTER GUARD: In production with clustering, cron jobs must only
 * run on the MASTER process — not on every worker. Without this guard,
 * auto-delete would fire N times (once per CPU core).
 */
export const registerCronJobs = () => {
    // In cluster mode, only the master process runs cron jobs
    if (cluster.isWorker) {
        console.log(`⏭️ [CRON] Skipping cron registration on worker ${process.pid}`);
        return;
    }

    // Runs every day at midnight UTC
    cron.schedule('0 0 * * *', autoDeleteBannedUsers, {
        timezone: 'UTC'
    });

    console.log('✅ [CRON] Cron jobs registered: auto-delete banned users @ midnight UTC');
};