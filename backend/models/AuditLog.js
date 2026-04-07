// models/AuditLog.js
import mongoose from 'mongoose';

// ─────────────────────────────────────────────────────────────
// AUDIT LOG MODEL
//
// Compliance-grade, append-only log for admin and system actions.
// User-initiated events (login, signup, password reset) go to
// ActivityLog — that's a separate collection with different
// retention and compliance requirements.
//
// Immutability is enforced at the Mongoose hook level:
//   - pre('save')      → blocks modification of existing documents
//   - pre('deleteOne') → blocks single document deletion via code
//   - pre('deleteMany')→ blocks bulk deletion via code
//
// The admin panel deleteAuditLog endpoint also returns 403 — that
// is the application-level guard. These hooks are the DB-level guard.
//
// Sources:
//   'admin'  → a human admin performed an action via the admin panel
//   'system' → automated action (cron job, WAF, background task)
// ─────────────────────────────────────────────────────────────
const auditLogSchema = new mongoose.Schema({

    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false,    // null for system/cron/WAF actions (no human actor)
        index: true
    },

    source: {
        type: String,
        enum: ['admin', 'system'],
        default: 'admin',
        index: true         // filter by human vs automated in admin panel
    },

    action: {
        type: String,
        required: true,
        enum: [
            // ── Human admin actions ───────────────────────────────────
            'USER_UPDATED',     // admin changed role or status
            'USER_BANNED',      // admin banned a user
            'USER_DELETED',     // admin or cron permanently deleted a user
            'CONFIG_UPDATED',   // admin changed system configuration
            'JOB_DELETED',      // admin deleted a conversion/compression job
            'ADMIN_LOGIN',      // admin logged in (reserved for future use)

            // ── Automated system actions ──────────────────────────────
            // WAF_BLOCKED: fired by waf.js whenever a request is rejected.
            // source will always be 'system' for these entries.
            // This action was NOT in the original enum — it was added
            // alongside waf.js. Deploy this file BEFORE or AT THE SAME
            // TIME as waf.js, otherwise AuditLog.create() calls from the
            // WAF will fail schema validation and silently fall back to
            // console.warn only (the WAF still blocks the request, but
            // the DB audit trail is lost for that event).
            'WAF_BLOCKED',
        ],
        index: true
    },

    resource: {
        type: String,
        required: true,     // e.g. "GET /api/auth/login" or "User:507f1f77bcf86cd799439011"
    },

    details: {
        type: Object,
        default: {},        // flexible — each action type stores different details
    },

    ipAddress: {
        type: String,
        required: true,     // raw IP for incident response / forensics
    },

    ipHash: {
        type: String,
        index: true         // hashed IP for GDPR-compliant cross-query analysis
    },

    userAgent: {
        type: String,
        required: true,
    },

}, {
    timestamps: true,       // adds createdAt and updatedAt automatically
    toJSON:   { virtuals: true },
    toObject: { virtuals: true }
});


// ─────────────────────────────────────────────────────────────
// IMMUTABILITY HOOKS
//
// Audit logs are compliance records. Once written they must not
// change. These hooks enforce that at the Mongoose layer so no
// code path — however deeply buried — can silently mutate them.
// ─────────────────────────────────────────────────────────────

// Block in-place modification of an existing document
auditLogSchema.pre('save', function (next) {
    if (!this.isNew && this.isModified()) {
        return next(new Error('Audit logs are immutable. Cannot modify after creation.'));
    }
    next();
});

// Block deletion of a single document via doc.deleteOne()
auditLogSchema.pre('deleteOne', { document: true }, function (next) {
    return next(new Error('Audit logs cannot be deleted. Contact the security team for legal holds.'));
});

// Block bulk deletion via Model.deleteMany() or query.deleteMany()
// This covers both the model-level call and the query-level call
auditLogSchema.pre('deleteMany', function (next) {
    return next(new Error('Audit logs cannot be bulk deleted. Contact the security team for legal holds.'));
});


// ─────────────────────────────────────────────────────────────
// INDEXES
//
// Compound indexes are ordered by the most selective field first
// to match how the admin panel queries them:
//   - by user (who did it?)
//   - by IP (where did it come from?)
//   - by action (what happened?)
//   - recency (when? — always sorted -1)
// ─────────────────────────────────────────────────────────────
auditLogSchema.index({ userId: 1,    createdAt: -1 });  // filter by user
auditLogSchema.index({ ipAddress: 1, createdAt: -1 });  // filter by raw IP (incident response)
auditLogSchema.index({ ipHash: 1,    createdAt: -1 });  // filter by hashed IP (GDPR queries)
auditLogSchema.index({ action: 1,    createdAt: -1 });  // filter by action type — useful for WAF_BLOCKED queries

export default mongoose.model('AuditLog', auditLogSchema);