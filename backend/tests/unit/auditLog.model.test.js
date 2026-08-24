// tests/unit/auditLog.model.test.js
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { expect } from 'chai';
import AuditLog from '../../models/AuditLog.js';
import User from '../../models/User.js';

describe('AuditLog Model - Unit Tests', () => {
    let mongoServer;
    let testUserId;

    before(async () => {
        mongoServer = await MongoMemoryServer.create();
        await mongoose.connect(mongoServer.getUri());

        const user = await User.create({
            name: 'Audit User',
            email: 'audit@example.com',
            password: 'Password123!',
        });
        testUserId = user._id;
    });

    after(async () => {
        await mongoose.disconnect();
        await mongoServer.stop();
    });

    afterEach(async () => {
        await mongoose.connection.collection('auditlogs').deleteMany({});
    });

    const validLog = () => ({
        action: 'USER_UPDATED',
        resource: 'User:123',
        ipAddress: '127.0.0.1',
        userAgent: 'TestAgent/1.0',
    });

    it('should create a valid audit log', async () => {
        const log = await AuditLog.create({ ...validLog(), userId: testUserId });
        expect(log.action).to.equal('USER_UPDATED');
        expect(log.resource).to.equal('User:123');
    });

    it('should default source to "admin"', async () => {
        const log = await AuditLog.create({ ...validLog(), userId: testUserId });
        expect(log.source).to.equal('admin');
    });

    it('should allow userId to be null (system/cron actions)', async () => {
        const log = new AuditLog({ ...validLog(), userId: null });
        const saved = await log.save();
        expect(saved).to.exist;
    });

    it('should reject log without required action', async () => {
        const log = new AuditLog({
            resource: 'User:123',
            ipAddress: '127.0.0.1',
            userAgent: 'Agent',
        });
        try {
            await log.save();
            throw new Error('Expected save to throw');
        } catch (err) {
            expect(err).to.exist;
        }
    });

    it('should reject log with invalid action enum', async () => {
        const log = new AuditLog({ ...validLog(), action: 'INVALID_ACTION' });
        try {
            await log.save();
            throw new Error('Expected save to throw');
        } catch (err) {
            expect(err).to.exist;
        }
    });

    it('should reject log without required resource', async () => {
        const log = new AuditLog({
            action: 'USER_UPDATED',
            ipAddress: '127.0.0.1',
            userAgent: 'Agent',
        });
        try {
            await log.save();
            throw new Error('Expected save to throw');
        } catch (err) {
            expect(err).to.exist;
        }
    });

    it('should reject log without ipAddress', async () => {
        const log = new AuditLog({
            action: 'USER_UPDATED',
            resource: 'User:123',
            userAgent: 'Agent',
        });
        try {
            await log.save();
            throw new Error('Expected save to throw');
        } catch (err) {
            expect(err).to.exist;
        }
    });

    it('should prevent modification of existing audit log (immutable via pre-save)', async () => {
        const log = await AuditLog.create({ ...validLog(), userId: testUserId });
        log.action = 'CONFIG_UPDATED';
        try {
            await log.save();
            throw new Error('Expected save to throw');
        } catch (err) {
            expect(err.message).to.match(/immutable/i);
        }
    });

    it('should accept all valid action enum values', async () => {
        const validActions = [
            'USER_UPDATED', 'USER_BANNED', 'USER_DELETED',
            'CONFIG_UPDATED', 'JOB_DELETED', 'ADMIN_LOGIN',
        ];
        for (const action of validActions) {
            const log = new AuditLog({ ...validLog(), action });
            const saved = await log.save();
            expect(saved).to.exist;
            await mongoose.connection.collection('auditlogs').deleteMany({});
        }
    });

    // ─────────────────────────────────────────────────────────────
    // 🔒 NEW TESTS FOR ADDED DELETION HOOKS (AuditLog immutability)
    // ─────────────────────────────────────────────────────────────
    // WHY THESE TESTS WERE ADDED:
    //   The original hooks only blocked doc.deleteOne().
    //   We added new hooks to also block Model.deleteOne({}) and
    //   Model.findOneAndDelete() to ensure true immutability.
    //   These tests verify those new hooks work correctly.
    // ─────────────────────────────────────────────────────────────

    it('should block Model.deleteOne({}) (query pre-hook)', async () => {
        // Arrange: Create a log first
        const log = await AuditLog.create({ ...validLog(), userId: testUserId });
        
        // Act: Try to delete it using Model.deleteOne() (not doc.deleteOne)
        try {
            await AuditLog.deleteOne({ _id: log._id });
            throw new Error('Expected delete to throw');
        } catch (err) {
            // Assert: Expect the immutability error from our new query hook
            expect(err.message).to.match(/cannot be deleted|immutable/i);
        }

        // Verify the log still exists
        const stillExists = await AuditLog.findById(log._id);
        expect(stillExists).to.exist;
    });

    it('should block Model.findOneAndDelete()', async () => {
        // Arrange: Create a log first
        const log = await AuditLog.create({ ...validLog(), userId: testUserId });

        // Act: Try to delete it using findOneAndDelete
        try {
            await AuditLog.findOneAndDelete({ _id: log._id });
            throw new Error('Expected delete to throw');
        } catch (err) {
            // Assert: Expect the immutability error from our new hook
            expect(err.message).to.match(/cannot be deleted|immutable/i);
        }

        // Verify the log still exists
        const stillExists = await AuditLog.findById(log._id);
        expect(stillExists).to.exist;
    });

    it('should block Model.findByIdAndDelete() (uses findOneAndDelete internally)', async () => {
        // Arrange: Create a log first
        const log = await AuditLog.create({ ...validLog(), userId: testUserId });

        // Act: Try to delete it using findByIdAndDelete
        try {
            await AuditLog.findByIdAndDelete(log._id);
            throw new Error('Expected delete to throw');
        } catch (err) {
            // Assert: Expect the immutability error from our new hook
            expect(err.message).to.match(/cannot be deleted|immutable/i);
        }

        // Verify the log still exists
        const stillExists = await AuditLog.findById(log._id);
        expect(stillExists).to.exist;
    });

    it('should block Model.deleteMany({}) (already existed, but keep test)', async () => {
        // Arrange: Create a log first
        await AuditLog.create({ ...validLog(), userId: testUserId });

        // Act: Try to delete all
        try {
            await AuditLog.deleteMany({});
            throw new Error('Expected delete to throw');
        } catch (err) {
            expect(err.message).to.match(/cannot be bulk deleted/i);
        }

        // Verify the log still exists
        const count = await AuditLog.countDocuments();
        expect(count).to.equal(1);
    });

    // ─────────────────────────────────────────────────────────────
    // EXTRA: Verify doc.deleteOne() still works (existing hook)
    // ─────────────────────────────────────────────────────────────
    it('should block doc.deleteOne() (existing document pre-hook)', async () => {
        const log = await AuditLog.create({ ...validLog(), userId: testUserId });
        try {
            await log.deleteOne();
            throw new Error('Expected delete to throw');
        } catch (err) {
            expect(err.message).to.match(/cannot be deleted/i);
        }
        const stillExists = await AuditLog.findById(log._id);
        expect(stillExists).to.exist;
    });
});