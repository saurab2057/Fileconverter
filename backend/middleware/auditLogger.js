import AuditLog from '../models/AuditLog.js';
import ActivityLog from '../models/ActivityLog.js';
import { hashIP } from '../utils/authSecurity.js';

// 🔒 ADMIN AUDIT LOGGING — compliance-grade, immutable, admin actions only
// source: 'admin' for human actions, 'system' for cron/automated actions
export const logAdminAction = async (userId, action, resource, details, ipAddress, userAgent, source = 'admin') => {
    

    if (process.env.NODE_ENV === 'test') return;  // In tests, we skip logging to avoid clutter and external dependencies 

    
    try {
        const ipHash = hashIP(ipAddress);

        await AuditLog.create({
            userId: userId || null,  // ✅ null for system/cron actions
            source,                  // ✅ 'admin' or 'system'
            action,
            resource,
            details,
            ipAddress: ipAddress || 'unknown',
            ipHash,
            userAgent: userAgent || 'unknown'
        });
        console.log(`✅ AUDIT: [${source.toUpperCase()}] ${action} on ${resource} by ${userId || 'system'}`);
    } catch (error) {
        console.error('🚨 CRITICAL: Audit log failed (main action succeeded):', error);
    }
};

// 🔒 USER ACTIVITY LOGGING — tracks user-initiated events (login, signup, password reset etc.)
// Separate from admin audit logs — different compliance requirements
export const logUserActivity = async (userId, action, resource, details, ipAddress, userAgent) => {
    try {
        const ipHash = hashIP(ipAddress);

        await ActivityLog.create({
            userId,
            action,
            resource,
            details,
            ipAddress: ipAddress || 'unknown',
            ipHash,
            userAgent: userAgent || 'unknown'
        });
        console.log(`✅ ACTIVITY: ${action} on ${resource} by user ${userId}`);
    } catch (error) {
        console.error('🚨 CRITICAL: Activity log failed (main action succeeded):', error);
    }
};