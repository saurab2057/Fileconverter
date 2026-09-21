import express from 'express';
import request from 'supertest';
import { expect } from 'chai';
import { body, validationResult } from 'express-validator';

import {
    validateUserUpdate,
    validateConfigUpdate,
    handleValidationErrors,
    signupValidation,
    loginValidation,
    forgotPasswordValidation,
    tokenValidation,
    newPasswordValidation,
    changePasswordValidation,
    passkeyLabelValidation,
    googleCallbackValidation,
} from '../../../middleware/validation.js';

/*
 * Creates a minimal Express application around the supplied validation
 * middleware so each validator can be tested independently from the
 * application's real routes and controllers.
 *
 * The route also performs validationResult() because some validators in
 * validation.js collect errors without calling handleValidationErrors
 * themselves.
 */
const createValidationApp = (validationMiddleware, method = 'post') => {
    const app = express();

    app.use(express.json());

    app[method](
        '/test',
        validationMiddleware,
        (req, res) => {
            const errors = validationResult(req);

            if (!errors.isEmpty()) {
                return res.status(400).json({
                    errors: errors.array(),
                });
            }

            return res.status(200).json({
                success: true,
                body: req.body,
                query: req.query,
            });
        }
    );

    return app;
};

/*
 * Verifies that a normal validation middleware rejects invalid input
 * with HTTP 400 and returns express-validator's error array.
 */
const expectValidationError = async (
    app,
    bodyData = {},
    queryData = {},
    method = 'post'
) => {
    const response =
        method === 'get'
            ? await request(app).get('/test').query(queryData)
            : await request(app).post('/test').send(bodyData);

    expect(response.status).to.equal(400);
    expect(response.body.errors).to.be.an('array');
};

/*
 * Verifies that valid input passes through the validation middleware
 * and reaches the test route successfully.
 */
const expectSuccess = async (
    app,
    bodyData = {},
    queryData = {},
    method = 'post'
) => {
    const response =
        method === 'get'
            ? await request(app).get('/test').query(queryData)
            : await request(app).post('/test').send(bodyData);

    expect(response.status).to.equal(200);
    expect(response.body.success).to.equal(true);
};

describe('Validation Middleware', () => {
    // ============================================================
    // validateUserUpdate
    // ============================================================

    describe('validateUserUpdate', () => {
        const app = createValidationApp(validateUserUpdate);

        it('should accept a valid status', async () => {
            await expectSuccess(app, {
                status: 'active',
            });
        });

        it('should accept banned status', async () => {
            await expectSuccess(app, {
                status: 'banned',
            });
        });

        it('should accept a valid role', async () => {
            await expectSuccess(app, {
                role: 'user',
            });
        });

        it('should accept admin role', async () => {
            await expectSuccess(app, {
                role: 'admin',
            });
        });

        it('should accept status and role together', async () => {
            await expectSuccess(app, {
                status: 'active',
                role: 'admin',
            });
        });

        it('should allow an empty update body', async () => {
            await expectSuccess(app, {});
        });

        it('should reject invalid status', async () => {
            await expectValidationError(app, {
                status: 'pending',
            });
        });

        it('should reject invalid role', async () => {
            await expectValidationError(app, {
                role: 'moderator',
            });
        });
    });

    // ============================================================
    // validateConfigUpdate
    // ============================================================

    describe('validateConfigUpdate', () => {
        const app = createValidationApp(validateConfigUpdate);

        it('should accept valid configuration values', async () => {
            await expectSuccess(app, {
                freeUserMaxFileSize: 100,
                proUserMaxFileSize: 1000,
                maxJobsPerHour: 100,
                maxProcessingTime: 300,
                maxConcurrentJobs: 10,
                cleanupInterval: 24,
                logRetentionDays: 30,
                enableRateLimit: true,
                maxRequestsPerMinute: 100,
                enableFileTypeValidation: true,
                allowedFileTypes: 'pdf,jpg,png',
                enableEmailNotifications: true,
                enableSlackAlerts: false,
                alertThreshold: 50,
                tempFileRetention: 24,
                maxStorageGB: 100,
                enableAutoBackup: true,
            });
        });

        it('should allow an empty configuration update', async () => {
            await expectSuccess(app, {});
        });

        it('should reject freeUserMaxFileSize below minimum', async () => {
            await expectValidationError(app, {
                freeUserMaxFileSize: 0,
            });
        });

        it('should reject freeUserMaxFileSize above maximum', async () => {
            await expectValidationError(app, {
                freeUserMaxFileSize: 501,
            });
        });

        it('should reject proUserMaxFileSize below minimum', async () => {
            await expectValidationError(app, {
                proUserMaxFileSize: 0,
            });
        });

        it('should reject proUserMaxFileSize above maximum', async () => {
            await expectValidationError(app, {
                proUserMaxFileSize: 2001,
            });
        });

        it('should reject maxJobsPerHour below minimum', async () => {
            await expectValidationError(app, {
                maxJobsPerHour: 0,
            });
        });

        it('should reject maxJobsPerHour above maximum', async () => {
            await expectValidationError(app, {
                maxJobsPerHour: 1001,
            });
        });

        it('should reject maxProcessingTime below minimum', async () => {
            await expectValidationError(app, {
                maxProcessingTime: 9,
            });
        });

        it('should reject maxProcessingTime above maximum', async () => {
            await expectValidationError(app, {
                maxProcessingTime: 3601,
            });
        });

        it('should reject maxConcurrentJobs below minimum', async () => {
            await expectValidationError(app, {
                maxConcurrentJobs: 0,
            });
        });

        it('should reject maxConcurrentJobs above maximum', async () => {
            await expectValidationError(app, {
                maxConcurrentJobs: 51,
            });
        });

        it('should reject cleanupInterval below minimum', async () => {
            await expectValidationError(app, {
                cleanupInterval: 0,
            });
        });

        it('should reject cleanupInterval above maximum', async () => {
            await expectValidationError(app, {
                cleanupInterval: 169,
            });
        });

        it('should reject logRetentionDays below minimum', async () => {
            await expectValidationError(app, {
                logRetentionDays: 0,
            });
        });

        it('should reject logRetentionDays above maximum', async () => {
            await expectValidationError(app, {
                logRetentionDays: 366,
            });
        });

        it('should reject invalid enableRateLimit', async () => {
            await expectValidationError(app, {
                enableRateLimit: 'yes',
            });
        });

        it('should reject maxRequestsPerMinute below minimum', async () => {
            await expectValidationError(app, {
                maxRequestsPerMinute: 0,
            });
        });

        it('should reject maxRequestsPerMinute above maximum', async () => {
            await expectValidationError(app, {
                maxRequestsPerMinute: 1001,
            });
        });

        it('should reject invalid enableFileTypeValidation', async () => {
            await expectValidationError(app, {
                enableFileTypeValidation: 'yes',
            });
        });

        it('should reject non-string allowedFileTypes', async () => {
            await expectValidationError(app, {
                allowedFileTypes: 123,
            });
        });

        it('should reject invalid enableEmailNotifications', async () => {
            await expectValidationError(app, {
                enableEmailNotifications: 'yes',
            });
        });

        it('should reject invalid enableSlackAlerts', async () => {
            await expectValidationError(app, {
                enableSlackAlerts: 'no',
            });
        });

        it('should reject alertThreshold below minimum', async () => {
            await expectValidationError(app, {
                alertThreshold: 0,
            });
        });

        it('should reject alertThreshold above maximum', async () => {
            await expectValidationError(app, {
                alertThreshold: 101,
            });
        });

        it('should reject tempFileRetention below minimum', async () => {
            await expectValidationError(app, {
                tempFileRetention: 0,
            });
        });

        it('should reject tempFileRetention above maximum', async () => {
            await expectValidationError(app, {
                tempFileRetention: 73,
            });
        });

        it('should reject maxStorageGB below minimum', async () => {
            await expectValidationError(app, {
                maxStorageGB: 0,
            });
        });

        it('should reject maxStorageGB above maximum', async () => {
            await expectValidationError(app, {
                maxStorageGB: 10001,
            });
        });

        it('should reject invalid enableAutoBackup', async () => {
            await expectValidationError(app, {
                enableAutoBackup: 'yes',
            });
        });
    });

    // ============================================================
    // handleValidationErrors
    // ============================================================

    describe('handleValidationErrors', () => {
        it('should call next when there are no validation errors', async () => {
            const app = createValidationApp([
                body('value').notEmpty(),
                handleValidationErrors,
            ]);

            await expectSuccess(app, {
                value: 'valid',
            });
        });

        it('should return 400 when validation errors exist', async () => {
            const app = createValidationApp([
                body('value')
                    .equals('valid')
                    .withMessage('Value must be valid'),
                handleValidationErrors,
            ]);

            const response = await request(app)
                .post('/test')
                .send({
                    value: 'invalid',
                });

            expect(response.status).to.equal(400);
            expect(response.body.errors).to.be.an('array');
            expect(response.body.errors).to.have.length.greaterThan(0);
        });
    });

    // ============================================================
    // signupValidation
    // ============================================================

    describe('signupValidation', () => {
        const app = createValidationApp(signupValidation);

        const validSignup = {
            email: 'user@example.com',
            password: 'StrongPassword1!',
            confirmPassword: 'StrongPassword1!',
            name: 'John Doe',
        };

        it('should accept valid signup data', async () => {
            await expectSuccess(app, validSignup);
        });

        it('should normalize the email address to lowercase', async () => {
            const response = await request(app)
                .post('/test')
                .send({
                    ...validSignup,
                    email: 'USER@EXAMPLE.COM',
                });

            expect(response.status).to.equal(200);
            expect(response.body.body.email).to.equal('user@example.com');
        });

        it('should reject invalid email', async () => {
            await expectValidationError(app, {
                ...validSignup,
                email: 'not-an-email',
            });
        });

        it('should reject weak password', async () => {
            await expectValidationError(app, {
                ...validSignup,
                password: 'password',
                confirmPassword: 'password',
            });
        });

        it('should reject password without uppercase letter', async () => {
            await expectValidationError(app, {
                ...validSignup,
                password: 'strongpassword1!',
                confirmPassword: 'strongpassword1!',
            });
        });

        it('should reject password without lowercase letter', async () => {
            await expectValidationError(app, {
                ...validSignup,
                password: 'STRONGPASSWORD1!',
                confirmPassword: 'STRONGPASSWORD1!',
            });
        });

        it('should reject password without number', async () => {
            await expectValidationError(app, {
                ...validSignup,
                password: 'StrongPassword!',
                confirmPassword: 'StrongPassword!',
            });
        });

        it('should reject password without symbol', async () => {
            await expectValidationError(app, {
                ...validSignup,
                password: 'StrongPassword1',
                confirmPassword: 'StrongPassword1',
            });
        });

        it('should reject password shorter than 8 characters', async () => {
            await expectValidationError(app, {
                ...validSignup,
                password: 'Ab1!',
                confirmPassword: 'Ab1!',
            });
        });

        it('should reject mismatched passwords', async () => {
            await expectValidationError(app, {
                ...validSignup,
                confirmPassword: 'DifferentPassword1!',
            });
        });

        it('should reject empty name', async () => {
            await expectValidationError(app, {
                ...validSignup,
                name: '',
            });
        });

        it('should reject whitespace-only name', async () => {
            await expectValidationError(app, {
                ...validSignup,
                name: '     ',
            });
        });

        it('should trim and escape the name', async () => {
            const response = await request(app)
                .post('/test')
                .send({
                    ...validSignup,
                    name: '  John & Jane  ',
                });

            expect(response.status).to.equal(200);
            expect(response.body.body.name).to.equal('John &amp; Jane');
        });
    });

    // ============================================================
    // loginValidation
    // ============================================================

    describe('loginValidation', () => {
        const app = createValidationApp(loginValidation);

        it('should accept valid login data', async () => {
            await expectSuccess(app, {
                email: 'user@example.com',
                password: 'password',
            });
        });

        it('should reject invalid email', async () => {
            await expectValidationError(app, {
                email: 'invalid-email',
                password: 'password',
            });
        });

        it('should reject empty password', async () => {
            await expectValidationError(app, {
                email: 'user@example.com',
                password: '',
            });
        });

        it('should reject missing password', async () => {
            await expectValidationError(app, {
                email: 'user@example.com',
            });
        });

        it('should reject missing email', async () => {
            await expectValidationError(app, {
                password: 'password',
            });
        });

        it('should normalize uppercase email to lowercase', async () => {
            const response = await request(app)
                .post('/test')
                .send({
                    email: 'USER@EXAMPLE.COM',
                    password: 'password',
                });

            expect(response.status).to.equal(200);
            expect(response.body.body.email).to.equal('user@example.com');
        });
    });

    // ============================================================
    // forgotPasswordValidation
    // ============================================================

    describe('forgotPasswordValidation', () => {
        const app = createValidationApp(forgotPasswordValidation);

        it('should accept valid email', async () => {
            await expectSuccess(app, {
                email: 'user@example.com',
            });
        });

        it('should reject invalid email', async () => {
            await expectValidationError(app, {
                email: 'invalid-email',
            });
        });

        it('should reject missing email', async () => {
            await expectValidationError(app, {});
        });

        it('should reject empty email', async () => {
            await expectValidationError(app, {
                email: '',
            });
        });

        it('should normalize uppercase email to lowercase', async () => {
            const response = await request(app)
                .post('/test')
                .send({
                    email: 'USER@EXAMPLE.COM',
                });

            expect(response.status).to.equal(200);
            expect(response.body.body.email).to.equal('user@example.com');
        });
    });

    // ============================================================
    // tokenValidation
    // ============================================================

    describe('tokenValidation', () => {
        const app = createValidationApp(tokenValidation);

        it('should accept a valid token', async () => {
            await expectSuccess(app, {
                token: 'valid-token',
            });
        });

        it('should reject empty token', async () => {
            await expectValidationError(app, {
                token: '',
            });
        });

        it('should reject missing token', async () => {
            await expectValidationError(app, {});
        });
    });

    // ============================================================
    // newPasswordValidation
    // ============================================================

    describe('newPasswordValidation', () => {
        const app = createValidationApp(newPasswordValidation);

        it('should accept a strong password', async () => {
            await expectSuccess(app, {
                newPassword: 'StrongPassword1!',
            });
        });

        it('should reject a weak password', async () => {
            await expectValidationError(app, {
                newPassword: 'password',
            });
        });

        it('should reject password without uppercase', async () => {
            await expectValidationError(app, {
                newPassword: 'strongpassword1!',
            });
        });

        it('should reject password without lowercase', async () => {
            await expectValidationError(app, {
                newPassword: 'STRONGPASSWORD1!',
            });
        });

        it('should reject password without number', async () => {
            await expectValidationError(app, {
                newPassword: 'StrongPassword!',
            });
        });

        it('should reject password without symbol', async () => {
            await expectValidationError(app, {
                newPassword: 'StrongPassword1',
            });
        });

        it('should reject password shorter than 8 characters', async () => {
            await expectValidationError(app, {
                newPassword: 'Ab1!',
            });
        });
    });

    // ============================================================
    // changePasswordValidation
    // ============================================================

    describe('changePasswordValidation', () => {
        const app = createValidationApp(changePasswordValidation);

        it('should accept valid password change data', async () => {
            await expectSuccess(app, {
                currentPassword: 'OldPassword1!',
                newPassword: 'NewPassword1!',
                confirmNewPassword: 'NewPassword1!',
            });
        });

        it('should reject missing current password', async () => {
            await expectValidationError(app, {
                newPassword: 'NewPassword1!',
                confirmNewPassword: 'NewPassword1!',
            });
        });

        it('should reject empty current password', async () => {
            await expectValidationError(app, {
                currentPassword: '',
                newPassword: 'NewPassword1!',
                confirmNewPassword: 'NewPassword1!',
            });
        });

        it('should reject weak new password', async () => {
            await expectValidationError(app, {
                currentPassword: 'OldPassword1!',
                newPassword: 'password',
                confirmNewPassword: 'password',
            });
        });

        it('should reject new password without uppercase', async () => {
            await expectValidationError(app, {
                currentPassword: 'OldPassword1!',
                newPassword: 'newpassword1!',
                confirmNewPassword: 'newpassword1!',
            });
        });

        it('should reject new password without lowercase', async () => {
            await expectValidationError(app, {
                currentPassword: 'OldPassword1!',
                newPassword: 'NEWPASSWORD1!',
                confirmNewPassword: 'NEWPASSWORD1!',
            });
        });

        it('should reject new password without number', async () => {
            await expectValidationError(app, {
                currentPassword: 'OldPassword1!',
                newPassword: 'NewPassword!',
                confirmNewPassword: 'NewPassword!',
            });
        });

        it('should reject new password without symbol', async () => {
            await expectValidationError(app, {
                currentPassword: 'OldPassword1!',
                newPassword: 'NewPassword1',
                confirmNewPassword: 'NewPassword1',
            });
        });

        it('should reject mismatched confirmation password', async () => {
            await expectValidationError(app, {
                currentPassword: 'OldPassword1!',
                newPassword: 'NewPassword1!',
                confirmNewPassword: 'DifferentPassword1!',
            });
        });

        it('should reject missing confirmation password', async () => {
            await expectValidationError(app, {
                currentPassword: 'OldPassword1!',
                newPassword: 'NewPassword1!',
            });
        });
    });

    // ============================================================
    // passkeyLabelValidation
    // ============================================================

    describe('passkeyLabelValidation', () => {
        const app = createValidationApp(passkeyLabelValidation);

        it('should accept a valid label', async () => {
            await expectSuccess(app, {
                label: 'My Laptop',
            });
        });

        it('should accept a one-character label', async () => {
            await expectSuccess(app, {
                label: 'A',
            });
        });

        it('should accept a 50-character label', async () => {
            await expectSuccess(app, {
                label: 'A'.repeat(50),
            });
        });

        it('should reject an empty label', async () => {
            await expectValidationError(app, {
                label: '',
            });
        });

        it('should reject a missing label', async () => {
            await expectValidationError(app, {});
        });

        it('should reject a label longer than 50 characters', async () => {
            await expectValidationError(app, {
                label: 'A'.repeat(51),
            });
        });

        it('should reject a whitespace-only label', async () => {
            await expectValidationError(app, {
                label: '     ',
            });
        });

        it('should trim the label', async () => {
            const response = await request(app)
                .post('/test')
                .send({
                    label: '  My Laptop  ',
                });

            expect(response.status).to.equal(200);
            expect(response.body.body.label).to.equal('My Laptop');
        });
    });

    // ============================================================
    // googleCallbackValidation
    // ============================================================

    describe('googleCallbackValidation', () => {
        const app = createValidationApp(
            googleCallbackValidation,
            'get'
        );

        it('should accept a valid authorization code and state', async () => {
            await expectSuccess(
                app,
                {},
                {
                    code: 'authorization-code',
                    state: 'valid-state',
                },
                'get'
            );
        });

        it('should accept an OAuth error and state', async () => {
            await expectSuccess(
                app,
                {},
                {
                    error: 'access_denied',
                    state: 'valid-state',
                },
                'get'
            );
        });

        it('should reject missing state by redirecting to the frontend', async () => {
            const response = await request(app)
                .get('/test')
                .query({
                    code: 'authorization-code',
                });

            expect(response.status).to.equal(302);
            expect(response.headers.location).to.include(
                '/login?error=google_auth_failed'
            );
        });

        it('should reject an empty state by redirecting to the frontend', async () => {
            const response = await request(app)
                .get('/test')
                .query({
                    state: '',
                });

            expect(response.status).to.equal(302);
            expect(response.headers.location).to.include(
                '/login?error=google_auth_failed'
            );
        });

        it('should reject state longer than 128 characters by redirecting', async () => {
            const response = await request(app)
                .get('/test')
                .query({
                    state: 'A'.repeat(129),
                });

            expect(response.status).to.equal(302);
            expect(response.headers.location).to.include(
                '/login?error=google_auth_failed'
            );
        });

        it('should reject code longer than 2048 characters by redirecting', async () => {
            const response = await request(app)
                .get('/test')
                .query({
                    code: 'A'.repeat(2049),
                    state: 'valid-state',
                });

            expect(response.status).to.equal(302);
            expect(response.headers.location).to.include(
                '/login?error=google_auth_failed'
            );
        });

        it('should reject error longer than 256 characters by redirecting', async () => {
            const response = await request(app)
                .get('/test')
                .query({
                    error: 'A'.repeat(257),
                    state: 'valid-state',
                });

            expect(response.status).to.equal(302);
            expect(response.headers.location).to.include(
                '/login?error=google_auth_failed'
            );
        });

        it('should accept callback with only state', async () => {
            await expectSuccess(
                app,
                {},
                {
                    state: 'valid-state',
                },
                'get'
            );
        });
    });
});