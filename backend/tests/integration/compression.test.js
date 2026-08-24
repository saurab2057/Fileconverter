// tests/integration/compression.test.js
import request from 'supertest';
import { expect } from 'chai';
import app from '../../app.js';
import { setCloudConvertClient } from '../../controllers/compressionController.js';
import { setup, teardown } from '../setup.js';

// ─────────────────────────────────────────────────────────
// Mock MP4 magic bytes (passes fileSecurity.js validation)
// ─────────────────────────────────────────────────────────
const MP4_MAGIC = Buffer.from([
    0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70,
    0x69, 0x73, 0x6F, 0x6D, 0x00, 0x00, 0x00, 0x00,
    0x69, 0x73, 0x6F, 0x6D, 0x6D, 0x70, 0x34, 0x31
]);

// ─────────────────────────────────────────────────────────
// Mock CloudConvert client
// ─────────────────────────────────────────────────────────
const MOCK_DOWNLOAD_URL = 'https://storage.cloudconvert.com/mock/compressed.mp4';

const mockJob = { id: 'mock-job-id', tasks: [{ name: 'import-1', status: 'finished' }] };

const mockFinishedJob = {
    id: 'mock-job-id',
    tasks: [
        { name: 'import-1', status: 'finished' },
        { name: 'compress-1', status: 'finished' },
        {
            name: 'export-1',
            operation: 'export/url',
            status: 'finished',
            result: { files: [{ filename: 'compressed.mp4', url: MOCK_DOWNLOAD_URL, size: 987654 }] }
        }
    ]
};

const mockCloudConvertClient = {
    jobs: { create: async () => mockJob, wait: async () => mockFinishedJob },
    tasks: { upload: async () => {} }
};

describe('Compression Routes - /api/compress', () => {
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
            name: 'Compress User',
            email: 'compress@example.com',
            password: 'Password123!',
            confirmPassword: 'Password123!',
        });

        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ email: 'compress@example.com', password: 'Password123!' });

        userToken = loginRes.body.accessToken;
    });

    afterEach(async () => {
        await teardown();
    });

    describe('POST /api/compress/batch', () => {

        it('should compress a file and return download URL + stats', async () => {
            const res = await request(app)
                .post('/api/compress/batch')
                .set('Authorization', `Bearer ${userToken}`)
                .attach('files', MP4_MAGIC, 'video.mp4')
                .field('settings', JSON.stringify([{ originalName: 'video.mp4', settings: { quality: 'high' } }]));

            expect(res.statusCode).to.equal(200);
            expect(res.body).to.be.an('array');
            expect(res.body[0].success).to.equal(true);
            expect(res.body[0].downloadUrl).to.match(/^https:\/\//);
            expect(res.body[0]).to.have.property('originalSize');
            expect(res.body[0]).to.have.property('compressedSize');
            expect(res.body[0]).to.have.property('savedPercent');
        });

        it('should return 400 if no files are uploaded', async () => {
            const res = await request(app)
                .post('/api/compress/batch')
                .set('Authorization', `Bearer ${userToken}`);

            expect(res.statusCode).to.equal(400);
            expect(res.body.message).to.match(/no files/i);
        });

        it('should return 401 without token', async () => {
            const res = await request(app)
                .post('/api/compress/batch')
                .attach('files', MP4_MAGIC, 'video.mp4');

            expect(res.statusCode).to.equal(401);
        });

        it('should handle multiple files in one batch', async () => {
            const res = await request(app)
                .post('/api/compress/batch')
                .set('Authorization', `Bearer ${userToken}`)
                .attach('files', MP4_MAGIC, 'video1.mp4')
                .attach('files', MP4_MAGIC, 'video2.mp4');

            expect(res.statusCode).to.equal(200);
            expect(res.body.length).to.equal(2);
            res.body.forEach(r => expect(r.success).to.equal(true));
        });

        it('should save compression to file history', async () => {
            await request(app)
                .post('/api/compress/batch')
                .set('Authorization', `Bearer ${userToken}`)
                .attach('files', MP4_MAGIC, 'video.mp4');

            const historyRes = await request(app)
                .get('/api/history')
                .set('Authorization', `Bearer ${userToken}`);

            expect(historyRes.statusCode).to.equal(200);
            expect(historyRes.body).to.have.property('history');
            expect(historyRes.body.history).to.be.an('array');
            expect(historyRes.body.history.length).to.equal(1);
        });
    });
});