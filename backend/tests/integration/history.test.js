// tests/integration/history.test.js
import request from 'supertest';
import { expect } from 'chai';
import app from '../../app.js';
import User from '../../models/User.js';
import FileHistory from '../../models/FileHistory.js';
import { setup, teardown } from '../setup.js';

describe('History Routes - /api/history', () => {
    let userToken;
    let testUser;

    beforeEach(async () => {
        await setup();

        await request(app).post('/api/auth/signup').send({
            name: 'History User',
            email: 'history@example.com',
            password: 'Password123!',
            confirmPassword: 'Password123!',
        });

        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ email: 'history@example.com', password: 'Password123!' });

        userToken = loginRes.body.accessToken;
        testUser = loginRes.body.user;
    });

    afterEach(async () => {
        await teardown();
    });

    describe('GET /api/history', () => {
        it('should return empty array when user has no history', async () => {
            const res = await request(app)
                .get('/api/history')
                .set('Authorization', `Bearer ${userToken}`);

            expect(res.statusCode).to.equal(200);
            expect(res.body.history).to.be.an('array').that.is.empty;   // ← FIXED
        });

        it('should return user conversion history sorted by newest first', async () => {
            const history1 = new FileHistory({
                userId: testUser.id,
                filename: 'video.mp4',
                format: 'mp4',
                sizeInBytes: 5000000,
                processedAt: new Date('2024-01-01'),
            });
            const history2 = new FileHistory({
                userId: testUser.id,
                filename: 'audio.mp3',
                format: 'mp3',
                sizeInBytes: 500000,
                processedAt: new Date('2024-06-01'),
            });
            await history1.save();
            await history2.save();

            await User.findByIdAndUpdate(testUser.id, {
                $push: { fileHistory: { $each: [history1._id, history2._id] } },
            });

            const res = await request(app)
                .get('/api/history')
                .set('Authorization', `Bearer ${userToken}`);

            expect(res.statusCode).to.equal(200);
            expect(res.body.history).to.have.lengthOf(2);                    // ← FIXED
            expect(res.body.history[0].filename).to.equal('audio.mp3');      // ← FIXED
            expect(res.body.history[1].filename).to.equal('video.mp4');      // ← FIXED
        });

        it('should only return history belonging to the authenticated user', async () => {
            await request(app).post('/api/auth/signup').send({
                name: 'Other User',
                email: 'other@example.com',
                password: 'Password123!',
                confirmPassword: 'Password123!',
            });
            const otherLogin = await request(app)
                .post('/api/auth/login')
                .send({ email: 'other@example.com', password: 'Password123!' });

            const otherHistory = new FileHistory({
                userId: otherLogin.body.user.id,
                filename: 'other_file.png',
                format: 'png',
                sizeInBytes: 100000,
            });
            await otherHistory.save();
            await User.findByIdAndUpdate(otherLogin.body.user.id, {
                $push: { fileHistory: otherHistory._id },
            });

            const res = await request(app)
                .get('/api/history')
                .set('Authorization', `Bearer ${userToken}`);

            expect(res.statusCode).to.equal(200);
            expect(res.body.history).to.have.lengthOf(0);   // ← FIXED
        });

        it('should return 401 without a token', async () => {
            const res = await request(app).get('/api/history');
            expect(res.statusCode).to.equal(401);
        });

        it('should include correct fields in each history record', async () => {
            const history = new FileHistory({
                userId: testUser.id,
                filename: 'document.pdf',
                format: 'jpg',
                sizeInBytes: 250000,
            });
            await history.save();
            await User.findByIdAndUpdate(testUser.id, {
                $push: { fileHistory: history._id },
            });

            const res = await request(app)
                .get('/api/history')
                .set('Authorization', `Bearer ${userToken}`);

            expect(res.statusCode).to.equal(200);
            const record = res.body.history[0];                    // ← FIXED
            expect(record).to.have.property('filename', 'document.pdf');
            expect(record).to.have.property('format', 'jpg');
            expect(record).to.have.property('sizeInBytes', 250000);
            expect(record).to.have.property('processedAt');
        });
    });

    // ─────────────────────────────────────────────────────────
    // DELETE /api/history
    // ─────────────────────────────────────────────────────────
    describe('DELETE /api/history', () => {
        beforeEach(async () => {
            // Create some history records
            const h1 = new FileHistory({ userId: testUser.id, filename: 'file1.pdf', format: 'pdf', sizeInBytes: 100 });
            const h2 = new FileHistory({ userId: testUser.id, filename: 'file2.jpg', format: 'jpg', sizeInBytes: 200 });
            await h1.save();
            await h2.save();
            await User.findByIdAndUpdate(testUser.id, {
                $push: { fileHistory: { $each: [h1._id, h2._id] } },
            });
        });

        it('should delete multiple history items by ids', async () => {
            // Get history list to get ids
            const listRes = await request(app)
                .get('/api/history')
                .set('Authorization', `Bearer ${userToken}`);
            expect(listRes.statusCode).to.equal(200);
            const ids = listRes.body.history.map(h => h._id);

            const delRes = await request(app)
                .delete('/api/history')
                .set('Authorization', `Bearer ${userToken}`)
                .send({ ids });
            expect(delRes.statusCode).to.equal(200);
            expect(delRes.body.message).to.match(/item\(s\) removed/i);

            // Check remaining history
            const after = await request(app)
                .get('/api/history')
                .set('Authorization', `Bearer ${userToken}`);
            expect(after.body.history.length).to.equal(0);
        });

        it('should clear all history when ids is not provided', async () => {
            const delRes = await request(app)
                .delete('/api/history')
                .set('Authorization', `Bearer ${userToken}`)
                .send({});
            expect(delRes.statusCode).to.equal(200);
            expect(delRes.body.message).to.match(/cleared/i);

            const after = await request(app)
                .get('/api/history')
                .set('Authorization', `Bearer ${userToken}`);
            expect(after.body.history.length).to.equal(0);
        });

        it('should return 400 if ids array is invalid', async () => {
            const delRes = await request(app)
                .delete('/api/history')
                .set('Authorization', `Bearer ${userToken}`)
                .send({ ids: ['invalid-id'] });
            expect(delRes.statusCode).to.equal(400);
        });

        it('should return 401 without token', async () => {
            const res = await request(app).delete('/api/history');
            expect(res.statusCode).to.equal(401);
        });
    });
});