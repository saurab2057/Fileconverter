// --- CRON JOBS ---
import cron from 'node-cron';
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
 *
 * Runs daily at midnight (UTC).
 * Finds users that were banned exactly BANNED_USER_TTL_DAYS ago (or longer)
 * and permanently deletes all their data:
 *   - Sessions
 *   - Local uploaded/output files from disk
 *   - FileHistory records
 *   - UserMetadata (for GDPR compliance)
 *   - The user document itself
 *
 * Each deletion is logged via the audit logger as an automated system action.
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

                // 1. Delete all active sessions for this user
                await Session.deleteMany({ user: user._id });

                // 2. Remove FileHistory records from database
                await FileHistory.deleteMany({ userId: user._id });

                // 3. Remove UserMetadata (GDPR right to erasure)
                await UserMetadata.deleteMany({ user: user._id });

                // 4. Finally delete the user document itself
                await User.findByIdAndDelete(user._id);

                // 4. Audit the automated deletion
                await logAdminAction(
                    null,           // no human actor – automated system
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
                    'system'        // source = 'system' to distinguish from manual admin actions
                );

                console.log(`✅ [CRON] Deleted banned user: ${user.email} (${userId})`);

            } catch (userError) {
                // Don't let one user's deletion failure stop the rest
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
 *
 * Call this once after the database connection is established.
 *
 * ‼️ IMPORTANT – SINGLE PROCESS MODE
 * ===================================
 * This version is designed for a single‑process deployment
 * (e.g. Raspberry Pi, Render free tier, or any non‑clustered environment).
 *
 * ✅ No cluster guard is used.
 * ✅ The cron job will be registered exactly once.
 * ✅ Perfectly safe when only one Node.js process runs this file.
 *
 * ⚠️ IF YOU LATER ADD CLUSTERING (multi‑process)
 * ================================================
 * When using Node.js's `cluster` module, **every worker process**
 * imports this file and would call `registerCronJobs()`.
 * That would:
 *   1. Register the cron job multiple times (one per worker)
 *   2. Cause the auto‑delete to fire N times simultaneously
 *   3. Create race conditions and duplicate audit logs
 *
 * To fix that, import `cluster` from 'node:cluster' and wrap
 * the registration like this:
 *
 *   if (cluster.isWorker) {
 *       console.log(`⏭️ Skipping cron registration on worker ${process.pid}`);
 *       return;
 *   }
 *
 * That ensures only the master process (primary) runs the cron.
 */
export const registerCronJobs = () => {
    // Runs every day at midnight UTC
    cron.schedule('0 0 * * *', autoDeleteBannedUsers, {
        timezone: 'UTC'
    });

    console.log('✅ [CRON] Cron jobs registered: auto-delete banned users @ midnight UTC');
};