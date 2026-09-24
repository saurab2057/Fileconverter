// tests/unit/middleware/waf.test.js
import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import esmock from 'esmock';

describe('WAF Middleware', () => {
    let waf;
    let AuditLogMock;
    let hashIPMock;
    let capturedAudit;
    let originalNodeEnv;
    let originalGenericAgents;
    let originalMetrics;

    // ─────────────────────────────────────────────────────────────
    // REQUEST HELPER
    //
    // WAF now gets the client IP through getClientIp(req), so tests
    // intentionally provide proxy headers instead of req.ip.
    // ─────────────────────────────────────────────────────────────
    const createRequest = ({
        originalUrl = '/api/test',
        method = 'POST',
        body = {},
        query = {},
        headers = {},
        vercelForwardedFor,
        forwardedFor,
        cfConnectingIp,
        socketIp = '203.0.113.10'
    } = {}) => {
        const normalizedHeaders = {
            'user-agent': 'Mozilla/5.0',
            ...headers
        };

        if (vercelForwardedFor !== undefined) {
            normalizedHeaders['x-vercel-forwarded-for'] = vercelForwardedFor;
        }

        if (forwardedFor !== undefined) {
            normalizedHeaders['x-forwarded-for'] = forwardedFor;
        }

        if (cfConnectingIp !== undefined) {
            normalizedHeaders['cf-connecting-ip'] = cfConnectingIp;
        }

        return {
            originalUrl,
            path: originalUrl.split('?')[0],
            method,
            body,
            query,
            headers: normalizedHeaders,

            // Deliberately NO req.ip.
            //
            // The production middleware must use getClientIp(req)
            // rather than relying on Express' req.ip value.
            socket: {
                remoteAddress: socketIp
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

    const runWaf = (req) => {
        const res = createResponse();

        let nextCalled = false;

        const next = () => {
            nextCalled = true;
        };

        waf(req, res, next);

        return {
            req,
            res,
            nextCalled
        };
    };

    beforeEach(async () => {
        originalNodeEnv = process.env.NODE_ENV;
        originalGenericAgents = process.env.WAF_BLOCK_GENERIC_AGENTS;
        originalMetrics = global.metrics;

        process.env.NODE_ENV = 'production';
        process.env.WAF_BLOCK_GENERIC_AGENTS = 'false';

        capturedAudit = null;

        AuditLogMock = {
            create: async (data) => {
                capturedAudit = data;
                return data;
            }
        };

        hashIPMock = (ip) => `hashed:${ip}`;

        global.metrics = undefined;

        ({ waf } = await esmock(
            '../../../middleware/waf.js',
            {
                '../../../models/AuditLog.js': {
                    default: AuditLogMock
                },
                '../../../utils/authSecurity.js': {
                    hashIP: hashIPMock
                }
            }
        ));
    });

    afterEach(() => {
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

        global.metrics = originalMetrics;
    });

    // ─────────────────────────────────────────────────────────────
    // ENVIRONMENT
    // ─────────────────────────────────────────────────────────────

    describe('Environment handling', () => {
        it('should bypass WAF completely in test mode', () => {
            process.env.NODE_ENV = 'test';

            const req = createRequest({
                headers: {
                    'user-agent': 'sqlmap/1.7'
                }
            });

            const { res, nextCalled } = runWaf(req);

            expect(nextCalled).to.equal(true);
            expect(res.statusCode).to.equal(null);
            expect(capturedAudit).to.equal(null);
        });
    });

    // ─────────────────────────────────────────────────────────────
    // CLIENT IP / PROXY CHAIN
    // ─────────────────────────────────────────────────────────────

    describe('Client IP extraction', () => {
        it('should use x-vercel-forwarded-for first', () => {
            const req = createRequest({
                vercelForwardedFor: '198.51.100.25',
                forwardedFor: '198.51.100.50',
                cfConnectingIp: '198.51.100.75',
                socketIp: '10.0.0.5',
                headers: {
                    'user-agent': 'sqlmap/1.7'
                }
            });

            runWaf(req);

            expect(capturedAudit).to.not.equal(null);
            expect(capturedAudit.details.ip).to.equal('198.51.100.25');
            expect(capturedAudit.ipAddress).to.equal('198.51.100.25');
            expect(capturedAudit.ipHash).to.equal('hashed:198.51.100.25');
        });

        it('should use the first IP from x-vercel-forwarded-for', () => {
            const req = createRequest({
                vercelForwardedFor: '198.51.100.25, 10.0.0.2, 10.0.0.3',
                headers: {
                    'user-agent': 'sqlmap/1.7'
                }
            });

            runWaf(req);

            expect(capturedAudit.details.ip).to.equal('198.51.100.25');
        });

        it('should fall back to x-forwarded-for when Vercel header is absent', () => {
            const req = createRequest({
                forwardedFor: '198.51.100.30, 10.0.0.2',
                cfConnectingIp: '198.51.100.40',
                socketIp: '10.0.0.5',
                headers: {
                    'user-agent': 'sqlmap/1.7'
                }
            });

            runWaf(req);

            expect(capturedAudit.details.ip).to.equal('198.51.100.30');
        });

        it('should use cf-connecting-ip when forwarded headers are absent', () => {
            const req = createRequest({
                cfConnectingIp: '198.51.100.40',
                socketIp: '10.0.0.5',
                headers: {
                    'user-agent': 'sqlmap/1.7'
                }
            });

            runWaf(req);

            expect(capturedAudit.details.ip).to.equal('198.51.100.40');
        });

        it('should fall back to socket.remoteAddress when proxy headers are absent', () => {
            const req = createRequest({
                socketIp: '203.0.113.55',
                headers: {
                    'user-agent': 'sqlmap/1.7'
                }
            });

            runWaf(req);

            expect(capturedAudit.details.ip).to.equal('203.0.113.55');
            expect(capturedAudit.ipAddress).to.equal('203.0.113.55');
            expect(capturedAudit.ipHash).to.equal('hashed:203.0.113.55');
        });

        it('should normalize IPv4-mapped IPv6 socket addresses', () => {
            const req = createRequest({
                socketIp: '::ffff:203.0.113.60',
                headers: {
                    'user-agent': 'sqlmap/1.7'
                }
            });

            runWaf(req);

            expect(capturedAudit.details.ip).to.equal('203.0.113.60');
            expect(capturedAudit.ipAddress).to.equal('203.0.113.60');
        });

        it('should not rely on req.ip', () => {
            const req = createRequest({
                socketIp: '203.0.113.70',
                headers: {
                    'user-agent': 'sqlmap/1.7'
                }
            });

            req.ip = '192.0.2.123';

            runWaf(req);

            expect(capturedAudit.details.ip).to.equal('203.0.113.70');
            expect(capturedAudit.ipAddress).to.equal('203.0.113.70');
        });
    });

    // ─────────────────────────────────────────────────────────────
    // MALICIOUS USER-AGENTS
    // ─────────────────────────────────────────────────────────────

    describe('Malicious User-Agent blocking', () => {
        const maliciousAgents = [
            'sqlmap/1.7',
            'Nikto/2.5',
            'masscan/1.3',
            'Nmap Scripting Engine',
            'DirBuster-1.0',
            'gobuster/3.6',
            'THC-Hydra',
            'Metasploit Framework',
            'zgrab/0.1',
            'Nuclei/v3.0',
            'Acunetix Web Vulnerability Scanner',
            'Nessus',
            'BurpSuite Professional'
        ];

        for (const userAgent of maliciousAgents) {
            it(`should block ${userAgent}`, () => {
                const req = createRequest({
                    headers: {
                        'user-agent': userAgent
                    }
                });

                const { res, nextCalled } = runWaf(req);

                expect(res.statusCode).to.equal(403);
                expect(res.body).to.deep.equal({
                    message: 'Forbidden.'
                });
                expect(nextCalled).to.equal(false);
            });
        }

        it('should block python-requests when generic agents are enabled', async () => {
            process.env.WAF_BLOCK_GENERIC_AGENTS = 'true';

            ({ waf } = await esmock(
                '../../../middleware/waf.js',
                {
                    '../../../models/AuditLog.js': {
                        default: AuditLogMock
                    },
                    '../../../utils/authSecurity.js': {
                        hashIP: hashIPMock
                    }
                }
            ));

            const req = createRequest({
                headers: {
                    'user-agent': 'python-requests/2.32.3'
                }
            });

            const { res, nextCalled } = runWaf(req);

            expect(res.statusCode).to.equal(403);
            expect(nextCalled).to.equal(false);
        });

        it('should block curl when generic agents are enabled', async () => {
            process.env.WAF_BLOCK_GENERIC_AGENTS = 'true';

            ({ waf } = await esmock(
                '../../../middleware/waf.js',
                {
                    '../../../models/AuditLog.js': {
                        default: AuditLogMock
                    },
                    '../../../utils/authSecurity.js': {
                        hashIP: hashIPMock
                    }
                }
            ));

            const req = createRequest({
                headers: {
                    'user-agent': 'curl/8.5.0'
                }
            });

            const { res } = runWaf(req);

            expect(res.statusCode).to.equal(403);
        });

        it('should block wget when generic agents are enabled', async () => {
            process.env.WAF_BLOCK_GENERIC_AGENTS = 'true';

            ({ waf } = await esmock(
                '../../../middleware/waf.js',
                {
                    '../../../models/AuditLog.js': {
                        default: AuditLogMock
                    },
                    '../../../utils/authSecurity.js': {
                        hashIP: hashIPMock
                    }
                }
            ));

            const req = createRequest({
                headers: {
                    'user-agent': 'Wget/1.21.4'
                }
            });

            const { res } = runWaf(req);

            expect(res.statusCode).to.equal(403);
        });

        it('should allow normal browser User-Agents', () => {
            const req = createRequest({
                headers: {
                    'user-agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153.0 Safari/537.36'
                }
            });

            const { nextCalled, res } = runWaf(req);

            expect(nextCalled).to.equal(true);
            expect(res.statusCode).to.equal(null);
        });
    });

    // ─────────────────────────────────────────────────────────────
    // HTTP METHOD TAMPERING
    // ─────────────────────────────────────────────────────────────

    describe('HTTP method tampering', () => {
        const overrideHeaders = [
            'x-http-method-override',
            'x-method-override',
            'x-http-method'
        ];

        for (const header of overrideHeaders) {
            it(`should block ${header}`, () => {
                const req = createRequest({
                    headers: {
                        [header]: 'DELETE'
                    }
                });

                const { res, nextCalled } = runWaf(req);

                expect(res.statusCode).to.equal(403);
                expect(nextCalled).to.equal(false);
            });
        }

        it('should block method override even when the value is harmless', () => {
            const req = createRequest({
                headers: {
                    'x-http-method-override': 'GET'
                }
            });

            const { res } = runWaf(req);

            expect(res.statusCode).to.equal(403);
        });
    });

    // ─────────────────────────────────────────────────────────────
    // NULL BYTE INJECTION
    // ─────────────────────────────────────────────────────────────

    describe('Null byte injection', () => {
        const payloads = [
            '/api/files/%00',
            '/api/files/%2500',
            '/api/files/\\u0000',
            `/api/files/${String.fromCharCode(0)}`,
        ];

        for (const payload of payloads) {
            it(`should block null byte payload: ${JSON.stringify(payload)}`, () => {
                const req = createRequest({
                    originalUrl: payload
                });

                const { res, nextCalled } = runWaf(req);

                expect(res.statusCode).to.equal(403);
                expect(nextCalled).to.equal(false);
            });
        }

        it('should block null bytes inside request body', () => {
            const req = createRequest({
                body: {
                    filename: 'document%00.pdf'
                }
            });

            const { res } = runWaf(req);

            expect(res.statusCode).to.equal(403);
        });

        it('should block null bytes inside query parameters', () => {
            const req = createRequest({
                query: {
                    file: 'document%00.pdf'
                }
            });

            const { res } = runWaf(req);

            expect(res.statusCode).to.equal(403);
        });
    });

    // ─────────────────────────────────────────────────────────────
    // PATH TRAVERSAL
    // ─────────────────────────────────────────────────────────────

    describe('Path traversal', () => {
        const traversalUrls = [
            '/api/files/../../etc/passwd',
            '/api/files/..%2f..%2fetc/passwd',
            '/api/files/..%5c..%5cwindows%5csystem32',
            '/api/files/..%252f..%252fetc/passwd',
            '/api/files/%2e%2e/%2e%2e/etc/passwd',
            '/api/files/....//....//etc/passwd',
            '/api/files/../../etc/shadow',
            '/api/files/../../proc/self/environ',
            '/api/files/..%c0%af..%c0%afetc/passwd',
            '/api/files/..%c1%9c..%c1%9cwindows',
        ];

        for (const url of traversalUrls) {
            it(`should block traversal URL: ${url}`, () => {
                const req = createRequest({
                    originalUrl: url
                });

                const { res, nextCalled } = runWaf(req);

                expect(res.statusCode).to.equal(403);
                expect(nextCalled).to.equal(false);
            });
        }

        it('should block traversal in query parameters', () => {
            const req = createRequest({
                query: {
                    file: '../../etc/passwd'
                }
            });

            const { res } = runWaf(req);

            expect(res.statusCode).to.equal(403);
        });
    });

    // ─────────────────────────────────────────────────────────────
    // NOSQL INJECTION
    // ─────────────────────────────────────────────────────────────

    describe('NoSQL injection', () => {
        it('should block $gt operator', () => {
            const req = createRequest({
                body: {
                    username: {
                        $gt: ''
                    }
                }
            });

            const { res } = runWaf(req);

            expect(res.statusCode).to.equal(403);
        });

        it('should block $ne operator', () => {
            const req = createRequest({
                query: {
                    password: {
                        $ne: null
                    }
                }
            });

            const { res } = runWaf(req);

            expect(res.statusCode).to.equal(403);
        });

        it('should block deeply nested MongoDB operators', () => {
            const req = createRequest({
                body: {
                    level1: {
                        level2: {
                            level3: {
                                level4: {
                                    level5: {
                                        $where: 'this.password'
                                    }
                                }
                            }
                        }
                    }
                }
            });

            const { res } = runWaf(req);

            expect(res.statusCode).to.equal(403);
        });

        it('should block array-contained MongoDB operators', () => {
            const req = createRequest({
                body: {
                    users: [
                        {
                            username: {
                                $regex: 'admin'
                            }
                        }
                    ]
                }
            });

            const { res } = runWaf(req);

            expect(res.statusCode).to.equal(403);
        });

        it('should allow dollar signs inside normal string values', () => {
            const req = createRequest({
                body: {
                    password: 'P$ortal1!',
                    description: 'Price is $100'
                }
            });

            const { nextCalled, res } = runWaf(req);

            expect(nextCalled).to.equal(true);
            expect(res.statusCode).to.equal(null);
        });

        it('should not recurse beyond the configured depth', () => {
            let payload = {
                $gt: ''
            };

            for (let i = 0; i < 11; i++) {
                payload = {
                    nested: payload
                };
            }

            const req = createRequest({
                body: payload
            });

            const { nextCalled, res } = runWaf(req);

            expect(nextCalled).to.equal(true);
            expect(res.statusCode).to.equal(null);
        });
    });

    // ─────────────────────────────────────────────────────────────
    // PROTOTYPE POLLUTION
    // ─────────────────────────────────────────────────────────────

    describe('Prototype pollution', () => {
        it('should block __proto__ keys', () => {
            const payload = JSON.parse(
                '{"__proto__":{"isAdmin":true}}'
            );

            const req = createRequest({
                body: payload
            });

            const { res } = runWaf(req);

            expect(res.statusCode).to.equal(403);
        });

        it('should block constructor keys', () => {
            const payload = JSON.parse(
                '{"constructor":{"prototype":{"isAdmin":true}}}'
            );

            const req = createRequest({
                body: payload
            });

            const { res } = runWaf(req);

            expect(res.statusCode).to.equal(403);
        });

        it('should block prototype keys', () => {
            const payload = JSON.parse(
                '{"prototype":{"polluted":true}}'
            );

            const req = createRequest({
                body: payload
            });

            const { res } = runWaf(req);

            expect(res.statusCode).to.equal(403);
        });

        it('should block nested prototype pollution keys', () => {
            const payload = JSON.parse(
                '{"user":{"profile":{"constructor":{"prototype":{"isAdmin":true}}}}}'
            );

            const req = createRequest({
                body: payload
            });

            const { res } = runWaf(req);

            expect(res.statusCode).to.equal(403);
        });

        it('should block prototype pollution inside arrays', () => {
            const payload = JSON.parse(
                '{"users":[{"__proto__":{"isAdmin":true}}]}'
            );

            const req = createRequest({
                body: payload
            });

            const { res } = runWaf(req);

            expect(res.statusCode).to.equal(403);
        });

        it('should not recurse beyond the configured depth', () => {
            let payload = {
                constructor: {
                    prototype: {
                        polluted: true
                    }
                }
            };

            for (let i = 0; i < 11; i++) {
                payload = {
                    nested: payload
                };
            }

            const req = createRequest({
                body: payload
            });

            const { nextCalled, res } = runWaf(req);

            expect(nextCalled).to.equal(true);
            expect(res.statusCode).to.equal(null);
        });
    });

    // ─────────────────────────────────────────────────────────────
    // XSS
    // ─────────────────────────────────────────────────────────────

    describe('XSS detection', () => {
        const xssPayloads = [
            '<script>alert(1)</script>',
            '<SCRIPT>alert(1)</SCRIPT>',
            'javascript:alert(1)',
            'onclick="alert(1)"',
            "onerror='alert(1)'",
            'onload=alert(1)',
            '<svg onload=alert(1)>',
            '<math href="javascript:alert(1)">',
            'expression(alert(1))',
            '<iframe src="evil"></iframe>',
            '<object data="evil">',
            '<embed src="evil">',
            'data:text/html,<script>alert(1)</script>',
            'vbscript:msgbox(1)',
            '<img src="javascript:alert(1)">'
        ];

        for (const payload of xssPayloads) {
            it(`should block XSS payload: ${payload}`, () => {
                const req = createRequest({
                    body: {
                        input: payload
                    }
                });

                const { res, nextCalled } = runWaf(req);

                expect(res.statusCode).to.equal(403);
                expect(nextCalled).to.equal(false);
            });
        }

        it('should detect XSS in nested parsed body objects', () => {
            const req = createRequest({
                body: {
                    user: {
                        profile: {
                            bio: '<script>alert(document.cookie)</script>'
                        }
                    }
                }
            });

            const { res } = runWaf(req);

            expect(res.statusCode).to.equal(403);
        });

        it('should detect XSS inside arrays', () => {
            const req = createRequest({
                body: {
                    comments: [
                        'hello',
                        '<img src=x onerror=alert(1)>'
                    ]
                }
            });

            const { res } = runWaf(req);

            expect(res.statusCode).to.equal(403);
        });

        it('should detect XSS in query parameters', () => {
            const req = createRequest({
                query: {
                    search: '<script>alert(1)</script>'
                }
            });

            const { res } = runWaf(req);

            expect(res.statusCode).to.equal(403);
        });
    });

    // ─────────────────────────────────────────────────────────────
    // OVERSIZED PAYLOAD
    // ─────────────────────────────────────────────────────────────

    describe('Oversized payload', () => {
        it('should allow payload at exactly 350KB', () => {
            const body = {
                data: 'a'.repeat(350 * 1024 - 20)
            };

            const req = createRequest({
                body
            });

            const { nextCalled, res } = runWaf(req);

            expect(nextCalled).to.equal(true);
            expect(res.statusCode).to.equal(null);
        });

        it('should block payload over 350KB', () => {
            const body = {
                data: 'a'.repeat(351 * 1024)
            };

            const req = createRequest({
                body
            });

            const { res, nextCalled } = runWaf(req);

            expect(res.statusCode).to.equal(413);
            expect(res.body).to.deep.equal({
                message: 'Payload too large.'
            });
            expect(nextCalled).to.equal(false);
        });

        it('should measure payload size using UTF-8 bytes', () => {
            const body = {
                data: '😀'.repeat(100000)
            };

            const req = createRequest({
                body
            });

            const { res } = runWaf(req);

            expect(res.statusCode).to.equal(413);
        });
    });

    // ─────────────────────────────────────────────────────────────
    // URL DECODING
    // ─────────────────────────────────────────────────────────────

    describe('URL decoding', () => {
        it('should block encoded traversal after decoding', () => {
            const req = createRequest({
                originalUrl: '/api/files/%2e%2e/%2e%2e/etc/passwd'
            });

            const { res } = runWaf(req);

            expect(res.statusCode).to.equal(403);
        });

        it('should safely handle malformed URL encoding', () => {
            const req = createRequest({
                originalUrl: '/api/files/%E0%A4%A'
            });

            const { nextCalled, res } = runWaf(req);

            expect(nextCalled).to.equal(true);
            expect(res.statusCode).to.equal(null);
        });
    });

    // ─────────────────────────────────────────────────────────────
    // AUDIT LOGGING
    // ─────────────────────────────────────────────────────────────

    describe('Audit logging', () => {
        it('should create an audit record when a request is blocked', () => {
            const req = createRequest({
                method: 'POST',
                originalUrl: '/api/test',
                body: {
                    input: '<script>alert(1)</script>'
                },
                vercelForwardedFor: '198.51.100.80',
                headers: {
                    'user-agent': 'Mozilla/5.0'
                }
            });

            const { res } = runWaf(req);

            expect(res.statusCode).to.equal(403);
            expect(capturedAudit).to.not.equal(null);

            expect(capturedAudit.userId).to.equal('user-123');
            expect(capturedAudit.source).to.equal('system');
            expect(capturedAudit.action).to.equal('WAF_BLOCKED');
            expect(capturedAudit.resource).to.equal('POST /api/test');

            expect(capturedAudit.details.attackType)
                .to.equal('XSS_ATTEMPT');

            expect(capturedAudit.details.ip)
                .to.equal('198.51.100.80');

            expect(capturedAudit.details.userAgent)
                .to.equal('Mozilla/5.0');

            expect(capturedAudit.ipAddress)
                .to.equal('198.51.100.80');

            expect(capturedAudit.ipHash)
                .to.equal('hashed:198.51.100.80');

            expect(capturedAudit.userAgent)
                .to.equal('Mozilla/5.0');
        });

        it('should mask sensitive values before writing audit details', () => {
            const req = createRequest({
                originalUrl:
                    '/api/test?password=supersecret&token=abc123&cc=4111111111111111',
                headers: {
                    'user-agent': 'Mozilla/5.0'
                },
                body: {
                    input: '<script>alert(1)</script>'
                }
            });

            const { res } = runWaf(req);

            expect(res.statusCode).to.equal(403);
            expect(capturedAudit).to.not.equal(null);

            const details = capturedAudit.details.details;

            expect(details).to.not.include('supersecret');
            expect(details).to.not.include('abc123');
            expect(details).to.not.include('4111111111111111');
        });

        it('should continue blocking when AuditLog.create fails', () => {
            AuditLogMock.create = async () => {
                throw new Error('Database unavailable');
            };

            const req = createRequest({
                body: {
                    input: '<script>alert(1)</script>'
                }
            });

            const { res, nextCalled } = runWaf(req);

            expect(res.statusCode).to.equal(403);
            expect(nextCalled).to.equal(false);
        });

        it('should use null userId for unauthenticated requests', () => {
            const req = createRequest({
                body: {
                    input: '<script>alert(1)</script>'
                }
            });

            delete req.user;

            const { res } = runWaf(req);

            expect(res.statusCode).to.equal(403);
            expect(capturedAudit.userId).to.equal(null);
        });
    });

    // ─────────────────────────────────────────────────────────────
    // METRICS
    // ─────────────────────────────────────────────────────────────

    describe('Metrics', () => {
        it('should emit WAF block metrics when metrics are available', () => {
            const calls = [];

            global.metrics = {
                increment: (name, data) => {
                    calls.push({
                        name,
                        data
                    });
                }
            };

            const req = createRequest({
                originalUrl: '/api/test',
                body: {
                    input: '<script>alert(1)</script>'
                }
            });

            const { res } = runWaf(req);

            expect(res.statusCode).to.equal(403);
            expect(calls).to.have.length(1);

            expect(calls[0]).to.deep.equal({
                name: 'waf.block',
                data: {
                    attackType: 'XSS_ATTEMPT',
                    route: '/api/test'
                }
            });
        });

        it('should not fail when metrics are unavailable', () => {
            global.metrics = undefined;

            const req = createRequest({
                body: {
                    input: '<script>alert(1)</script>'
                }
            });

            const { res } = runWaf(req);

            expect(res.statusCode).to.equal(403);
        });
    });

    // ─────────────────────────────────────────────────────────────
    // ERROR HANDLING
    // ─────────────────────────────────────────────────────────────

    describe('Unexpected WAF errors', () => {
        it('should fail closed with 500 in production', () => {
            const req = createRequest();

            // Force an unexpected synchronous error inside WAF.
            req.get = () => {
                throw new Error('Unexpected WAF failure');
            };

            const { res, nextCalled } = runWaf(req);

            expect(res.statusCode).to.equal(500);
            expect(res.body).to.deep.equal({
                message: 'Security check failed. Please try again later.'
            });
            expect(nextCalled).to.equal(false);
        });

        it('should fail open in development', () => {
            process.env.NODE_ENV = 'development';

            const req = createRequest();

            req.get = () => {
                throw new Error('Unexpected WAF failure');
            };

            const { res, nextCalled } = runWaf(req);

            expect(nextCalled).to.equal(true);
            expect(res.statusCode).to.equal(null);
        });
    });

    // ─────────────────────────────────────────────────────────────
    // CLEAN REQUESTS
    // ─────────────────────────────────────────────────────────────

    describe('Clean requests', () => {
        it('should allow a normal request', () => {
            const req = createRequest({
                originalUrl: '/api/files',
                method: 'GET',
                query: {
                    page: '1',
                    limit: '20'
                }
            });

            const { nextCalled, res } = runWaf(req);

            expect(nextCalled).to.equal(true);
            expect(res.statusCode).to.equal(null);
        });

        it('should allow normal MongoDB-looking values', () => {
            const req = createRequest({
                body: {
                    username: 'admin',
                    password: 'P$ortal1!',
                    description: 'Price is $100',
                    filename: 'document.pdf'
                }
            });

            const { nextCalled, res } = runWaf(req);

            expect(nextCalled).to.equal(true);
            expect(res.statusCode).to.equal(null);
        });

        it('should allow normal HTML text without executable XSS patterns', () => {
            const req = createRequest({
                body: {
                    description: 'Use <strong>bold text</strong> in the document.'
                }
            });

            const { nextCalled, res } = runWaf(req);

            expect(nextCalled).to.equal(true);
            expect(res.statusCode).to.equal(null);
        });

        it('should allow a request when the client IP is only available through socket', () => {
            const req = createRequest({
                socketIp: '203.0.113.99',
                originalUrl: '/api/profile',
                method: 'GET'
            });

            const { nextCalled, res } = runWaf(req);

            expect(nextCalled).to.equal(true);
            expect(res.statusCode).to.equal(null);
        });
    });
});