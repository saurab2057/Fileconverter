// tests/unit/userMetadata.model.test.js
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { expect } from 'chai';
import UserMetadata from '../../models/UserMetadata.js';
import User from '../../models/User.js';

describe('UserMetadata Model - Unit Tests', () => {
    let mongoServer;
    let testUserId;

    before(async () => {
        mongoServer = await MongoMemoryServer.create();
        await mongoose.connect(mongoServer.getUri());

        const user = await User.create({
            name: 'Meta User',
            email: 'meta@example.com',
            password: 'Password123!',
        });
        testUserId = user._id;
    });

    after(async () => {
        await mongoose.disconnect();
        await mongoServer.stop();
    });

    afterEach(async () => {
        await UserMetadata.deleteMany({});
    });

    it('should create metadata with all fields', async () => {
        const meta = await UserMetadata.create({
            user: testUserId,
            ipHash: 'hashed-ip-123',
            location: { country: 'NP', region: 'Bagmati', city: 'Kathmandu' },
            device: { type: 'desktop', browser: 'Chrome', os: 'Windows' },
            userAgent: 'Mozilla/5.0',
        });
        expect(meta.user.toString()).to.equal(testUserId.toString());
        expect(meta.location.country).to.equal('NP');
        expect(meta.device.browser).to.equal('Chrome');
    });

    it('should allow creating metadata without optional fields', async () => {
        const meta = new UserMetadata({ user: testUserId });
        const saved = await meta.save();
        expect(saved).to.exist;
    });

    it('should allow multiple metadata entries per user (login history)', async () => {
        await UserMetadata.create({ user: testUserId, ipHash: 'hash1' });
        await UserMetadata.create({ user: testUserId, ipHash: 'hash2' });

        const entries = await UserMetadata.find({ user: testUserId });
        expect(entries.length).to.equal(2);
    });

    it('should default createdAt to current date', async () => {
        const before = new Date();
        const meta = await UserMetadata.create({ user: testUserId });
        const after = new Date();

        expect(meta.createdAt.getTime()).to.be.at.least(before.getTime());
        expect(meta.createdAt.getTime()).to.be.at.most(after.getTime());
    });

    it('should store hashed IP not raw IP', async () => {
        const meta = await UserMetadata.create({ user: testUserId, ipHash: 'sha256-hashed-value' });
        expect(meta.ipHash).to.equal('sha256-hashed-value');
        expect(meta.ip).to.be.undefined;
    });
});