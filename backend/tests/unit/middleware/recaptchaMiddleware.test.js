import { expect } from 'chai';
import sinon from 'sinon';
import esmock from 'esmock';

describe('verifyRecaptcha middleware', () => {
    let verifyRecaptcha;
    let axiosPostStub;
    let middleware;
    let req;
    let res;
    let next;

    beforeEach(async () => {
        process.env.NODE_ENV = 'production';
        process.env.RECAPTCHA_SECRET_KEY = 'test-recaptcha-secret';

        axiosPostStub = sinon.stub();

        ({ verifyRecaptcha } = await esmock(
            '../../../middleware/recaptchaMiddleware.js',
            {
                axios: {
                    default: {
                        post: axiosPostStub,
                    },
                },
            }
        ));

        req = {
            body: {
                'recaptcha-token': 'test-recaptcha-token',
            },
        };

        res = {
            status: sinon.stub().returnsThis(),
            json: sinon.stub().returnsThis(),
        };

        next = sinon.stub();
    });

    afterEach(() => {
        sinon.restore();
        delete process.env.RECAPTCHA_SECRET_KEY;
    });

    it('should call next() immediately in test environment', async () => {
        process.env.NODE_ENV = 'test';

        middleware = verifyRecaptcha('login');

        await middleware(req, res, next);

        expect(next.calledOnce).to.equal(true);
        expect(res.status.called).to.equal(false);
        expect(res.json.called).to.equal(false);
        expect(axiosPostStub.called).to.equal(false);
    });

    it('should return 400 when reCAPTCHA token is missing', async () => {
        req.body = {};

        middleware = verifyRecaptcha('login');

        await middleware(req, res, next);

        expect(res.status.calledOnceWithExactly(400)).to.equal(true);
        expect(
            res.json.calledOnceWithExactly({
                message: 'reCAPTCHA token is missing.',
            })
        ).to.equal(true);

        expect(next.called).to.equal(false);
        expect(axiosPostStub.called).to.equal(false);
    });

    it('should return 400 when reCAPTCHA token is empty', async () => {
        req.body['recaptcha-token'] = '';

        middleware = verifyRecaptcha('login');

        await middleware(req, res, next);

        expect(res.status.calledOnceWithExactly(400)).to.equal(true);
        expect(
            res.json.calledOnceWithExactly({
                message: 'reCAPTCHA token is missing.',
            })
        ).to.equal(true);

        expect(next.called).to.equal(false);
        expect(axiosPostStub.called).to.equal(false);
    });

    it('should call next() when reCAPTCHA verification succeeds with a valid score and action', async () => {
        axiosPostStub.resolves({
            data: {
                success: true,
                score: 0.9,
                action: 'login',
            },
        });

        middleware = verifyRecaptcha('login');

        await middleware(req, res, next);

        expect(next.calledOnce).to.equal(true);
        expect(res.status.called).to.equal(false);
        expect(res.json.called).to.equal(false);
        expect(axiosPostStub.calledOnce).to.equal(true);
    });

    it('should call next() when score is exactly 0.7', async () => {
        axiosPostStub.resolves({
            data: {
                success: true,
                score: 0.7,
                action: 'login',
            },
        });

        middleware = verifyRecaptcha('login');

        await middleware(req, res, next);

        expect(next.calledOnce).to.equal(true);
        expect(res.status.called).to.equal(false);
        expect(res.json.called).to.equal(false);
    });

    it('should return 401 when reCAPTCHA score is below 0.7', async () => {
        axiosPostStub.resolves({
            data: {
                success: true,
                score: 0.69,
                action: 'login',
            },
        });

        middleware = verifyRecaptcha('login');

        await middleware(req, res, next);

        expect(res.status.calledOnceWithExactly(401)).to.equal(true);
        expect(
            res.json.calledOnceWithExactly({
                message: 'reCAPTCHA verification failed. Please try again.',
            })
        ).to.equal(true);

        expect(next.called).to.equal(false);
    });

    it('should return 401 when reCAPTCHA action does not match expected action', async () => {
        axiosPostStub.resolves({
            data: {
                success: true,
                score: 0.95,
                action: 'signup',
            },
        });

        middleware = verifyRecaptcha('login');

        await middleware(req, res, next);

        expect(res.status.calledOnceWithExactly(401)).to.equal(true);
        expect(
            res.json.calledOnceWithExactly({
                message: 'reCAPTCHA verification failed. Please try again.',
            })
        ).to.equal(true);

        expect(next.called).to.equal(false);
    });

    it('should return 401 when Google reports success as false', async () => {
        axiosPostStub.resolves({
            data: {
                success: false,
                score: 0.9,
                action: 'login',
                'error-codes': ['invalid-input-response'],
            },
        });

        middleware = verifyRecaptcha('login');

        await middleware(req, res, next);

        expect(res.status.calledOnceWithExactly(401)).to.equal(true);
        expect(
            res.json.calledOnceWithExactly({
                message: 'reCAPTCHA verification failed. Please try again.',
            })
        ).to.equal(true);

        expect(next.called).to.equal(false);
    });

    it('should return 401 when score is missing', async () => {
        axiosPostStub.resolves({
            data: {
                success: true,
                action: 'login',
            },
        });

        middleware = verifyRecaptcha('login');

        await middleware(req, res, next);

        expect(res.status.calledOnceWithExactly(401)).to.equal(true);
        expect(next.called).to.equal(false);
    });

    it('should return 401 when action is missing', async () => {
        axiosPostStub.resolves({
            data: {
                success: true,
                score: 0.9,
            },
        });

        middleware = verifyRecaptcha('login');

        await middleware(req, res, next);

        expect(res.status.calledOnceWithExactly(401)).to.equal(true);
        expect(next.called).to.equal(false);
    });

    it('should send the token and secret in the POST body using form-urlencoded content type', async () => {
        axiosPostStub.resolves({
            data: {
                success: true,
                score: 0.9,
                action: 'login',
            },
        });

        middleware = verifyRecaptcha('login');

        await middleware(req, res, next);

        expect(axiosPostStub.calledOnce).to.equal(true);

        const [url, body, config] = axiosPostStub.firstCall.args;

        expect(url).to.equal(
            'https://www.google.com/recaptcha/api/siteverify'
        );

        expect(body).to.equal(
            'secret=test-recaptcha-secret&response=test-recaptcha-token'
        );

        expect(config).to.deep.equal({
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });
    });

    it('should use the expected action supplied to verifyRecaptcha()', async () => {
        axiosPostStub.resolves({
            data: {
                success: true,
                score: 0.9,
                action: 'signup',
            },
        });

        middleware = verifyRecaptcha('signup');

        await middleware(req, res, next);

        expect(next.calledOnce).to.equal(true);
    });

    it('should return 500 when the Google verification request fails', async () => {
        axiosPostStub.rejects(new Error('Google reCAPTCHA API unavailable'));

        middleware = verifyRecaptcha('login');

        await middleware(req, res, next);

        expect(res.status.calledOnceWithExactly(500)).to.equal(true);
        expect(
            res.json.calledOnceWithExactly({
                message: 'Server error during reCAPTCHA verification.',
            })
        ).to.equal(true);

        expect(next.called).to.equal(false);
    });

    it('should return 500 when Axios rejects with a network error', async () => {
        axiosPostStub.rejects({
            message: 'Network Error',
        });

        middleware = verifyRecaptcha('signup');

        await middleware(req, res, next);

        expect(res.status.calledOnceWithExactly(500)).to.equal(true);
        expect(
            res.json.calledOnceWithExactly({
                message: 'Server error during reCAPTCHA verification.',
            })
        ).to.equal(true);

        expect(next.called).to.equal(false);
    });

    it('should reject a score of 0', async () => {
        axiosPostStub.resolves({
            data: {
                success: true,
                score: 0,
                action: 'login',
            },
        });

        middleware = verifyRecaptcha('login');

        await middleware(req, res, next);

        expect(res.status.calledOnceWithExactly(401)).to.equal(true);
        expect(next.called).to.equal(false);
    });

    it('should reject an action with different casing', async () => {
        axiosPostStub.resolves({
            data: {
                success: true,
                score: 0.95,
                action: 'Login',
            },
        });

        middleware = verifyRecaptcha('login');

        await middleware(req, res, next);

        expect(res.status.calledOnceWithExactly(401)).to.equal(true);
        expect(next.called).to.equal(false);
    });
});