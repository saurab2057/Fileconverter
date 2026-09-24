import { expect } from 'chai';

describe('Security Middleware Configuration', () => {
    let security;

    before(async () => {
        /*
         * security.js reads NODE_ENV when helmetOptions is created,
         * so load it once with the test environment.
         */
        process.env.NODE_ENV = 'test';

        security = await import(
            '../../../middleware/security.js?security-test'
        );
    });

    // ─────────────────────────────────────────────────────────────
    // CORS ORIGIN
    // ─────────────────────────────────────────────────────────────

    describe('CORS origin validation', () => {
        let originalFrontendUrl;

        beforeEach(() => {
            originalFrontendUrl = process.env.FRONTEND_URL;
            delete process.env.FRONTEND_URL;
        });

        afterEach(() => {
            if (originalFrontendUrl === undefined) {
                delete process.env.FRONTEND_URL;
            } else {
                process.env.FRONTEND_URL = originalFrontendUrl;
            }
        });

        const checkOrigin = origin =>
            new Promise((resolve, reject) => {
                security.corsOptions.origin(origin, (error, allowed) => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve(allowed);
                });
            });

        it('should allow requests with no Origin header', async () => {
            const result = await checkOrigin(undefined);

            expect(result).to.equal(true);
        });

        it('should allow localhost development origin on port 5173', async () => {
            const result = await checkOrigin(
                'http://localhost:5173'
            );

            expect(result).to.equal(true);
        });

        it('should allow localhost preview origin on port 4173', async () => {
            const result = await checkOrigin(
                'http://localhost:4173'
            );

            expect(result).to.equal(true);
        });

        it('should allow the deployed Vercel frontend', async () => {
            const result = await checkOrigin(
                'https://fileconverter-mu.vercel.app'
            );

            expect(result).to.equal(true);
        });

        it('should allow FRONTEND_URL from environment variables', async () => {
            process.env.FRONTEND_URL =
                'https://example-frontend.vercel.app';

            const result = await checkOrigin(
                'https://example-frontend.vercel.app'
            );

            expect(result).to.equal(true);
        });

        it('should normalize a trailing slash in FRONTEND_URL', async () => {
            process.env.FRONTEND_URL =
                'https://example-frontend.vercel.app/';

            const result = await checkOrigin(
                'https://example-frontend.vercel.app'
            );

            expect(result).to.equal(true);
        });

        it('should normalize a trailing slash in the request Origin', async () => {
            const result = await checkOrigin(
                'http://localhost:5173/'
            );

            expect(result).to.equal(true);
        });

        it('should trim whitespace from FRONTEND_URL', async () => {
            process.env.FRONTEND_URL =
                '  https://example-frontend.vercel.app/  ';

            const result = await checkOrigin(
                'https://example-frontend.vercel.app'
            );

            expect(result).to.equal(true);
        });

        it('should reject an unauthorized origin', async () => {
            try {
                await checkOrigin('https://evil.example.com');

                expect.fail(
                    'Expected CORS validation to reject the origin'
                );
            } catch (error) {
                expect(error).to.be.instanceOf(Error);
                expect(error.message).to.equal(
                    'This origin is not allowed by the CORS policy.'
                );
            }
        });

        it('should reject an origin that only partially matches an allowed origin', async () => {
            try {
                await checkOrigin(
                    'https://fileconverter-mu.vercel.app.evil.com'
                );

                expect.fail(
                    'Expected CORS validation to reject the origin'
                );
            } catch (error) {
                expect(error.message).to.equal(
                    'This origin is not allowed by the CORS policy.'
                );
            }
        });

        it('should reject an origin with a different protocol', async () => {
            try {
                await checkOrigin(
                    'http://fileconverter-mu.vercel.app'
                );

                expect.fail(
                    'Expected CORS validation to reject the origin'
                );
            } catch (error) {
                expect(error.message).to.equal(
                    'This origin is not allowed by the CORS policy.'
                );
            }
        });
    });

    // ─────────────────────────────────────────────────────────────
    // CORS OPTIONS
    // ─────────────────────────────────────────────────────────────

    describe('CORS configuration', () => {
        it('should allow GET requests', () => {
            expect(security.corsOptions.methods).to.include('GET');
        });

        it('should allow POST requests', () => {
            expect(security.corsOptions.methods).to.include('POST');
        });

        it('should allow PUT requests', () => {
            expect(security.corsOptions.methods).to.include('PUT');
        });

        it('should allow DELETE requests', () => {
            expect(security.corsOptions.methods).to.include('DELETE');
        });

        it('should allow PATCH requests', () => {
            expect(security.corsOptions.methods).to.include('PATCH');
        });

        it('should allow OPTIONS requests', () => {
            expect(security.corsOptions.methods).to.include('OPTIONS');
        });

        it('should allow Content-Type header', () => {
            expect(security.corsOptions.allowedHeaders).to.include(
                'Content-Type'
            );
        });

        it('should allow Authorization header', () => {
            expect(security.corsOptions.allowedHeaders).to.include(
                'Authorization'
            );
        });

        it('should allow Cookie header', () => {
            expect(security.corsOptions.allowedHeaders).to.include(
                'Cookie'
            );
        });

        it('should allow X-Request-ID header', () => {
            expect(security.corsOptions.allowedHeaders).to.include(
                'X-Request-ID'
            );
        });

        it('should allow credentials', () => {
            expect(security.corsOptions.credentials).to.equal(true);
        });
    });

    // ─────────────────────────────────────────────────────────────
    // HELMET
    // ─────────────────────────────────────────────────────────────

    describe('Helmet configuration', () => {
        it('should disable Cross-Origin Embedder Policy', () => {
            expect(
                security.helmetOptions.crossOriginEmbedderPolicy
            ).to.equal(false);
        });

        it('should allow Google OAuth popups through COOP', () => {
            expect(
                security.helmetOptions.crossOriginOpenerPolicy.policy
            ).to.equal('same-origin-allow-popups');
        });

        it('should enable X-Content-Type-Options / noSniff', () => {
            expect(security.helmetOptions.noSniff).to.equal(true);
        });

        it('should configure Content Security Policy', () => {
            expect(
                security.helmetOptions.contentSecurityPolicy
            ).to.exist;

            expect(
                security.helmetOptions.contentSecurityPolicy.directives
            ).to.be.an('object');
        });

        it('should restrict default sources to self', () => {
            expect(
                security.helmetOptions.contentSecurityPolicy
                    .directives.defaultSrc
            ).to.deep.equal(["'self'"]);
        });

        it('should allow Google OAuth scripts', () => {
            const scripts =
                security.helmetOptions.contentSecurityPolicy
                    .directives.scriptSrc;

            expect(scripts).to.include(
                'https://accounts.google.com/gsi/client'
            );

            expect(scripts).to.include(
                'https://apis.google.com'
            );

            expect(scripts).to.include(
                'https://www.google.com'
            );

            expect(scripts).to.include(
                'https://www.gstatic.com'
            );
        });

        it('should allow Google and application styles', () => {
            const styles =
                security.helmetOptions.contentSecurityPolicy
                    .directives.styleSrc;

            expect(styles).to.include("'self'");
            expect(styles).to.include(
                'https://accounts.google.com'
            );
            expect(styles).to.include(
                'https://fonts.googleapis.com'
            );
        });

        it('should allow Google profile images', () => {
            const images =
                security.helmetOptions.contentSecurityPolicy
                    .directives.imgSrc;

            expect(images).to.include(
                'https://*.googleusercontent.com'
            );

            expect(images).to.include(
                'https://lh3.googleusercontent.com'
            );

            expect(images).to.include(
                'https://lh4.googleusercontent.com'
            );
        });

        it('should allow Cloudinary images', () => {
            const images =
                security.helmetOptions.contentSecurityPolicy
                    .directives.imgSrc;

            expect(images).to.include(
                'https://res.cloudinary.com'
            );
        });

        it('should allow Google OAuth frames', () => {
            const frames =
                security.helmetOptions.contentSecurityPolicy
                    .directives.frameSrc;

            expect(frames).to.include(
                'https://accounts.google.com'
            );

            expect(frames).to.include(
                'https://www.google.com'
            );
        });

        it('should allow Google API connections', () => {
            const connect =
                security.helmetOptions.contentSecurityPolicy
                    .directives.connectSrc;

            expect(connect).to.include(
                'https://accounts.google.com'
            );

            expect(connect).to.include(
                'https://www.googleapis.com'
            );

            expect(connect).to.include(
                'https://www.google.com'
            );
        });

        it('should allow the production backend connection', () => {
            const connect =
                security.helmetOptions.contentSecurityPolicy
                    .directives.connectSrc;

            expect(connect).to.include(
                'https://backend-kijk.onrender.com'
            );
        });

        it('should allow Resend API connections', () => {
            const connect =
                security.helmetOptions.contentSecurityPolicy
                    .directives.connectSrc;

            expect(connect).to.include(
                'https://api.resend.com'
            );
        });

        it('should restrict base URI to self', () => {
            expect(
                security.helmetOptions.contentSecurityPolicy
                    .directives.baseUri
            ).to.deep.equal(["'self'"]);
        });

        it('should restrict form actions to self', () => {
            expect(
                security.helmetOptions.contentSecurityPolicy
                    .directives.formAction
            ).to.deep.equal(["'self'"]);
        });

        it('should disable object/embed resources', () => {
            expect(
                security.helmetOptions.contentSecurityPolicy
                    .directives.objectSrc
            ).to.deep.equal(["'none'"]);
        });

        it('should prevent clickjacking through frame ancestors', () => {
            expect(
                security.helmetOptions.contentSecurityPolicy
                    .directives.frameAncestors
            ).to.deep.equal(["'none'"]);
        });

        it('should enable HTTPS upgrade', () => {
            expect(
                security.helmetOptions.contentSecurityPolicy
                    .directives.upgradeInsecureRequests
            ).to.deep.equal([]);
        });

        it('should configure font sources', () => {
            const fonts =
                security.helmetOptions.contentSecurityPolicy
                    .directives.fontSrc;

            expect(fonts).to.include("'self'");
            expect(fonts).to.include(
                'https://fonts.gstatic.com'
            );
        });
    });

    // ─────────────────────────────────────────────────────────────
    // HSTS
    // ─────────────────────────────────────────────────────────────

    describe('HSTS configuration', () => {
        it('should enable HSTS configuration', () => {
            expect(security.helmetOptions.hsts).to.exist;
        });

        it('should include subdomains', () => {
            expect(
                security.helmetOptions.hsts.includeSubDomains
            ).to.equal(true);
        });

        it('should enable preload', () => {
            expect(
                security.helmetOptions.hsts.preload
            ).to.equal(true);
        });

        it('should use maxAge 0 outside production', () => {
            expect(
                security.helmetOptions.hsts.maxAge
            ).to.equal(0);
        });
    });

    // ─────────────────────────────────────────────────────────────
    // EXPORTED MIDDLEWARES
    // ─────────────────────────────────────────────────────────────

    describe('Exported middleware dependencies', () => {
        it('should export cookieParser', () => {
            expect(security.cookieParser).to.be.a('function');
        });

        it('should export morgan', () => {
            expect(security.morgan).to.be.a('function');
        });
    });
});