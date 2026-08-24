// tests/unit/activityLog.model.test.js
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { expect } from 'chai';
import ActivityLog from '../../models/ActivityLog.js';
import User from '../../models/User.js';

describe('ActivityLog Model - Unit Tests', () => {
    let mongoServer;
    let testUserId;

    before(async () => {
        mongoServer = await MongoMemoryServer.create();
        await mongoose.connect(mongoServer.getUri());

        const user = await User.create({
            name: 'Activity User',
            email: 'activity@example.com',
            password: 'Password123!',
        });
        testUserId = user._id;
    });

    after(async () => {
        await mongoose.disconnect();
        await mongoServer.stop();
    });

    afterEach(async () => {
        await ActivityLog.deleteMany({});
    });

    const validLog = (userId) => ({
        userId,
        action: 'USER_LOGIN',
        resource: 'User:123',
        ipAddress: '127.0.0.1',
        userAgent: 'TestAgent/1.0',
    });

    it('should create a valid activity log', async () => {
        const log = await ActivityLog.create(validLog(testUserId));
        expect(log.action).to.equal('USER_LOGIN');
        expect(log.userId.toString()).to.equal(testUserId.toString());
    });

    it('should reject log without userId', async () => {
        const log = new ActivityLog({
            action: 'USER_LOGIN',
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
        const log = new ActivityLog({ ...validLog(testUserId), action: 'INVALID_ACTION' });
        try {
            await log.save();
            throw new Error('Expected save to throw');
        } catch (err) {
            expect(err).to.exist;
        }
    });

    it('should default details to empty object', async () => {
        const log = await ActivityLog.create(validLog(testUserId));
        expect(log.details).to.deep.equal({});
    });

    it('should auto-set createdAt timestamp', async () => {
        const log = await ActivityLog.create(validLog(testUserId));
        expect(log.createdAt).to.exist;
    });

    it('should accept all valid action enum values', async () => {
        const validActions = [
            'USER_LOGIN',
            'USER_CREATED',
            'PASSWORD_RESET_REQUESTED',
            'PASSWORD_RESET_COMPLETED',
            'SESSION_REVOKED',
        ];
        for (const action of validActions) {
            const log = new ActivityLog({ ...validLog(testUserId), action });
            const saved = await log.save();
            expect(saved).to.exist;
            await ActivityLog.deleteMany({});
        }
    });
});