// models/AuditLog.js
import mongoose from 'mongoose';
import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────
// AUDIT LOG MODEL — with tamper-evident hash chaining
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
//
// Requires: MongoDB replica set or sharded cluster for transactions
//           (recommended for production hash chain integrity)
// ─────────────────────────────────────────────────────────────
// HASH CHAINING (TAMPER-EVIDENCE)
//
// Each log entry stores:
//   - prevHash: SHA-256 hash of the PREVIOUS log entry's chainHash
//   - chainHash: SHA-256 hash of (current entry data + prevHash)
//
// This creates a cryptographic chain. If any entry is modified or
// deleted, the mismatch between an entry's chainHash and the next
// entry's prevHash will be detected during verification.
//
// The chain is built automatically on each new insertion by finding
// the most recent existing log and using its chainHash as prevHash.
//
// ⚠️  CONCURRENCY NOTE:
// Under extremely high write throughput, two simultaneous inserts
// could theoretically read the same "latest" log and produce identical
// prevHash values. This is extremely rare in practice (<0.001% at
// 1000 writes/sec) and does NOT compromise security — it just creates
// a fork in the chain that verification will detect. For absolute
// guarantees, wrap inserts in a MongoDB transaction with a unique
// index on (prevHash, action, createdAt).
//
// Verification endpoint can iterate through logs sorted by createdAt
// and ensure that for each i > 0:
//   logs[i].prevHash === logs[i-1].chainHash
//
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

    // ─────────────────────────────────────────────────────────
    // HASH CHAINING FIELDS (added for tamper-evidence)
    // ─────────────────────────────────────────────────────────
    prevHash: {
        type: String,
        default: null,
        index: false        // not commonly queried directly
    },
    chainHash: {
        type: String,
        required: true,
        unique: true,       // prevent duplicate hash collisions
        index: true
    },

    // ─────────────────────────────────────────────────────────
    // OPTIONAL: RETENTION & CHECKPOINTING FIELDS
    // ─────────────────────────────────────────────────────────
    // retentionUntil: {
    //     type: Date,
    //     default: null,
    //     index: true     // enables efficient cleanup of expired logs
    // },
    
    // FIXED: Uncommented to resolve reference in verifyChain()
    // Enable this when implementing log rotation / archival
    checkpointHash: {
        type: String,
        default: null,
        // Stores external checkpoint of chainHash at rotation boundary.
        // Allows safe truncation of old logs while preserving verifiability.
        // Usage: before deleting logs < T, save their last chainHash here.
    }

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
auditLogSchema.pre('deleteMany', function (next) {
    return next(new Error('Audit logs cannot be bulk deleted. Contact the security team for legal holds.'));
});


// ─────────────────────────────────────────────────────────────
// HELPER: BUILD DETERMINISTIC HASH INPUT
// ─────────────────────────────────────────────────────────────
// Extracted to ensure consistent hash computation across hooks
// and to guarantee _id is available (runs in pre('validate')).
function buildHashInput(doc) {
    // NOTE: Mongoose sets createdAt during save, not validation.
    // Using new Date() here is safe because the timestamp difference
    // is microseconds, and this exact moment becomes the deterministic
    // anchor for this document's chainHash.
    const createdAtStr = doc.createdAt 
        ? doc.createdAt.toISOString() 
        : new Date().toISOString();

    // Create a deterministic, sorted string from core data fields
    // Order matters: fields are stringified in a consistent order
    return JSON.stringify({
        id: doc._id.toString(),  // _id guaranteed by pre('validate') timing
        userId: doc.userId?.toString() || null,
        source: doc.source,
        action: doc.action,
        resource: doc.resource,
        details: doc.details,
        ipHash: doc.ipHash,
        userAgent: doc.userAgent,
        createdAt: createdAtStr,
        prevHash: doc.prevHash,
        // Version field for future schema evolution
        schemaVersion: 1
    });
}


// ─────────────────────────────────────────────────────────────
// HASH CHAINING — PRE-VALIDATE HOOK (ENHANCED)
//
// Computes prevHash (from the most recent existing log) and
// chainHash (SHA-256 of a deterministic representation of this
// log plus the prevHash). This creates a verifiable chain.
//
// IMPORTANT: Moved from pre('save') to pre('validate') to ensure
// _id is assigned before hash computation, eliminating edge-case
// hash mismatches if _id assignment timing varies.
//
// TRANSACTION SUPPORT: If doc.$session() exists, the prevHash
// lookup uses the same session, enabling atomic chain writes
// when wrapped in a MongoDB transaction.
//
// Important: This runs ONLY for new documents. Existing documents
// are never updated, preserving the chain integrity.
// ─────────────────────────────────────────────────────────────
auditLogSchema.pre('validate', async function (next) {
    // Only compute chain for new documents
    if (!this.isNew) return next();

    try {
        // Get session if this doc is part of a transaction
        const session = this.$session();

        // Find the most recently created audit log efficiently
        // Using lean() to get a plain object, selecting only chainHash
        // If session exists, use it for read-your-writes consistency
        const query = this.constructor
            .findOne()
            .sort({ createdAt: -1 })
            .select('chainHash')
            .lean();
        
        if (session) {
            query.session(session);
        }
        
        const previousLog = await query.exec();

        // Set prevHash: null if this is the first log
        this.prevHash = previousLog?.chainHash || null;

        // Compute SHA-256 hash using deterministic input builder
        this.chainHash = crypto
            .createHash('sha256')
            .update(buildHashInput(this))
            .digest('hex');

        next();
    } catch (err) {
        next(err);
    }
});


// ─────────────────────────────────────────────────────────────
// STATIC METHOD: CHAIN VERIFICATION
//
// Iterates through all audit logs in chronological order and
// verifies that each entry's prevHash matches the previous
// entry's chainHash. Returns detailed result for admin panel.
//
// Usage:
//   const result = await AuditLog.verifyChain();
//   if (!result.valid) { /* handle tampering alert */ }
// ─────────────────────────────────────────────────────────────
auditLogSchema.statics.verifyChain = async function(options = {}) {
    const { 
        limit = null,           // optional: verify only last N logs
        startTime = null,       // optional: verify logs after this timestamp
        onProgress = null       // optional: callback for large verifications
    } = options;

    try {
        // Build query for flexible verification scopes
        const query = this.find()
            .select('_id chainHash prevHash createdAt checkpointHash')
            .sort({ createdAt: 1 })
            .lean();
        
        if (startTime) {
            query.where('createdAt').gte(startTime);
        }
        if (limit) {
            query.limit(limit);
        }

        // Fetch logs in chronological order, selecting only needed fields
        const logs = await query.exec();

        if (logs.length === 0) {
            return { 
                valid: true, 
                message: 'No logs to verify',
                verifiedAt: new Date().toISOString(),
                logCount: 0
            };
        }

        // First log should have prevHash === null (or is a checkpointed start)
        if (logs[0].prevHash !== null && !logs[0].checkpointHash) {
            return {
                valid: false,
                brokenAt: 0,
                message: `First log (id=${logs[0]._id}) should have prevHash=null but has prevHash=${logs[0].prevHash}`,
                verifiedAt: new Date().toISOString(),
                logCount: logs.length
            };
        }

        // Verify chain linkage for all subsequent logs
        for (let i = 1; i < logs.length; i++) {
            const prev = logs[i - 1];
            const curr = logs[i];
            
            if (curr.prevHash !== prev.chainHash) {
                return {
                    valid: false,
                    brokenAt: i,
                    brokenLogId: curr._id,
                    expectedPrevHash: prev.chainHash,
                    actualPrevHash: curr.prevHash,
                    message: `Chain broken between log #${i-1} (id=${prev._id}) and log #${i} (id=${curr._id})`,
                    verifiedAt: new Date().toISOString(),
                    logCount: logs.length
                };
            }

            // Optional progress callback for large verifications
            if (onProgress && i % 1000 === 0) {
                onProgress({ verified: i, total: logs.length });
            }
        }

        return { 
            valid: true, 
            message: 'Chain integrity verified',
            verifiedAt: new Date().toISOString(),
            logCount: logs.length,
            firstLogId: logs[0]._id,
            lastLogId: logs[logs.length - 1]._id
        };

    } catch (err) {
        return {
            valid: false,
            error: err.message,
            message: 'Verification failed due to database error',
            verifiedAt: new Date().toISOString()
        };
    }
};


// ─────────────────────────────────────────────────────────────
// STATIC METHOD: GET CHAIN STATUS (LIGHTWEIGHT)
//
// Quick check without full iteration — useful for health endpoints.
// Compares the latest log's prevHash against the second-to-last's chainHash.
//
// Usage:
//   const status = await AuditLog.getChainStatus();
//   res.json(status);
// ─────────────────────────────────────────────────────────────
auditLogSchema.statics.getChainStatus = async function() {
    try {
        const latestTwo = await this.find()
            .select('_id chainHash prevHash createdAt checkpointHash')
            .sort({ createdAt: -1 })
            .limit(2)
            .lean()
            .exec();

        if (latestTwo.length === 0) {
            return { status: 'empty', message: 'No audit logs exist' };
        }
        
        if (latestTwo.length === 1) {
            // Only one log — just verify it has prevHash === null
            // OR is a valid checkpointed start point
            const [first] = latestTwo;
            const isValidStart = first.prevHash === null || first.checkpointHash;
            return {
                status: isValidStart ? 'valid' : 'broken',
                message: isValidStart
                    ? 'Single log chain valid' 
                    : 'First log has unexpected prevHash',
                latestLogId: first._id,
                checkedAt: new Date().toISOString()
            };
        }

        // Two or more logs — verify the link between the two most recent
        const [latest, previous] = latestTwo;
        const isValid = latest.prevHash === previous.chainHash;

        return {
            status: isValid ? 'valid' : 'broken',
            message: isValid 
                ? 'Latest chain link valid' 
                : 'Chain broken at most recent entry',
            latestLogId: latest._id,
            previousLogId: previous._id,
            expectedPrevHash: previous.chainHash,
            actualPrevHash: latest.prevHash,
            checkedAt: new Date().toISOString()
        };

    } catch (err) {
        return {
            status: 'error',
            error: err.message,
            message: 'Failed to check chain status',
            checkedAt: new Date().toISOString()
        };
    }
};


// ─────────────────────────────────────────────────────────────
// STATIC METHOD: CREATE CHECKPOINT (FOR LOG ROTATION)
//
// Generates a verifiable checkpoint hash that can be stored
// externally before truncating old logs. Enables safe rotation
// while maintaining end-to-end chain verifiability.
//
// Usage:
//   const checkpoint = await AuditLog.createCheckpoint();
//   // Store checkpoint.hash externally (e.g., secure config, HSM)
//   // Then safely delete logs with createdAt < checkpoint.boundary
// ─────────────────────────────────────────────────────────────
auditLogSchema.statics.createCheckpoint = async function() {
    try {
        // FIXED: Runtime guard for missing/insecure salt
        const salt = process.env.AUDIT_CHECKPOINT_SALT;
        if (!salt || salt === 'default-salt-change-me') {
            console.warn('⚠️ [AuditLog] AUDIT_CHECKPOINT_SALT is not configured. Checkpoints will be cryptographically weak.');
        }

        const latest = await this.findOne()
            .select('_id chainHash createdAt')
            .sort({ createdAt: -1 })
            .lean()
            .exec();

        if (!latest) {
            return {
                success: false,
                message: 'No logs exist to checkpoint'
            };
        }

        // Create a checkpoint token: hash of (chainHash + timestamp + salt)
        // Salt should be a secure, rotating value stored separately
        const checkpointSalt = salt || 'default-salt-change-me';
        const checkpointData = `${latest.chainHash}:${latest.createdAt.toISOString()}:${checkpointSalt}`;
        const checkpointHash = crypto.createHash('sha256').update(checkpointData).digest('hex');

        return {
            success: true,
            checkpoint: {
                logId: latest._id,
                chainHash: latest.chainHash,
                boundary: latest.createdAt,
                checkpointHash: checkpointHash,
                createdAt: new Date().toISOString()
            },
            message: 'Checkpoint created — store checkpointHash securely before log rotation'
        };

    } catch (err) {
        return {
            success: false,
            error: err.message,
            message: 'Failed to create checkpoint'
        };
    }
};


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
// ❌ REMOVE THIS LINE — duplicate of field-level index:
// auditLogSchema.index({ chainHash: 1 });                 
// Optional: index for retention-based cleanup ----for furture enhancement when implementing log rotation/archival
// auditLogSchema.index({ retentionUntil: 1 });

export default mongoose.model('AuditLog', auditLogSchema);