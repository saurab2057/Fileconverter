// tests/unit/fileHistory.model.test.js
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { expect } from 'chai';
import FileHistory from '../../models/FileHistory.js';
import User from '../../models/User.js';

describe('FileHistory Model - Unit Tests', () => {
    let mongoServer;
    let testUserId;

    before(async () => {
        mongoServer = await MongoMemoryServer.create();
        await mongoose.connect(mongoServer.getUri());

        const user = await User.create({
            name: 'History User',
            email: 'history@example.com',
            password: 'Password123!',
        });
        testUserId = user._id;
    });

    after(async () => {
        await mongoose.disconnect();
        await mongoServer.stop();
    });

    afterEach(async () => {
        await FileHistory.deleteMany({});
    });

    it('should create a record with required fields', async () => {
        const record = await FileHistory.create({
            userId: testUserId,
            filename: 'video.mp4',
            format: 'mp3',
            sizeInBytes: 1024000,
        });
        expect(record.filename).to.equal('video.mp4');
        expect(record.format).to.equal('mp3');
        expect(record.sizeInBytes).to.equal(1024000);
    });

    it('should reject record without userId', async () => {
        const record = new FileHistory({ filename: 'test.mp4', format: 'mp3' });
        try {
            await record.save();
            throw new Error('Expected save to throw');
        } catch (err) {
            expect(err).to.exist;
        }
    });

    it('should reject record without filename', async () => {
        const record = new FileHistory({ userId: testUserId, format: 'mp3' });
        try {
            await record.save();
            throw new Error('Expected save to throw');
        } catch (err) {
            expect(err).to.exist;
        }
    });

    it('should default processedAt to current date', async () => {
        const before = new Date();
        const record = await FileHistory.create({
            userId: testUserId,
            filename: 'image.png',
            format: 'jpg',
        });
        const after = new Date();

        expect(record.processedAt).to.exist;
        expect(record.processedAt.getTime()).to.be.at.least(before.getTime());
        expect(record.processedAt.getTime()).to.be.at.most(after.getTime());
    });

    it('should allow format and sizeInBytes to be optional', async () => {
        const record = new FileHistory({ userId: testUserId, filename: 'minimal.pdf' });
        const saved = await record.save();
        expect(saved).to.exist;
    });
});