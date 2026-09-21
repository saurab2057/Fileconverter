import { expect } from 'chai';
import express from 'express';
import request from 'supertest';

import {
    conditionalPdfUpload,
    conversionUpload
} from '../../../middleware/fileUpload.js';

describe('File Upload Middleware', () => {
    let app;

    beforeEach(() => {
        app = express();

        app.post('/pdf', conditionalPdfUpload, (req, res) => {
            res.status(200).json({
                success: true,
                file: req.file
                    ? {
                          fieldname: req.file.fieldname,
                          originalname: req.file.originalname,
                          mimetype: req.file.mimetype,
                          size: req.file.size
                      }
                    : null
            });
        });

        app.post('/conversion', conversionUpload, (req, res) => {
            res.status(200).json({
                success: true,
                files:
                    req.files?.map((file) => ({
                        fieldname: file.fieldname,
                        originalname: file.originalname,
                        mimetype: file.mimetype,
                        size: file.size
                    })) || []
            });
        });

        // Handles errors passed from Multer's direct middleware.
        // conversionUpload does not contain its own error handler,
        // so Express must convert Multer errors into the API response.
        app.use((err, req, res, next) => {
            if (err) {
                return res.status(400).json({
                    message: err.message || 'Invalid file'
                });
            }

            next();
        });
    });

    describe('conditionalPdfUpload', () => {
        it('should import upload middleware successfully', () => {
            expect(conditionalPdfUpload).to.be.a('function');
            expect(conversionUpload).to.be.a('function');
        });

        it('should skip multer for non-multipart requests', async () => {
            const response = await request(app)
                .post('/pdf')
                .send({ test: 'data' });

            expect(response.status).to.equal(200);
            expect(response.body.success).to.equal(true);
            expect(response.body.file).to.equal(null);
        });

        it('should accept a valid PDF file', async () => {
            const pdfBuffer = Buffer.from(
                '%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF'
            );

            const response = await request(app)
                .post('/pdf')
                .attach('pdf', pdfBuffer, {
                    filename: 'test.pdf',
                    contentType: 'application/pdf'
                });

            expect(response.status).to.equal(200);
            expect(response.body.success).to.equal(true);
            expect(response.body.file).to.not.equal(null);
            expect(response.body.file.fieldname).to.equal('pdf');
            expect(response.body.file.originalname).to.equal('test.pdf');
            expect(response.body.file.mimetype).to.equal(
                'application/pdf'
            );
        });

        it('should reject a non-PDF file', async () => {
            const response = await request(app)
                .post('/pdf')
                .attach('pdf', Buffer.from('not a pdf'), {
                    filename: 'test.txt',
                    contentType: 'text/plain'
                });

            expect(response.status).to.equal(400);
            expect(response.body.message).to.equal(
                'Only PDF files allowed'
            );
        });

        it('should reject a PDF larger than the configured limit', async () => {
            const oversizedBuffer = Buffer.alloc(
                2 * 1024 * 1024 + 1,
                'a'
            );

            const response = await request(app)
                .post('/pdf')
                .attach('pdf', oversizedBuffer, {
                    filename: 'large.pdf',
                    contentType: 'application/pdf'
                });

            expect(response.status).to.equal(400);
            expect(response.body.message).to.include('File too large');
        });
    });

    describe('conversionUpload', () => {
        it('should accept a single conversion file', async () => {
            const response = await request(app)
                .post('/conversion')
                .attach('files', Buffer.from('test file'), {
                    filename: 'test.txt',
                    contentType: 'text/plain'
                });

            expect(response.status).to.equal(200);
            expect(response.body.success).to.equal(true);
            expect(response.body.files).to.have.lengthOf(1);
            expect(response.body.files[0].fieldname).to.equal('files');
            expect(response.body.files[0].originalname).to.equal(
                'test.txt'
            );
        });

        it('should accept multiple conversion files', async () => {
            const response = await request(app)
                .post('/conversion')
                .attach('files', Buffer.from('file 1'), {
                    filename: 'one.txt',
                    contentType: 'text/plain'
                })
                .attach('files', Buffer.from('file 2'), {
                    filename: 'two.txt',
                    contentType: 'text/plain'
                })
                .attach('files', Buffer.from('file 3'), {
                    filename: 'three.txt',
                    contentType: 'text/plain'
                });

            expect(response.status).to.equal(200);
            expect(response.body.success).to.equal(true);
            expect(response.body.files).to.have.lengthOf(3);

            expect(
                response.body.files.map((file) => file.originalname)
            ).to.deep.equal([
                'one.txt',
                'two.txt',
                'three.txt'
            ]);
        });

        it('should reject more than 5 files', async () => {
            const req = request(app).post('/conversion');

            for (let i = 1; i <= 6; i++) {
                req.attach('files', Buffer.from(`file ${i}`), {
                    filename: `file${i}.txt`,
                    contentType: 'text/plain'
                });
            }

            const response = await req;

            expect(response.status).to.equal(400);
            expect(response.body.message).to.include(
                'Too many files'
            );
        });

        it('should accept files of different MIME types', async () => {
            const response = await request(app)
                .post('/conversion')
                .attach('files', Buffer.from('text'), {
                    filename: 'test.txt',
                    contentType: 'text/plain'
                })
                .attach('files', Buffer.from('image'), {
                    filename: 'test.png',
                    contentType: 'image/png'
                });

            expect(response.status).to.equal(200);
            expect(response.body.files).to.have.lengthOf(2);

            expect(response.body.files[0].mimetype).to.equal(
                'text/plain'
            );

            expect(response.body.files[1].mimetype).to.equal(
                'image/png'
            );
        });
    });
});