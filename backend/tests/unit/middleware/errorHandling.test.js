import { expect } from 'chai';
import {
    AppError,
    catchAsync,
    globalErrorHandler
} from '../../../middleware/errorHandling.js';

describe('Error Handling Middleware', () => {
    // ─────────────────────────────────────────────────────────────
    // AppError
    // ─────────────────────────────────────────────────────────────

    describe('AppError', () => {
        it('should create an operational error with the correct properties', () => {
            const error = new AppError('User not found', 404);

            expect(error).to.be.instanceOf(Error);
            expect(error.message).to.equal('User not found');
            expect(error.statusCode).to.equal(404);
            expect(error.status).to.equal('fail');
            expect(error.isOperational).to.equal(true);
            expect(error.stack).to.be.a('string');
        });

        it('should use "fail" status for 4xx errors', () => {
            const error400 = new AppError('Bad request', 400);
            const error401 = new AppError('Unauthorized', 401);
            const error403 = new AppError('Forbidden', 403);
            const error404 = new AppError('Not found', 404);

            expect(error400.status).to.equal('fail');
            expect(error401.status).to.equal('fail');
            expect(error403.status).to.equal('fail');
            expect(error404.status).to.equal('fail');
        });

        it('should use "error" status for non-4xx errors', () => {
            const error500 = new AppError('Internal error', 500);
            const error503 = new AppError('Service unavailable', 503);

            expect(error500.status).to.equal('error');
            expect(error503.status).to.equal('error');
        });

        it('should mark the error as operational', () => {
            const error = new AppError('Expected application error', 400);

            expect(error.isOperational).to.equal(true);
        });
    });

    // ─────────────────────────────────────────────────────────────
    // catchAsync
    // ─────────────────────────────────────────────────────────────

    describe('catchAsync', () => {
        it('should execute the wrapped async function', async () => {
            let executed = false;

            const asyncHandler = async (req, res, next) => {
                executed = true;
            };

            const wrapped = catchAsync(asyncHandler);

            wrapped({}, {}, () => {});

            await new Promise(resolve => setImmediate(resolve));

            expect(executed).to.equal(true);
        });

        it('should pass a rejected promise error to next()', async () => {
            const expectedError = new Error('Async failure');

            let receivedError = null;

            const asyncHandler = async () => {
                throw expectedError;
            };

            const wrapped = catchAsync(asyncHandler);

            wrapped({}, {}, error => {
                receivedError = error;
            });

            await new Promise(resolve => setImmediate(resolve));

            expect(receivedError).to.equal(expectedError);
        });

        it('should not call next() when the async function resolves successfully', async () => {
            let nextCalled = false;

            const asyncHandler = async () => {
                return 'success';
            };

            const wrapped = catchAsync(asyncHandler);

            wrapped({}, {}, () => {
                nextCalled = true;
            });

            await new Promise(resolve => setImmediate(resolve));

            expect(nextCalled).to.equal(false);
        });

        it('should pass the original request, response, and next arguments to the async function', async () => {
            const req = { id: 'request-123' };
            const res = { statusCode: 200 };
            const next = () => {};

            let receivedArguments;

            const asyncHandler = async (...args) => {
                receivedArguments = args;
            };

            const wrapped = catchAsync(asyncHandler);

            wrapped(req, res, next);

            await new Promise(resolve => setImmediate(resolve));

            expect(receivedArguments).to.have.length(3);
            expect(receivedArguments[0]).to.equal(req);
            expect(receivedArguments[1]).to.equal(res);
            expect(receivedArguments[2]).to.equal(next);
        });
    });

    // ─────────────────────────────────────────────────────────────
    // GLOBAL ERROR HANDLER
    // ─────────────────────────────────────────────────────────────

    describe('globalErrorHandler', () => {
        let originalNodeEnv;

        beforeEach(() => {
            originalNodeEnv = process.env.NODE_ENV;
        });

        afterEach(() => {
            if (originalNodeEnv === undefined) {
                delete process.env.NODE_ENV;
            } else {
                process.env.NODE_ENV = originalNodeEnv;
            }
        });

        const createResponse = () => {
            const response = {
                statusCode: null,
                body: null,

                status(code) {
                    this.statusCode = code;
                    return this;
                },

                json(body) {
                    this.body = body;
                    return this;
                }
            };

            return response;
        };

        it('should default statusCode to 500 when the error has no statusCode', () => {
            process.env.NODE_ENV = 'production';

            const error = new Error('Unexpected failure');
            const req = {};
            const res = createResponse();

            globalErrorHandler(error, req, res, () => {});

            expect(error.statusCode).to.equal(500);
            expect(res.statusCode).to.equal(500);
        });

        it('should default status to "error" when the error has no status', () => {
            process.env.NODE_ENV = 'production';

            const error = new Error('Unexpected failure');
            const req = {};
            const res = createResponse();

            globalErrorHandler(error, req, res, () => {});

            expect(error.status).to.equal('error');
        });

        // ─────────────────────────────────────────────────────────
        // DEVELOPMENT
        // ─────────────────────────────────────────────────────────

        describe('Development environment', () => {
            beforeEach(() => {
                process.env.NODE_ENV = 'development';
            });

            it('should return full error details', () => {
                const error = new AppError('Development error', 400);

                const req = {};
                const res = createResponse();

                globalErrorHandler(error, req, res, () => {});

                expect(res.statusCode).to.equal(400);

                expect(res.body).to.deep.equal({
                    status: 'fail',
                    error,
                    message: 'Development error',
                    stack: error.stack
                });
            });

            it('should expose stack trace in development', () => {
                const error = new Error('Debug error');

                const req = {};
                const res = createResponse();

                globalErrorHandler(error, req, res, () => {});

                expect(res.body.stack).to.equal(error.stack);
            });

            it('should preserve the original status code in development', () => {
                const error = new AppError('Forbidden', 403);

                const res = createResponse();

                globalErrorHandler(error, {}, res, () => {});

                expect(res.statusCode).to.equal(403);
                expect(res.body.status).to.equal('fail');
            });
        });

        // ─────────────────────────────────────────────────────────
        // PRODUCTION — OPERATIONAL ERROR
        // ─────────────────────────────────────────────────────────

        describe('Production operational errors', () => {
            beforeEach(() => {
                process.env.NODE_ENV = 'production';
            });

            it('should return the operational error message', () => {
                const error = new AppError(
                    'Invalid credentials',
                    401
                );

                const res = createResponse();

                globalErrorHandler(error, {}, res, () => {});

                expect(res.statusCode).to.equal(401);

                expect(res.body).to.deep.equal({
                    status: 'fail',
                    message: 'Invalid credentials'
                });
            });

            it('should not expose stack traces for operational errors', () => {
                const error = new AppError(
                    'Forbidden',
                    403
                );

                const res = createResponse();

                globalErrorHandler(error, {}, res, () => {});

                expect(res.body).to.not.have.property('stack');
                expect(res.body).to.not.have.property('error');
            });

            it('should preserve 4xx status codes for operational errors', () => {
                const statuses = [400, 401, 403, 404, 409, 422];

                for (const statusCode of statuses) {
                    const error = new AppError(
                        `Error ${statusCode}`,
                        statusCode
                    );

                    const res = createResponse();

                    globalErrorHandler(error, {}, res, () => {});

                    expect(res.statusCode).to.equal(statusCode);
                    expect(res.body.status).to.equal('fail');
                }
            });

            it('should preserve a 5xx status code for an operational error', () => {
                const error = new AppError(
                    'Service unavailable',
                    503
                );

                const res = createResponse();

                globalErrorHandler(error, {}, res, () => {});

                expect(res.statusCode).to.equal(503);
                expect(res.body).to.deep.equal({
                    status: 'error',
                    message: 'Service unavailable'
                });
            });
        });

        // ─────────────────────────────────────────────────────────
        // PRODUCTION — UNEXPECTED ERROR
        // ─────────────────────────────────────────────────────────

        describe('Production unexpected errors', () => {
            beforeEach(() => {
                process.env.NODE_ENV = 'production';
            });

            it('should hide unexpected error details', () => {
                const error = new Error(
                    'Database password or internal secret'
                );

                const res = createResponse();

                const originalConsoleError = console.error;
                console.error = () => {};

                try {
                    globalErrorHandler(error, {}, res, () => {});
                } finally {
                    console.error = originalConsoleError;
                }

                expect(res.statusCode).to.equal(500);

                expect(res.body).to.deep.equal({
                    status: 'error',
                    message: 'Something went wrong!'
                });
            });

            it('should not expose the original error message', () => {
                const error = new Error(
                    'Sensitive internal database error'
                );

                const res = createResponse();

                const originalConsoleError = console.error;
                console.error = () => {};

                try {
                    globalErrorHandler(error, {}, res, () => {});
                } finally {
                    console.error = originalConsoleError;
                }

                expect(res.body.message).to.not.equal(error.message);
                expect(res.body.message).to.equal(
                    'Something went wrong!'
                );
            });

            it('should not expose stack or error object', () => {
                const error = new Error('Internal implementation detail');

                const res = createResponse();

                const originalConsoleError = console.error;
                console.error = () => {};

                try {
                    globalErrorHandler(error, {}, res, () => {});
                } finally {
                    console.error = originalConsoleError;
                }

                expect(res.body).to.not.have.property('stack');
                expect(res.body).to.not.have.property('error');
            });

            it('should log unexpected errors in production', () => {
                const error = new Error('Unexpected production failure');

                const res = createResponse();

                let loggedError = null;

                const originalConsoleError = console.error;

                console.error = (...args) => {
                    loggedError = args;
                };

                try {
                    globalErrorHandler(error, {}, res, () => {});
                } finally {
                    console.error = originalConsoleError;
                }

                expect(loggedError).to.exist;
                expect(loggedError[0]).to.equal('🚨 ERROR:');
                expect(loggedError[1]).to.equal(error);
            });
        });
    });
});