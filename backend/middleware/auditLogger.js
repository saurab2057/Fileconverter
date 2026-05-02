// middleware/auditLogger.js
import AuditLog from '../models/AuditLog.js';
import ActivityLog from '../models/ActivityLog.js';
import { hashIP } from '../utils/authSecurity.js';


// ─────────────────────────────────────────────────────────────
// ADMIN AUDIT LOG
//
// Compliance-grade, append-only record of admin and system actions.
// source: 'admin' for human actors, 'system' for cron / automated jobs.
// userId: null when source is 'system' (no human actor).
//
// Non-fatal: a logging failure must never roll back the action that
// triggered it. Errors are caught and logged to console only.
// ─────────────────────────────────────────────────────────────
export const logAdminAction = async (userId, action, resource, details, ipAddress, userAgent, source = 'admin') => {
    if (process.env.NODE_ENV === 'test') return;

    try {
        await AuditLog.create({
            userId: userId || null,
            source,
            action,
            resource,
            details,
            ipAddress: ipAddress || 'unknown',
            ipHash: hashIP(ipAddress),
            userAgent: userAgent || 'unknown'
        });
        console.log(`✅ AUDIT: [${source.toUpperCase()}] ${action} on ${resource} by ${userId || 'system'}`);
    } catch (error) {
        console.error('🚨 CRITICAL: Audit log failed (main action succeeded):', error);
    }
};


// ─────────────────────────────────────────────────────────────
// USER ACTIVITY LOG
//
// Tracks user-initiated events (login, signup, passkey, etc.).
// Kept separate from AuditLog — different retention and compliance
// requirements. AuditLog is for admin/system actions; this is for
// user behaviour.
//
// Non-fatal: same reasoning as logAdminAction above.
// ─────────────────────────────────────────────────────────────
export const logUserActivity = async (userId, action, resource, details, ipAddress, userAgent) => {
    if (process.env.NODE_ENV === 'test') return; // matches logAdminAction — avoids DB writes in tests

    try {
        await ActivityLog.create({
            userId,
            action,
            resource,
            details,
            ipAddress: ipAddress || 'unknown',
            ipHash: hashIP(ipAddress),
            userAgent: userAgent || 'unknown'
        });
        console.log(`✅ ACTIVITY: ${action} on ${resource} by user ${userId}`);
    } catch (error) {
        console.error('🚨 CRITICAL: Activity log failed (main action succeeded):', error);
    }
};