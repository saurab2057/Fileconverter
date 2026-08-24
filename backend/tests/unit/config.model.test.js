// tests/unit/config.model.test.js
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { expect } from 'chai';
import Config from '../../models/Config.js';

describe('Config Model - Unit Tests', () => {
    let mongoServer;

    before(async () => {
        mongoServer = await MongoMemoryServer.create();
        await mongoose.connect(mongoServer.getUri());
    });

    after(async () => {
        await mongoose.disconnect();
        await mongoServer.stop();
    });

    afterEach(async () => {
        await Config.deleteMany({});
    });

    it('should create config with all default values', async () => {
        const config = await Config.create({ key: 'main_config' });

        expect(config.freeUserMaxFileSize).to.equal(50);
        expect(config.proUserMaxFileSize).to.equal(500);
        expect(config.maxJobsPerHour).to.equal(20);
        expect(config.maxProcessingTime).to.equal(300);
        expect(config.maxConcurrentJobs).to.equal(10);
        expect(config.enableRateLimit).to.equal(true);
        expect(config.enableFileTypeValidation).to.equal(true);
        expect(config.enableEmailNotifications).to.equal(true);
        expect(config.enableSlackAlerts).to.equal(false);
        expect(config.enableAutoBackup).to.equal(true);
        expect(config.logRetentionDays).to.equal(30);
    });

    it('should allow overriding default values', async () => {
        const config = await Config.create({
            key: 'main_config',
            freeUserMaxFileSize: 100,
            maxJobsPerHour: 50,
            enableRateLimit: false,
        });
        expect(config.freeUserMaxFileSize).to.equal(100);
        expect(config.maxJobsPerHour).to.equal(50);
        expect(config.enableRateLimit).to.equal(false);
    });

    it('should enforce unique key constraint', async () => {
        await Config.create({ key: 'main_config' });
        const duplicate = new Config({ key: 'main_config' });
        try {
            await duplicate.save();
            throw new Error('Expected save to throw');
        } catch (err) {
            expect(err).to.exist;
        }
    });

    it('Config.initialize() should create config if none exists', async () => {
        await Config.initialize();
        const config = await Config.findOne({ key: 'main_config' });
        expect(config).to.not.be.null;
    });

    it('Config.initialize() should NOT create duplicate if config already exists', async () => {
        await Config.initialize();
        await Config.initialize();

        const count = await Config.countDocuments({ key: 'main_config' });
        expect(count).to.equal(1);
    });

    it('should set timestamps on create', async () => {
        const config = await Config.create({ key: 'main_config' });
        expect(config.createdAt).to.exist;
        expect(config.updatedAt).to.exist;
    });
});