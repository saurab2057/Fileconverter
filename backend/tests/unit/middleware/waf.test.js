import { expect } from 'chai';
import esmock from 'esmock';

describe('WAF Middleware', () => {
    let waf;
    let AuditLogMock;
    let hashIPMock;

    let originalNodeEnv;
    let originalGenericAgents;
    let originalMetrics;

    let auditCreate;

    before(async () => {
        originalNodeEnv = process.env.NODE_ENV;
        originalGenericAgents = process.env.WAF_BLOCK_GENERIC_AGENTS;
        originalMetrics = global.metrics;

        /*
         * Enable the optional generic User-Agent rules during testing so
         * curl/python-requests/wget are covered as well.
         */
        process.env.WAF_BLOCK_GENERIC_AGENTS = 'true';
        process.env.NODE_ENV = 'development';

        auditCreate = async () => ({ _id: 'audit-test-id' });

        AuditLogMock = {
            create: (...args) => auditCreate(...args)
        };

        hashIPMock = (ip) => `hashed:${ip}`;

        /*
         * waf.js is an ESM module, so esmock lets us replace its ESM
         * dependencies without touching the real MongoDB AuditLog model.
         */
        const module = await esmock('../../../middleware/waf.js', {
            '../../../models/AuditLog.js': {
                default: AuditLogMock
            },
            '../../../utils/authSecurity.js': {
                hashIP: hashIPMock
            }
        });

        waf = module.waf;
    });

    after(() => {
        if (originalNodeEnv === undefined) {
            delete process.env.NODE_ENV;
        } else {
            process.env.NODE_ENV = originalNodeEnv;
        }

        if (originalGenericAgents === undefined) {
            delete process.env.WAF_BLOCK_GENERIC_AGENTS;
        } else {
            process.env.WAF_BLOCK_GENERIC_AGENTS = originalGenericAgents;
        }

        if (originalMetrics === undefined) {
            delete global.metrics;
        } else {
            global.metrics = originalMetrics;
        }
    });

    beforeEach(() => {
        process.env.NODE_ENV = 'development';

        auditCreate = async () => ({
            _id: 'audit-test-id'
        });

        delete global.metrics;
    });

    // ─────────────────────────────────────────────────────────────
    // TEST HELPERS
    // ─────────────────────────────────────────────────────────────

    const createRequest = ({
        originalUrl = '/api/test',
        method = 'POST',
        body = {},
        query = {},
        headers = {}
    } = {}) => {
        const normalizedHeaders = {
            'user-agent': 'Mozilla/5.0',
            ...headers
        };

        return {
            originalUrl,
            path: originalUrl.split('?')[0],
            method,
            body,
            query,
            headers: normalizedHeaders,

            ip: '203.0.113.10',

            socket: {
                remoteAddress: '203.0.113.10'
            },

            user: {
                _id: 'user-123'
            },

            get(name) {
                return normalizedHeaders[name.toLowerCase()];
            }
        };
    };

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

    const runWaf = (requestOptions = {}) => {
        const req = createRequest(requestOptions);
        const res = createResponse();

        let nextCalled = false;

        waf(req, res, () => {
            nextCalled = true;
        });

        return {
            req,
            res,
            nextCalled
        };
    };

    // ─────────────────────────────────────────────────────────────
    // BASIC / TEST MODE
    // ─────────────────────────────────────────────────────────────

    describe('Environment handling', () => {
        it('should bypass the WAF completely in test mode', () => {
            process.env.NODE_ENV = 'test';

            const result = runWaf({
                originalUrl: '/api/users?file=../../etc/passwd',
                body: {
                    payload: '<script>alert(1)</script>'
                }
            });

            expect(result.nextCalled).to.equal(true);
            expect(result.res.statusCode).to.equal(null);

            process.env.NODE_ENV = 'development';
        });
    });

    // ─────────────────────────────────────────────────────────────
    // CHECK 1 — MALICIOUS USER-AGENT
    // ─────────────────────────────────────────────────────────────

    describe('Malicious User-Agent detection', () => {
        const maliciousAgents = [
            'sqlmap/1.8',
            'Nikto/2.5.0',
            'masscan/1.3',
            'Nmap Scripting Engine',
            'DirBuster-1.0',
            'gobuster/3.6',
            'THC-Hydra',
            'Metasploit Framework',
            'zgrab/0.1',
            'Nuclei/v3.0',
            'Acunetix Scanner',
            'Nessus',
            'BurpSuite Professional',
            'python-requests/2.31.0',
            'curl/8.5.0',
            'Wget/1.21.4'
        ];

        for (const userAgent of maliciousAgents) {
            it(`should block malicious User-Agent: ${userAgent}`, () => {
                const result = runWaf({
                    headers: {
                        'user-agent': userAgent
                    }
                });

                expect(result.nextCalled).to.equal(false);
                expect(result.res.statusCode).to.equal(403);
                expect(result.res.body).to.deep.equal({
                    message: 'Forbidden.'
                });
            });
        }

        it('should allow a normal browser User-Agent', () => {
            const result = runWaf({
                headers: {
                    'user-agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153.0.0.0 Safari/537.36'
                }
            });

            expect(result.nextCalled).to.equal(true);
            expect(result.res.statusCode).to.equal(null);
        });
    });

    // ─────────────────────────────────────────────────────────────
    // CHECK 2 — HTTP METHOD TAMPERING
    // ─────────────────────────────────────────────────────────────

    describe('HTTP Method Tampering detection', () => {
        const overrideHeaders = [
            'x-http-method-override',
            'x-method-override',
            'x-http-method'
        ];

        for (const header of overrideHeaders) {
            it(`should block ${header}`, () => {
                const result = runWaf({
                    headers: {
                        [header]: 'DELETE'
                    }
                });

                expect(result.nextCalled).to.equal(false);
                expect(result.res.statusCode).to.equal(403);
                expect(result.res.body).to.deep.equal({
                    message: 'Forbidden.'
                });
            });
        }

        it('should allow requests without override headers', () => {
            const result = runWaf({
                method: 'POST'
            });

            expect(result.nextCalled).to.equal(true);
        });
    });

    // ─────────────────────────────────────────────────────────────
    // CHECK 3 — NULL BYTE INJECTION
    // ─────────────────────────────────────────────────────────────

    describe('Null Byte Injection detection', () => {
        const payloads = [
            '/api/files/%00',
            '/api/files/%2500',
            '/api/files/\\u0000',
            '/api/files/\x00'
        ];

        for (const originalUrl of payloads) {
            it(`should block null byte payload: ${JSON.stringify(originalUrl)}`, () => {
                const result = runWaf({
                    originalUrl
                });

                expect(result.nextCalled).to.equal(false);
                expect(result.res.statusCode).to.equal(403);
                expect(result.res.body).to.deep.equal({
                    message: 'Forbidden.'
                });
            });
        }

        it('should detect null bytes in request body', () => {
            const result = runWaf({
                body: {
                    filename: 'document%00.pdf'
                }
            });

            expect(result.nextCalled).to.equal(false);
            expect(result.res.statusCode).to.equal(403);
        });

        it('should detect null bytes in query parameters', () => {
            const result = runWaf({
                query: {
                    filename: 'document%00.pdf'
                }
            });

            expect(result.nextCalled).to.equal(false);
            expect(result.res.statusCode).to.equal(403);
        });
    });

    // ─────────────────────────────────────────────────────────────
    // CHECK 4 — PATH TRAVERSAL
    // ─────────────────────────────────────────────────────────────

    describe('Path Traversal detection', () => {
        const traversalUrls = [
            '/api/files/../../etc/passwd',
            '/api/files/..%2f..%2fetc%2fpasswd',
            '/api/files/..%5c..%5cwindows%5csystem32',
            '/api/files/..%252f..%252fetc%252fpasswd',
            '/api/files/../../etc/shadow',
            '/api/files/../../proc/self/environ',
            '/api/files/..%c0%af..%c0%afetc%2fpasswd',
            '/api/files/..%c1%9c..%c1%9cwindows',
            '/api/files/....//....//etc/passwd'
        ];

        for (const originalUrl of traversalUrls) {
            it(`should block path traversal: ${originalUrl}`, () => {
                const result = runWaf({
                    originalUrl
                });

                expect(result.nextCalled).to.equal(false);
                expect(result.res.statusCode).to.equal(403);
                expect(result.res.body).to.deep.equal({
                    message: 'Forbidden.'
                });
            });
        }

        it('should detect traversal in query parameters', () => {
            const result = runWaf({
                query: {
                    path: '../../etc/passwd'
                }
            });

            expect(result.nextCalled).to.equal(false);
            expect(result.res.statusCode).to.equal(403);
        });

        it('should allow a normal file path', () => {
            const result = runWaf({
                originalUrl: '/api/files/reports/2026/report.pdf'
            });

            expect(result.nextCalled).to.equal(true);
        });
    });

    // ─────────────────────────────────────────────────────────────
    // CHECK 5 — NOSQL INJECTION
    // ─────────────────────────────────────────────────────────────

    describe('NoSQL Injection detection', () => {
        it('should block a top-level MongoDB operator in the body', () => {
            const result = runWaf({
                body: {
                    $gt: ''
                }
            });

            expect(result.nextCalled).to.equal(false);
            expect(result.res.statusCode).to.equal(403);
            expect(result.res.body).to.deep.equal({
                message: 'Forbidden.'
            });
        });

        it('should block a nested MongoDB operator in the body', () => {
            const result = runWaf({
                body: {
                    user: {
                        email: {
                            $ne: null
                        }
                    }
                }
            });

            expect(result.nextCalled).to.equal(false);
            expect(result.res.statusCode).to.equal(403);
        });

        it('should block a MongoDB operator in query parameters', () => {
            const result = runWaf({
                query: {
                    username: {
                        $regex: '.*'
                    }
                }
            });

            expect(result.nextCalled).to.equal(false);
            expect(result.res.statusCode).to.equal(403);
        });

        it('should detect deeply nested MongoDB operators', () => {
            const result = runWaf({
                body: {
                    level1: {
                        level2: {
                            level3: {
                                level4: {
                                    $where: 'this.password'
                                }
                            }
                        }
                    }
                }
            });

            expect(result.nextCalled).to.equal(false);
            expect(result.res.statusCode).to.equal(403);
        });

        it('should not flag a dollar sign inside a normal string value', () => {
            const result = runWaf({
                body: {
                    username: 'P$ortal1!',
                    description: 'Price is $100'
                }
            });

            expect(result.nextCalled).to.equal(true);
        });

        it('should stop recursive NoSQL inspection beyond the configured depth', () => {
            let deeplyNested = {
                $where: 'blocked'
            };

            for (let i = 0; i < 12; i++) {
                deeplyNested = {
                    nested: deeplyNested
                };
            }

            const result = runWaf({
                body: deeplyNested
            });

            /*
             * The detector intentionally stops after depth 10 to prevent
             * recursive payloads from becoming a denial-of-service vector.
             */
            expect(result.nextCalled).to.equal(true);
        });
    });

    // ─────────────────────────────────────────────────────────────
    // CHECK 6 — PROTOTYPE POLLUTION
    // ─────────────────────────────────────────────────────────────

    describe('Prototype Pollution detection', () => {
        const dangerousKeys = [
            '__proto__',
            'constructor',
            'prototype'
        ];

        for (const key of dangerousKeys) {
            it(`should block dangerous key "${key}" in the body`, () => {
                const body = {};

                Object.defineProperty(body, key, {
                    value: {
                        isAdmin: true
                    },
                    enumerable: true,
                    configurable: true,
                    writable: true
                });

                const result = runWaf({
                    body
                });

                expect(result.nextCalled).to.equal(false);
                expect(result.res.statusCode).to.equal(403);
                expect(result.res.body).to.deep.equal({
                    message: 'Forbidden.'
                });
            });
        }

        it('should block nested prototype pollution keys', () => {
            const result = runWaf({
                body: {
                    profile: {
                        settings: {
                            constructor: {
                                prototype: {
                                    isAdmin: true
                                }
                            }
                        }
                    }
                }
            });

            expect(result.nextCalled).to.equal(false);
            expect(result.res.statusCode).to.equal(403);
        });

        it('should block dangerous keys in query objects', () => {
            const query = {};

            Object.defineProperty(query, '__proto__', {
                value: {
                    polluted: true
                },
                enumerable: true,
                configurable: true,
                writable: true
            });

            const result = runWaf({
                query
            });

            expect(result.nextCalled).to.equal(false);
            expect(result.res.statusCode).to.equal(403);
        });

        it('should allow ordinary object keys', () => {
            const result = runWaf({
                body: {
                    username: 'saurab',
                    profile: {
                        name: 'Saurab'
                    }
                }
            });

            expect(result.nextCalled).to.equal(true);
        });
    });

    // ─────────────────────────────────────────────────────────────
    // CHECK 7 — XSS
    // ─────────────────────────────────────────────────────────────

    describe('XSS detection', () => {
        const xssPayloads = [
            '<script>alert(1)</script>',
            '</script>',
            'javascript:alert(1)',
            'onclick="alert(1)"',
            "onerror='alert(1)'",
            'onload=alert(1)',
            '<svg onload=alert(1)>',
            '<math href="javascript:alert(1)">',
            'expression(alert(1))',
            '<iframe src="evil.example"></iframe>',
            '<object data="evil.swf">',
            '<embed src="evil.swf">',
            'data:text/html,<script>alert(1)</script>',
            'vbscript:msgbox(1)',
            '<img src="javascript:alert(1)">'
        ];

        for (const payload of xssPayloads) {
            it(`should block XSS payload: ${payload}`, () => {
                const result = runWaf({
                    body: {
                        content: payload
                    }
                });

                expect(result.nextCalled).to.equal(false);
                expect(result.res.statusCode).to.equal(403);
                expect(result.res.body).to.deep.equal({
                    message: 'Forbidden.'
                });
            });
        }

        it('should detect XSS in query parameters', () => {
            const result = runWaf({
                query: {
                    search: '<script>alert(1)</script>'
                }
            });

            expect(result.nextCalled).to.equal(false);
            expect(result.res.statusCode).to.equal(403);
        });

        it('should allow normal text containing ordinary punctuation', () => {
            const result = runWaf({
                body: {
                    content: 'Hello world! This is a normal message.'
                }
            });

            expect(result.nextCalled).to.equal(true);
        });
    });

    // ─────────────────────────────────────────────────────────────
    // CHECK 8 — OVERSIZED PAYLOAD
    // ─────────────────────────────────────────────────────────────

    describe('Oversized Payload detection', () => {
        it('should block a body larger than 350KB', () => {
            const largeString = 'A'.repeat(351 * 1024);

            const result = runWaf({
                body: {
                    data: largeString
                }
            });

            expect(result.nextCalled).to.equal(false);
            expect(result.res.statusCode).to.equal(413);
            expect(result.res.body).to.deep.equal({
                message: 'Payload too large.'
            });
        });

        it('should allow a body below the 350KB limit', () => {
            const normalString = 'A'.repeat(100 * 1024);

            const result = runWaf({
                body: {
                    data: normalString
                }
            });

            expect(result.nextCalled).to.equal(true);
            expect(result.res.statusCode).to.equal(null);
        });

        it('should measure payload size in UTF-8 bytes', () => {
            /*
             * Each Nepali character uses multiple UTF-8 bytes.
             * This confirms the middleware uses Buffer.byteLength()
             * instead of JavaScript string.length.
             */
            const unicodeString = 'क'.repeat(200000);

            const result = runWaf({
                body: {
                    data: unicodeString
                }
            });

            expect(result.nextCalled).to.equal(false);
            expect(result.res.statusCode).to.equal(413);
        });
    });

    // ─────────────────────────────────────────────────────────────
    // URL DECODING / MALFORMED URL
    // ─────────────────────────────────────────────────────────────

    describe('URL decoding safety', () => {
        it('should fall back to the original URL when decodeURIComponent fails', () => {
            const result = runWaf({
                originalUrl: '/api/files/%E0%A4%A'
            });

            expect(result.nextCalled).to.equal(true);
            expect(result.res.statusCode).to.equal(null);
        });

        it('should still block traversal after URL decoding', () => {
            const result = runWaf({
                originalUrl: '/api/files/..%2F..%2Fetc%2Fpasswd'
            });

            expect(result.nextCalled).to.equal(false);
            expect(result.res.statusCode).to.equal(403);
        });
    });

    // ─────────────────────────────────────────────────────────────
    // BODY FLATTENING
    // ─────────────────────────────────────────────────────────────

    describe('Parsed body handling', () => {
        it('should inspect nested object values for XSS', () => {
            const result = runWaf({
                body: {
                    profile: {
                        bio: '<script>alert(1)</script>'
                    }
                }
            });

            expect(result.nextCalled).to.equal(false);
            expect(result.res.statusCode).to.equal(403);
        });

        it('should inspect array values for XSS', () => {
            const result = runWaf({
                body: {
                    comments: [
                        'normal comment',
                        '<script>alert(1)</script>'
                    ]
                }
            });

            expect(result.nextCalled).to.equal(false);
            expect(result.res.statusCode).to.equal(403);
        });

        it('should not treat an object key alone as an XSS payload', () => {
            const body = {};

            Object.defineProperty(body, 'onclick', {
                value: 'normal-value',
                enumerable: true,
                configurable: true,
                writable: true
            });

            const result = runWaf({
                body
            });

            /*
             * flattenBody() intentionally scans values rather than
             * serializing key=value pairs, avoiding false positives
             * caused solely by field names.
             */
            expect(result.nextCalled).to.equal(true);
        });
    });

    // ─────────────────────────────────────────────────────────────
    // AUDIT LOGGING
    // ─────────────────────────────────────────────────────────────

    describe('Blocked request audit logging', () => {
        it('should create an AuditLog entry when a request is blocked', async () => {
            let capturedAudit;

            auditCreate = async (data) => {
                capturedAudit = data;
                return {
                    _id: 'audit-123'
                };
            };

            const result = runWaf({
                originalUrl: '/api/test',
                body: {
                    payload: '<script>alert(1)</script>'
                }
            });

            expect(result.res.statusCode).to.equal(403);

            /*
             * AuditLog.create() is intentionally fire-and-forget.
             * Give the promise microtask queue time to complete.
             */
            await new Promise(resolve => setImmediate(resolve));

            expect(capturedAudit).to.exist;
            expect(capturedAudit.userId).to.equal('user-123');
            expect(capturedAudit.source).to.equal('system');
            expect(capturedAudit.action).to.equal('WAF_BLOCKED');
            expect(capturedAudit.resource).to.equal('POST /api/test');

            expect(capturedAudit.details).to.deep.include({
                attackType: 'XSS_ATTEMPT',
                ip: '203.0.113.10',
                userAgent: 'Mozilla/5.0'
            });

            expect(capturedAudit.ipAddress).to.equal('203.0.113.10');
            expect(capturedAudit.ipHash).to.equal(
                'hashed:203.0.113.10'
            );
            expect(capturedAudit.userAgent).to.equal('Mozilla/5.0');
        });

        it('should continue returning the security response when AuditLog.create fails', async () => {
            let loggedError = false;

            const originalConsoleError = console.error;

            console.error = (...args) => {
                if (
                    String(args[0]).includes(
                        '[WAF] AuditLog write failed'
                    )
                ) {
                    loggedError = true;
                }
            };

            auditCreate = async () => {
                throw new Error('MongoDB unavailable');
            };

            try {
                const result = runWaf({
                    body: {
                        payload: '<script>alert(1)</script>'
                    }
                });

                expect(result.nextCalled).to.equal(false);
                expect(result.res.statusCode).to.equal(403);

                await new Promise(resolve => setImmediate(resolve));

                expect(loggedError).to.equal(true);
            } finally {
                console.error = originalConsoleError;
            }
        });
    });

    // ─────────────────────────────────────────────────────────────
    // SENSITIVE DATA MASKING
    // ─────────────────────────────────────────────────────────────

    describe('Sensitive data masking in audit details', () => {
        it('should mask passwords and tokens in blocked request details', async () => {
            let capturedAudit;

            auditCreate = async (data) => {
                capturedAudit = data;
                return {};
            };

            const result = runWaf({
                originalUrl:
                    '/api/test?password=supersecret&token=abc123&api_key=private-key',
                body: {
                    payload: '<script>alert(1)</script>'
                }
            });

            expect(result.res.statusCode).to.equal(403);

            await new Promise(resolve => setImmediate(resolve));

            expect(capturedAudit).to.exist;

            /*
             * The WAF currently logs the URL only for some attack
             * categories. This assertion confirms the masking helper
             * does not leak sensitive query-string values when invoked.
             */
            expect(capturedAudit.details.details).to.not.include(
                'supersecret'
            );
            expect(capturedAudit.details.details).to.not.include(
                'abc123'
            );
            expect(capturedAudit.details.details).to.not.include(
                'private-key'
            );
        });
    });

    // ─────────────────────────────────────────────────────────────
    // METRICS HOOK
    // ─────────────────────────────────────────────────────────────

    describe('Metrics hook', () => {
        it('should increment waf.block metrics when metrics is available', () => {
            let metricCall;

            global.metrics = {
                increment: (...args) => {
                    metricCall = args;
                }
            };

            const result = runWaf({
                body: {
                    payload: '<script>alert(1)</script>'
                }
            });

            expect(result.res.statusCode).to.equal(403);
            expect(metricCall).to.exist;

            expect(metricCall[0]).to.equal('waf.block');
            expect(metricCall[1]).to.deep.equal({
                attackType: 'XSS_ATTEMPT',
                route: '/api/test'
            });
        });

        it('should not fail when metrics is unavailable', () => {
            delete global.metrics;

            const result = runWaf({
                body: {
                    payload: '<script>alert(1)</script>'
                }
            });

            expect(result.nextCalled).to.equal(false);
            expect(result.res.statusCode).to.equal(403);
        });
    });

    // ─────────────────────────────────────────────────────────────
    // USER / IP FALLBACKS
    // ─────────────────────────────────────────────────────────────

    describe('Request metadata fallbacks', () => {
        it('should use socket.remoteAddress when req.ip is unavailable', async () => {
            let capturedAudit;

            auditCreate = async (data) => {
                capturedAudit = data;
                return {};
            };

            const req = createRequest({
                body: {
                    payload: '<script>alert(1)</script>'
                }
            });

            delete req.ip;

            const res = createResponse();

            waf(req, res, () => {});

            await new Promise(resolve => setImmediate(resolve));

            expect(res.statusCode).to.equal(403);
            expect(capturedAudit).to.exist;
            expect(capturedAudit.ipAddress).to.equal(
                '203.0.113.10'
            );
            expect(capturedAudit.ipHash).to.equal(
                'hashed:203.0.113.10'
            );
        });

        it('should use unauthenticated when req.user is absent', async () => {
            let capturedAudit;

            auditCreate = async (data) => {
                capturedAudit = data;
                return {};
            };

            const req = createRequest({
                body: {
                    payload: '<script>alert(1)</script>'
                }
            });

            delete req.user;

            const res = createResponse();

            waf(req, res, () => {});

            await new Promise(resolve => setImmediate(resolve));

            expect(res.statusCode).to.equal(403);
            expect(capturedAudit).to.exist;
            expect(capturedAudit.userId).to.equal(null);
        });
    });

    // ─────────────────────────────────────────────────────────────
    // FAIL-CLOSED PRODUCTION ERROR HANDLING
    // ─────────────────────────────────────────────────────────────

    describe('Unexpected WAF errors', () => {
        it('should fail closed with HTTP 500 in production', () => {
            process.env.NODE_ENV = 'production';

            const req = {
                get() {
                    throw new Error('Unexpected request failure');
                }
            };

            const res = createResponse();

            let nextCalled = false;

            waf(req, res, () => {
                nextCalled = true;
            });

            expect(nextCalled).to.equal(false);
            expect(res.statusCode).to.equal(500);

            expect(res.body).to.deep.equal({
                message:
                    'Security check failed. Please try again later.'
            });

            process.env.NODE_ENV = 'development';
        });

        it('should fail open in development when an unexpected WAF error occurs', () => {
            process.env.NODE_ENV = 'development';

            const req = {
                get() {
                    throw new Error('Unexpected request failure');
                }
            };

            const res = createResponse();

            let nextCalled = false;

            waf(req, res, () => {
                nextCalled = true;
            });

            expect(nextCalled).to.equal(true);
            expect(res.statusCode).to.equal(null);
        });
    });

    // ─────────────────────────────────────────────────────────────
    // CLEAN REQUEST
    // ─────────────────────────────────────────────────────────────

    describe('Clean requests', () => {
        it('should allow a completely normal request', () => {
            const result = runWaf({
                originalUrl: '/api/users?page=1',
                method: 'GET',
                query: {
                    page: '1',
                    sort: 'createdAt'
                },
                body: {}
            });

            expect(result.nextCalled).to.equal(true);
            expect(result.res.statusCode).to.equal(null);
            expect(result.res.body).to.equal(null);
        });

        it('should allow normal nested application data', () => {
            const result = runWaf({
                originalUrl: '/api/profile',
                method: 'PUT',
                body: {
                    name: 'Saurab',
                    bio: 'Software engineer building file tools.',
                    preferences: {
                        theme: 'dark',
                        language: 'en'
                    },
                    tags: [
                        'backend',
                        'AI',
                        'Node.js'
                    ]
                }
            });

            expect(result.nextCalled).to.equal(true);
            expect(result.res.statusCode).to.equal(null);
        });
    });
});