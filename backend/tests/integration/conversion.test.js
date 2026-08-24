// tests/integration/conversion.test.js
import request from 'supertest';
import { expect } from 'chai';
import app from '../../app.js';
import { setCloudConvertClient } from '../../controllers/conversionController.js';
import { setup, teardown } from '../setup.js';

// ─────────────────────────────────────────────────────────
// Real MP4 magic bytes — passes file-type security check
// ─────────────────────────────────────────────────────────
const MP4_MAGIC = Buffer.from([
    0x00, 0x00, 0x00, 0x18,
    0x66, 0x74, 0x79, 0x70,
    0x69, 0x73, 0x6F, 0x6D,
    0x00, 0x00, 0x00, 0x00,
    0x69, 0x73, 0x6F, 0x6D,
    0x6D, 0x70, 0x34, 0x31
]);

// ─────────────────────────────────────────────────────────
// Mock CloudConvert client — never hits real API
// ─────────────────────────────────────────────────────────
const MOCK_DOWNLOAD_URL = 'https://storage.cloudconvert.com/mock/output.mp3';

const mockJob = {
    id: 'mock-job-id',
    tasks: [
        { name: 'import-1', operation: 'import/upload', status: 'finished' }
    ]
};

const mockFinishedJob = {
    id: 'mock-job-id',
    tasks: [
        { name: 'import-1', operation: 'import/upload', status: 'finished' },
        { name: 'convert-1', operation: 'convert', status: 'finished' },
        {
            name: 'export-1',
            operation: 'export/url',
            status: 'finished',
            result: {
                files: [{
                    filename: 'output.mp3',
                    url: MOCK_DOWNLOAD_URL,
                    size: 1234
                }]
            }
        }
    ]
};

const mockCloudConvertClient = {
    jobs: {
        create: async () => mockJob,
        wait:   async () => mockFinishedJob,
    },
    tasks: {
        upload: async () => {},
    },
};

// ─────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────
describe('Conversion Routes - /api/convert', () => {
    let userToken;

    before(() => {
        setCloudConvertClient(mockCloudConvertClient);
    });

    after(() => {
        setCloudConvertClient(null);
    });

    beforeEach(async () => {
        await setup();

        await request(app).post('/api/auth/signup').send({
            name: 'Convert User',
            email: 'convert@example.com',
            password: 'Password123!',
            confirmPassword: 'Password123!',
        });

        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ email: 'convert@example.com', password: 'Password123!' });

        userToken = loginRes.body.accessToken;
    });

    afterEach(async () => {
        await teardown();
    });

    // ─────────────────────────────────────────────────────────
    // POST /api/convert/batch
    // ─────────────────────────────────────────────────────────
    describe('POST /api/convert/batch', () => {

        it('should convert a file and return a download URL', async () => {
            const res = await request(app)
                .post('/api/convert/batch')
                .set('Authorization', `Bearer ${userToken}`)
                .field('toFormat', 'mp3')
                .attach('files', MP4_MAGIC, 'video.mp4');

            expect(res.statusCode).to.equal(200);
            expect(res.body).to.be.an('array');
            expect(res.body[0].success).to.equal(true);
            expect(res.body[0].downloadUrl).to.match(/^https:\/\//);
        });

        it('should return 400 if no files are uploaded', async () => {
            const res = await request(app)
                .post('/api/convert/batch')
                .set('Authorization', `Bearer ${userToken}`)
                .field('toFormat', 'mp3');

            expect(res.statusCode).to.equal(400);
            expect(res.body.message).to.match(/no files/i);
        });

        it('should return 400 if toFormat is missing', async () => {
            const res = await request(app)
                .post('/api/convert/batch')
                .set('Authorization', `Bearer ${userToken}`)
                .attach('files', MP4_MAGIC, 'video.mp4');

            expect(res.statusCode).to.equal(400);
            expect(res.body.message).to.match(/format/i);
        });

        it('should return 401 without a token', async () => {
            const res = await request(app)
                .post('/api/convert/batch')
                .field('toFormat', 'mp3')
                .attach('files', MP4_MAGIC, 'video.mp4');

            expect(res.statusCode).to.equal(401);
        });

        it('should handle multiple files in a single batch', async () => {
            const res = await request(app)
                .post('/api/convert/batch')
                .set('Authorization', `Bearer ${userToken}`)
                .field('toFormat', 'mp3')
                .attach('files', MP4_MAGIC, 'video1.mp4')
                .attach('files', MP4_MAGIC, 'video2.mp4');

            expect(res.statusCode).to.equal(200);
            expect(res.body.length).to.equal(2);
            res.body.forEach(result => {
                expect(result.success).to.equal(true);
            });
        });

        it('should return originalName in each result', async () => {
            const res = await request(app)
                .post('/api/convert/batch')
                .set('Authorization', `Bearer ${userToken}`)
                .field('toFormat', 'mp3')
                .attach('files', MP4_MAGIC, 'myvideo.mp4');

            expect(res.statusCode).to.equal(200);
            expect(res.body[0].originalName).to.equal('myvideo.mp4');
        });

        it('should save conversion to file history', async () => {
            await request(app)
                .post('/api/convert/batch')
                .set('Authorization', `Bearer ${userToken}`)
                .field('toFormat', 'mp3')
                .attach('files', MP4_MAGIC, 'video.mp4');

            const historyRes = await request(app)
                .get('/api/history')
                .set('Authorization', `Bearer ${userToken}`);

            expect(historyRes.statusCode).to.equal(200);

            // ✅ FIXED ASSERTIONS
            expect(historyRes.body).to.have.property('history');
            expect(historyRes.body.history).to.be.an('array');
            expect(historyRes.body.history.length).to.equal(1);
            expect(historyRes.body.history[0].format).to.equal('mp3');
        });
    });
});