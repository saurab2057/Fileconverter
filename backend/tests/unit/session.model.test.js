import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { expect } from 'chai';
import Session from '../../models/Session.js';
import User from '../../models/User.js';

describe('Session Model - Unit Tests', () => {
    let mongoServer;
    let testUserId;

    before(async () => {
        mongoServer = await MongoMemoryServer.create();

        await mongoose.connect(mongoServer.getUri());

        // Make sure all indexes, including unique indexes, exist
        await Session.syncIndexes();

        const user = await User.create({
            name: 'Session User',
            email: 'session@example.com',
            password: 'Password123!',
        });

        testUserId = user._id;
    });

    after(async () => {
        await mongoose.disconnect();
        await mongoServer.stop();
    });

    afterEach(async () => {
        await Session.deleteMany({});
    });

    const validSessionData = (
        user = testUserId,
        jti = 'unique-jti-123',
        deviceId = 'test-device-id'
    ) => ({
        user,
        jti,
        deviceId,
        userAgent: 'Mozilla/5.0',
        ipHash: 'hashed-ip',
    });

    it('should create a session with required fields', async () => {
        const session = await Session.create(validSessionData());

        expect(session.user.toString()).to.equal(testUserId.toString());
        expect(session.jti).to.equal('unique-jti-123');
        expect(session.deviceId).to.equal('test-device-id');
    });

    it('should reject session without a user reference', async () => {
        const session = new Session({
            jti: 'no-user-jti',
            deviceId: 'device',
        });

        try {
            await session.save();
            throw new Error('Expected save to throw');
        } catch (err) {
            expect(err).to.exist;
        }
    });

    it('should reject session without a jti', async () => {
        const session = new Session({
            user: testUserId,
            deviceId: 'device',
        });

        try {
            await session.save();
            throw new Error('Expected save to throw');
        } catch (err) {
            expect(err).to.exist;
        }
    });

    it('should reject session without a deviceId', async () => {
        const session = new Session({
            user: testUserId,
            jti: 'no-device-jti',
        });

        try {
            await session.save();
            throw new Error('Expected save to throw');
        } catch (err) {
            expect(err).to.exist;
            expect(err.errors.deviceId).to.exist;
        }
    });

    it('should reject duplicate jti (unique constraint)', async () => {
        // First session
        await Session.create(
            validSessionData(testUserId, 'same-jti', 'device1')
        );

        // Duplicate jti
        const duplicate = new Session(
            validSessionData(testUserId, 'same-jti', 'device2')
        );

        let error;

        try {
            await duplicate.save();
        } catch (err) {
            error = err;
        }

        expect(error).to.exist;
        expect(error).to.have.property('code', 11000);
    });

    it('should set default createdAt and lastActive', async () => {
        const session = await Session.create(validSessionData());

        expect(session.createdAt).to.exist;
        expect(session.lastActive).to.exist;
    });

    it('should allow multiple sessions per user with different JTIs and different deviceIds', async () => {
        await Session.create(
            validSessionData(testUserId, 'jti-device-1', 'device-1')
        );

        await Session.create(
            validSessionData(testUserId, 'jti-device-2', 'device-2')
        );

        const sessions = await Session.find({
            user: testUserId,
        });

        expect(sessions.length).to.equal(2);
    });
});