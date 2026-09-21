import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { expect } from 'chai';
import sinon from 'sinon';

import { authenticateToken, isAdmin } from '../../../middleware/authMiddleware.js';
import User from '../../../models/User.js';

describe('Authentication Middleware', () => {
    const accessTokenSecret = 'test-access-secret';

    let findByIdStub;

    /*
     * Creates a minimal Express application so the middleware can be
     * tested independently from the application's real route handlers.
     */
    const createApp = (middleware) => {
        const app = express();

        app.use(express.json());

        app.get(
            '/protected',
            middleware,
            (req, res) => {
                res.status(200).json({
                    success: true,
                    user: req.user,
                });
            }
        );

        return app;
    };

    /*
     * Creates a valid JWT using the same payload structure expected
     * by authenticateToken(): decoded.userInfo.id
     */
    const createToken = ({
        userId = '507f1f77bcf86cd799439011',
        iat,
        expiresIn = '15m',
    } = {}) => {
        const payload = {
            userInfo: {
                id: userId,
            },
        };

        if (iat !== undefined) {
            payload.iat = iat;
        }

        return jwt.sign(payload, accessTokenSecret, {
            expiresIn,
        });
    };

    /*
     * Creates a fake Mongoose user document containing the fields
     * authenticateToken() reads after querying the database.
     */
    const createUser = ({
        id = '507f1f77bcf86cd799439011',
        status = 'active',
        role = 'user',
        passwordChangedAt = undefined,
    } = {}) => ({
        _id: id,
        status,
        role,
        passwordChangedAt,
    });

    beforeEach(() => {
        process.env.ACCESS_SECRET_KEY = accessTokenSecret;

        /*
         * authenticateToken() calls:
         * User.findById(...).select('+passwordChangedAt')
         *
         * Therefore the stub must reproduce that chained Mongoose API.
         */
        findByIdStub = sinon.stub(User, 'findById');
    });

    afterEach(() => {
        sinon.restore();
    });

    // ============================================================
    // authenticateToken
    // ============================================================

    describe('authenticateToken', () => {
        it('should reject a request without an Authorization header', async () => {
            const app = createApp(authenticateToken);

            const response = await request(app)
                .get('/protected');

            expect(response.status).to.equal(401);
            expect(response.body.message).to.equal(
                'No token, authorization denied'
            );

            expect(findByIdStub.called).to.equal(false);
        });

        it('should reject an empty Bearer token', async () => {
            const app = createApp(authenticateToken);

            const response = await request(app)
                .get('/protected')
                .set('Authorization', 'Bearer');

            expect(response.status).to.equal(401);
            expect(response.body.message).to.equal(
                'No token, authorization denied'
            );

            expect(findByIdStub.called).to.equal(false);
        });

        it('should reject an invalid JWT', async () => {
            const app = createApp(authenticateToken);

            const response = await request(app)
                .get('/protected')
                .set('Authorization', 'Bearer completely-invalid-token');

            expect(response.status).to.equal(401);
            expect(response.body.message).to.equal('Invalid token');

            expect(findByIdStub.called).to.equal(false);
        });

        it('should reject a token signed with the wrong secret', async () => {
            const token = jwt.sign(
                {
                    userInfo: {
                        id: '507f1f77bcf86cd799439011',
                    },
                },
                'wrong-secret',
                {
                    expiresIn: '15m',
                }
            );

            const app = createApp(authenticateToken);

            const response = await request(app)
                .get('/protected')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).to.equal(401);
            expect(response.body.message).to.equal('Invalid token');

            expect(findByIdStub.called).to.equal(false);
        });

        it('should reject an expired JWT', async () => {
            const token = jwt.sign(
                {
                    userInfo: {
                        id: '507f1f77bcf86cd799439011',
                    },
                },
                accessTokenSecret,
                {
                    expiresIn: -1,
                }
            );

            const app = createApp(authenticateToken);

            const response = await request(app)
                .get('/protected')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).to.equal(401);
            expect(response.body.message).to.equal('Token expired');

            expect(findByIdStub.called).to.equal(false);
        });

        it('should reject a token when the user no longer exists', async () => {
            const userId = '507f1f77bcf86cd799439011';

            const token = createToken({
                userId,
            });

            findByIdStub.returns({
                select: sinon.stub().resolves(null),
            });

            const app = createApp(authenticateToken);

            const response = await request(app)
                .get('/protected')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).to.equal(401);
            expect(response.body.message).to.equal(
                'User not found, authorization denied'
            );

            expect(findByIdStub.calledOnce).to.equal(true);
            expect(findByIdStub.firstCall.args[0]).to.equal(userId);
        });

        it('should reject an inactive user', async () => {
            const userId = '507f1f77bcf86cd799439011';

            const token = createToken({
                userId,
            });

            const inactiveUser = createUser({
                id: userId,
                status: 'banned',
            });

            findByIdStub.returns({
                select: sinon.stub().resolves(inactiveUser),
            });

            const app = createApp(authenticateToken);

            const response = await request(app)
                .get('/protected')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).to.equal(403);
            expect(response.body.message).to.equal(
                'Account is not active.'
            );
        });

        it('should reject a suspended user', async () => {
            const userId = '507f1f77bcf86cd799439011';

            const token = createToken({
                userId,
            });

            const suspendedUser = createUser({
                id: userId,
                status: 'suspended',
            });

            findByIdStub.returns({
                select: sinon.stub().resolves(suspendedUser),
            });

            const app = createApp(authenticateToken);

            const response = await request(app)
                .get('/protected')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).to.equal(403);
            expect(response.body.message).to.equal(
                'Account is not active.'
            );
        });

        it('should reject a token issued before the password was changed', async () => {
            const userId = '507f1f77bcf86cd799439011';

            const token = createToken({
                userId,
            });

            const user = createUser({
                id: userId,
                status: 'active',
                passwordChangedAt: new Date(Date.now() + 60_000),
            });

            findByIdStub.returns({
                select: sinon.stub().resolves(user),
            });

            const app = createApp(authenticateToken);

            const response = await request(app)
                .get('/protected')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).to.equal(401);
            expect(response.body.message).to.equal(
                'Password changed. Please login again.'
            );
        });

        it('should allow a valid active user', async () => {
            const userId = '507f1f77bcf86cd799439011';

            const token = createToken({
                userId,
            });

            const user = createUser({
                id: userId,
                status: 'active',
                role: 'user',
            });

            findByIdStub.returns({
                select: sinon.stub().resolves(user),
            });

            const app = createApp(authenticateToken);

            const response = await request(app)
                .get('/protected')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).to.equal(200);
            expect(response.body.success).to.equal(true);
            expect(response.body.user._id).to.equal(userId);
            expect(response.body.user.role).to.equal('user');

            expect(findByIdStub.calledOnce).to.equal(true);
            expect(findByIdStub.firstCall.args[0]).to.equal(userId);
        });

        it('should attach the fresh database user to req.user', async () => {
            const userId = '507f1f77bcf86cd799439011';

            const token = createToken({
                userId,
            });

            const user = createUser({
                id: userId,
                status: 'active',
                role: 'admin',
            });

            findByIdStub.returns({
                select: sinon.stub().resolves(user),
            });

            const app = express();

            app.get(
                '/protected',
                authenticateToken,
                (req, res) => {
                    expect(req.user).to.equal(user);

                    res.status(200).json({
                        success: true,
                    });
                }
            );

            const response = await request(app)
                .get('/protected')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).to.equal(200);
            expect(response.body.success).to.equal(true);
        });

        it('should request passwordChangedAt explicitly from the database', async () => {
            const userId = '507f1f77bcf86cd799439011';

            const token = createToken({
                userId,
            });

            const selectStub = sinon.stub().resolves(
                createUser({
                    id: userId,
                    status: 'active',
                })
            );

            findByIdStub.returns({
                select: selectStub,
            });

            const app = createApp(authenticateToken);

            const response = await request(app)
                .get('/protected')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).to.equal(200);
            expect(selectStub.calledOnceWithExactly(
                '+passwordChangedAt'
            )).to.equal(true);
        });

        it('should return 403 when the database query fails unexpectedly', async () => {
            const userId = '507f1f77bcf86cd799439011';

            const token = createToken({
                userId,
            });

            findByIdStub.returns({
                select: sinon.stub().rejects(
                    new Error('Database connection failed')
                ),
            });

            const app = createApp(authenticateToken);

            const response = await request(app)
                .get('/protected')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).to.equal(403);
            expect(response.body.message).to.equal('Unauthorized');
        });

        it('should return 403 for an unexpected middleware error', async () => {
            const userId = '507f1f77bcf86cd799439011';

            const token = createToken({
                userId,
            });

            findByIdStub.throws(new Error('Unexpected failure'));

            const app = createApp(authenticateToken);

            const response = await request(app)
                .get('/protected')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).to.equal(403);
            expect(response.body.message).to.equal('Unauthorized');
        });

        it('should accept an active admin user because authenticateToken does not restrict roles', async () => {
            const userId = '507f1f77bcf86cd799439011';

            const token = createToken({
                userId,
            });

            const adminUser = createUser({
                id: userId,
                status: 'active',
                role: 'admin',
            });

            findByIdStub.returns({
                select: sinon.stub().resolves(adminUser),
            });

            const app = createApp(authenticateToken);

            const response = await request(app)
                .get('/protected')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).to.equal(200);
            expect(response.body.user.role).to.equal('admin');
        });

        it('should use the user ID from decoded.userInfo.id when querying the database', async () => {
            const userId = '507f191e810c19729de860ea';

            const token = createToken({
                userId,
            });

            const user = createUser({
                id: userId,
                status: 'active',
            });

            findByIdStub.returns({
                select: sinon.stub().resolves(user),
            });

            const app = createApp(authenticateToken);

            const response = await request(app)
                .get('/protected')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).to.equal(200);
            expect(findByIdStub.calledOnceWithExactly(userId)).to.equal(true);
        });
    });

    // ============================================================
    // isAdmin
    // ============================================================

    describe('isAdmin', () => {
        const createAdminApp = () => {
            const app = express();

            app.get(
                '/admin',
                isAdmin,
                (req, res) => {
                    res.status(200).json({
                        success: true,
                    });
                }
            );

            return app;
        };

        it('should allow an admin user', async () => {
            const app = createAdminApp();

            app.use((req, res, next) => {
                req.user = {
                    _id: '507f1f77bcf86cd799439011',
                    role: 'admin',
                };

                next();
            });

            /*
             * Rebuild the route with req.user attached before isAdmin.
             */
            const testApp = express();

            testApp.get(
                '/admin',
                (req, res, next) => {
                    req.user = {
                        _id: '507f1f77bcf86cd799439011',
                        role: 'admin',
                    };

                    next();
                },
                isAdmin,
                (req, res) => {
                    res.status(200).json({
                        success: true,
                    });
                }
            );

            const response = await request(testApp)
                .get('/admin');

            expect(response.status).to.equal(200);
            expect(response.body.success).to.equal(true);
        });

        it('should reject a normal user', async () => {
            const app = express();

            app.get(
                '/admin',
                (req, res, next) => {
                    req.user = {
                        _id: '507f1f77bcf86cd799439011',
                        role: 'user',
                    };

                    next();
                },
                isAdmin,
                (req, res) => {
                    res.status(200).json({
                        success: true,
                    });
                }
            );

            const response = await request(app)
                .get('/admin');

            expect(response.status).to.equal(403);
            expect(response.body.message).to.equal(
                'Forbidden: Requires admin privileges.'
            );
        });

        it('should reject when req.user is missing', async () => {
            const app = express();

            app.get(
                '/admin',
                isAdmin,
                (req, res) => {
                    res.status(200).json({
                        success: true,
                    });
                }
            );

            const response = await request(app)
                .get('/admin');

            expect(response.status).to.equal(403);
            expect(response.body.message).to.equal(
                'Forbidden: Requires admin privileges.'
            );
        });

        it('should reject when req.user is null', async () => {
            const app = express();

            app.get(
                '/admin',
                (req, res, next) => {
                    req.user = null;
                    next();
                },
                isAdmin,
                (req, res) => {
                    res.status(200).json({
                        success: true,
                    });
                }
            );

            const response = await request(app)
                .get('/admin');

            expect(response.status).to.equal(403);
            expect(response.body.message).to.equal(
                'Forbidden: Requires admin privileges.'
            );
        });

        it('should reject a user with an undefined role', async () => {
            const app = express();

            app.get(
                '/admin',
                (req, res, next) => {
                    req.user = {
                        _id: '507f1f77bcf86cd799439011',
                    };

                    next();
                },
                isAdmin,
                (req, res) => {
                    res.status(200).json({
                        success: true,
                    });
                }
            );

            const response = await request(app)
                .get('/admin');

            expect(response.status).to.equal(403);
            expect(response.body.message).to.equal(
                'Forbidden: Requires admin privileges.'
            );
        });

        it('should reject a non-admin role even when the role is truthy', async () => {
            const app = express();

            app.get(
                '/admin',
                (req, res, next) => {
                    req.user = {
                        _id: '507f1f77bcf86cd799439011',
                        role: 'moderator',
                    };

                    next();
                },
                isAdmin,
                (req, res) => {
                    res.status(200).json({
                        success: true,
                    });
                }
            );

            const response = await request(app)
                .get('/admin');

            expect(response.status).to.equal(403);
            expect(response.body.message).to.equal(
                'Forbidden: Requires admin privileges.'
            );
        });
    });
});