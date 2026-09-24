// tests/unit/middleware/collectUserMetadata.test.js
import { expect } from 'chai';
import esmock from 'esmock';

describe('Collect User Metadata Middleware', () => {
    let saveUserMetadata;
    let axiosGet;
    let findOneAndUpdate;
    let hashIP;

    const originalNodeEnv = process.env.NODE_ENV;

    const createRequest = ({
        vercelIp,
        forwardedFor,
        cfIp,
        socketIp = '10.0.0.1',
        userAgent = 'Mozilla/5.0',
    } = {}) => {
        const headers = {
            'user-agent': userAgent,
        };

        if (vercelIp !== undefined) {
            headers['x-vercel-forwarded-for'] = vercelIp;
        }

        if (forwardedFor !== undefined) {
            headers['x-forwarded-for'] = forwardedFor;
        }

        if (cfIp !== undefined) {
            headers['cf-connecting-ip'] = cfIp;
        }

        return {
            headers,
            socket: {
                remoteAddress: socketIp,
            },
        };
    };

    const createGeoResponse = ({
        country = 'Nepal',
        region = 'Bagmati',
        city = 'Kathmandu',
        isp = 'WorldLink',
        organization = 'WorldLink Communications',
        asn = 'AS17501',
        connectionType = 'Fiber',
        proxy = false,
        vpn = false,
        tor = false,
        hosting = false,
        timezone = 'Asia/Kathmandu',
    } = {}) => ({
        success: true,
        country,
        region,
        city,
        connection: {
            isp,
            org: organization,
            asn,
            type: connectionType,
        },
        security: {
            proxy,
            vpn,
            tor,
            hosting,
        },
        timezone: {
            id: timezone,
        },
    });

    before(async () => {
        axiosGet = async () => {
            throw new Error('axios mock was not configured');
        };

        findOneAndUpdate = async () => ({
            _id: 'metadata-default',
        });

        hashIP = (ip) => `hash:${ip}`;

        ({
            saveUserMetadata,
        } = await esmock('../../../middleware/collectUserMetadata.js', {
            axios: {
                default: {
                    get: (...args) => axiosGet(...args),
                },
            },
            '../../../utils/authSecurity.js': {
                hashIP,
            },
            '../../../models/UserMetadata.js': {
                default: {
                    findOneAndUpdate: (...args) =>
                        findOneAndUpdate(...args),
                },
            },
        }));
    });

    after(() => {
        process.env.NODE_ENV = originalNodeEnv;
    });

    afterEach(() => {
        process.env.NODE_ENV = 'test';
    });

    describe('Test environment protection', () => {
        it('should skip metadata processing in test environment', async () => {
            process.env.NODE_ENV = 'test';

            let axiosCalled = false;
            let databaseCalled = false;

            axiosGet = async () => {
                axiosCalled = true;

                return {
                    data: createGeoResponse(),
                };
            };

            findOneAndUpdate = async () => {
                databaseCalled = true;

                return {
                    _id: 'metadata-test',
                };
            };

            const req = createRequest({
                vercelIp: '203.0.113.1',
            });

            await saveUserMetadata(req, 'user-test');

            expect(axiosCalled).to.equal(false);
            expect(databaseCalled).to.equal(false);
        });
    });

    describe('IP validation', () => {
        it('should skip private IPv4 addresses', async () => {
            process.env.NODE_ENV = 'production';

            let axiosCalled = false;
            let databaseCalled = false;

            axiosGet = async () => {
                axiosCalled = true;

                return {
                    data: createGeoResponse(),
                };
            };

            findOneAndUpdate = async () => {
                databaseCalled = true;

                return {
                    _id: 'metadata-private-ip',
                };
            };

            const privateIps = [
                '10.0.0.5',
                '192.168.1.10',
                '172.20.10.5',
                '127.0.0.1',
            ];

            for (const ip of privateIps) {
                await saveUserMetadata(
                    createRequest({
                        vercelIp: ip,
                    }),
                    `user-private-${ip}`,
                );
            }

            expect(axiosCalled).to.equal(false);
            expect(databaseCalled).to.equal(false);
        });

        it('should skip IPv6 loopback address', async () => {
            process.env.NODE_ENV = 'production';

            let axiosCalled = false;
            let databaseCalled = false;

            axiosGet = async () => {
                axiosCalled = true;

                return {
                    data: createGeoResponse(),
                };
            };

            findOneAndUpdate = async () => {
                databaseCalled = true;

                return {
                    _id: 'metadata-ipv6-loopback',
                };
            };

            await saveUserMetadata(
                createRequest({
                    vercelIp: '::1',
                }),
                'user-ipv6-loopback',
            );

            expect(axiosCalled).to.equal(false);
            expect(databaseCalled).to.equal(false);
        });

        it('should skip invalid IP addresses', async () => {
            process.env.NODE_ENV = 'production';

            let axiosCalled = false;
            let databaseCalled = false;

            axiosGet = async () => {
                axiosCalled = true;

                return {
                    data: createGeoResponse(),
                };
            };

            findOneAndUpdate = async () => {
                databaseCalled = true;

                return {
                    _id: 'metadata-invalid-ip',
                };
            };

            await saveUserMetadata(
                createRequest({
                    vercelIp: 'not-an-ip-address',
                }),
                'user-invalid-ip',
            );

            expect(axiosCalled).to.equal(false);
            expect(databaseCalled).to.equal(false);
        });

        it('should use getClientIp fallback to socket.remoteAddress when proxy headers are unavailable', async () => {
            process.env.NODE_ENV = 'production';

            const axiosCalls = [];
            let savedUpdate;

            const ip = '203.0.113.30';

            axiosGet = async (...args) => {
                axiosCalls.push(args);

                return {
                    data: createGeoResponse({
                        city: 'Mountain View',
                        country: 'United States',
                        region: 'California',
                        isp: 'Google',
                    }),
                };
            };

            findOneAndUpdate = async (filter, update, options) => {
                savedUpdate = {
                    filter,
                    update,
                    options,
                };

                return {
                    _id: 'metadata-remote-ip',
                };
            };

            await saveUserMetadata(
                createRequest({
                    socketIp: ip,
                }),
                'user-remote-ip',
            );

            expect(axiosCalls).to.have.length(1);

            expect(axiosCalls[0][0]).to.equal(
                `https://ipwho.is/${ip}`,
            );

            expect(savedUpdate.filter).to.deep.equal({
                user: 'user-remote-ip',
            });
        });

        it('should prefer x-vercel-forwarded-for over x-forwarded-for', async () => {
            process.env.NODE_ENV = 'production';

            const axiosCalls = [];

            // Unique IP prevents this test from using cached geo data.
            const vercelIp = '203.0.113.31';

            axiosGet = async (...args) => {
                axiosCalls.push(args);

                return {
                    data: createGeoResponse({
                        city: 'Mountain View',
                    }),
                };
            };

            findOneAndUpdate = async () => ({
                _id: 'metadata-proxy-priority',
            });

            await saveUserMetadata(
                createRequest({
                    vercelIp,
                    forwardedFor: '203.0.113.32, 10.0.0.1',
                }),
                'user-proxy-priority',
            );

            expect(axiosCalls).to.have.length(1);

            expect(axiosCalls[0][0]).to.equal(
                `https://ipwho.is/${vercelIp}`,
            );
        });

        it('should use the first IP from x-forwarded-for', async () => {
            process.env.NODE_ENV = 'production';

            const axiosCalls = [];

            const ip = '203.0.113.33';

            axiosGet = async (...args) => {
                axiosCalls.push(args);

                return {
                    data: createGeoResponse({
                        city: 'Lalitpur',
                    }),
                };
            };

            findOneAndUpdate = async () => ({
                _id: 'metadata-forwarded-chain',
            });

            await saveUserMetadata(
                createRequest({
                    forwardedFor: `${ip}, 8.8.8.8, 10.0.0.1`,
                }),
                'user-forwarded-chain',
            );

            expect(axiosCalls).to.have.length(1);

            expect(axiosCalls[0][0]).to.equal(
                `https://ipwho.is/${ip}`,
            );
        });

        it('should use cf-connecting-ip when Vercel and forwarded headers are unavailable', async () => {
            process.env.NODE_ENV = 'production';

            const axiosCalls = [];

            const ip = '203.0.113.34';

            axiosGet = async (...args) => {
                axiosCalls.push(args);

                return {
                    data: createGeoResponse({
                        city: 'Kathmandu',
                    }),
                };
            };

            findOneAndUpdate = async () => ({
                _id: 'metadata-cloudflare-ip',
            });

            await saveUserMetadata(
                createRequest({
                    cfIp: ip,
                }),
                'user-cloudflare-ip',
            );

            expect(axiosCalls).to.have.length(1);

            expect(axiosCalls[0][0]).to.equal(
                `https://ipwho.is/${ip}`,
            );
        });
    });

    describe('Geo location lookup', () => {
        it('should fetch and save successful geo location data', async () => {
            process.env.NODE_ENV = 'production';

            const axiosCalls = [];
            let savedUpdate;

            const ip = '203.0.113.40';

            axiosGet = async (...args) => {
                axiosCalls.push(args);

                return {
                    data: createGeoResponse({
                        country: 'Nepal',
                        region: 'Bagmati',
                        city: 'Kathmandu',
                        isp: 'WorldLink',
                        organization: 'WorldLink Communications',
                        asn: 'AS17501',
                        connectionType: 'Fiber',
                        proxy: false,
                        vpn: false,
                        tor: false,
                        hosting: false,
                        timezone: 'Asia/Kathmandu',
                    }),
                };
            };

            findOneAndUpdate = async (filter, update, options) => {
                savedUpdate = {
                    filter,
                    update,
                    options,
                };

                return {
                    _id: 'metadata-success',
                };
            };

            const req = createRequest({
                vercelIp: ip,
                userAgent:
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153.0.0.0 Safari/537.36',
            });

            await saveUserMetadata(req, 'user-success');

            expect(axiosCalls).to.have.length(1);

            expect(axiosCalls[0][0]).to.equal(
                `https://ipwho.is/${ip}`,
            );

            expect(axiosCalls[0][1]).to.deep.include({
                timeout: 4000,
                maxRedirects: 2,
            });

            expect(savedUpdate.filter).to.deep.equal({
                user: 'user-success',
            });

            expect(savedUpdate.update.ipHash).to.equal(
                `hash:${ip}`,
            );

            expect(savedUpdate.update.location).to.deep.equal({
                country: 'Nepal',
                region: 'Bagmati',
                city: 'Kathmandu',
            });

            expect(savedUpdate.update.network).to.deep.equal({
                isp: 'WorldLink',
                organization: 'WorldLink Communications',
                asn: 'AS17501',
                connectionType: 'Fiber',
                isProxy: false,
                isVpn: false,
                isTor: false,
                isHosting: false,
            });

            expect(savedUpdate.update.timezone).to.equal(
                'Asia/Kathmandu',
            );

            expect(savedUpdate.update.userAgent).to.equal(
                req.headers['user-agent'],
            );

            expect(savedUpdate.update.device).to.be.an('object');

            expect(savedUpdate.options).to.deep.equal({
                upsert: true,
                new: true,
            });
        });

        it('should handle a geo API response with success=false', async () => {
            process.env.NODE_ENV = 'production';

            const axiosCalls = [];
            let savedUpdate;

            const ip = '203.0.113.41';

            axiosGet = async (...args) => {
                axiosCalls.push(args);

                return {
                    data: {
                        success: false,
                    },
                };
            };

            findOneAndUpdate = async (filter, update, options) => {
                savedUpdate = {
                    filter,
                    update,
                    options,
                };

                return {
                    _id: 'metadata-empty-location',
                };
            };

            await saveUserMetadata(
                createRequest({
                    vercelIp: ip,
                }),
                'user-empty-location',
            );

            expect(axiosCalls).to.have.length(1);

            expect(savedUpdate.update.location).to.deep.equal({
                country: '',
                region: '',
                city: '',
            });

            expect(savedUpdate.update.network).to.deep.equal({
                isp: '',
                organization: '',
                asn: '',
                connectionType: '',
                isProxy: false,
                isVpn: false,
                isTor: false,
                isHosting: false,
            });

            expect(savedUpdate.update.timezone).to.equal('');
        });

        it('should retry once after a geo request failure', async () => {
            process.env.NODE_ENV = 'production';

            const axiosCalls = [];

            const ip = '203.0.113.42';

            axiosGet = async (...args) => {
                axiosCalls.push(args);

                if (axiosCalls.length === 1) {
                    throw new Error('temporary geo failure');
                }

                return {
                    data: createGeoResponse({
                        city: 'Lalitpur',
                    }),
                };
            };

            findOneAndUpdate = async () => ({
                _id: 'metadata-retry',
            });

            await saveUserMetadata(
                createRequest({
                    vercelIp: ip,
                }),
                'user-retry',
            );

            expect(axiosCalls).to.have.length(2);

            expect(axiosCalls[0][0]).to.equal(
                `https://ipwho.is/${ip}`,
            );

            expect(axiosCalls[0][1]).to.deep.include({
                timeout: 4000,
                maxRedirects: 2,
            });

            expect(axiosCalls[1][0]).to.equal(
                `https://ipwho.is/${ip}`,
            );

            expect(axiosCalls[1][1]).to.deep.equal({
                timeout: 2000,
            });
        });

        it('should return empty geo data when the initial request and retry fail', async () => {
            process.env.NODE_ENV = 'production';

            const axiosCalls = [];
            let savedUpdate;

            const ip = '203.0.113.43';

            axiosGet = async (...args) => {
                axiosCalls.push(args);

                throw new Error('geo service unavailable');
            };

            findOneAndUpdate = async (filter, update, options) => {
                savedUpdate = {
                    filter,
                    update,
                    options,
                };

                return {
                    _id: 'metadata-failed-geo',
                };
            };

            await saveUserMetadata(
                createRequest({
                    vercelIp: ip,
                }),
                'user-failed-geo',
            );

            expect(axiosCalls).to.have.length(2);

            expect(savedUpdate.update.location).to.deep.equal({
                country: '',
                region: '',
                city: '',
            });

            expect(savedUpdate.update.network).to.deep.equal({
                isp: '',
                organization: '',
                asn: '',
                connectionType: '',
                isProxy: false,
                isVpn: false,
                isTor: false,
                isHosting: false,
            });

            expect(savedUpdate.update.timezone).to.equal('');
        });
    });

    describe('Geo cache', () => {
        it('should reuse cached geo data for the same IP', async () => {
            process.env.NODE_ENV = 'production';

            const axiosCalls = [];
            let databaseCallCount = 0;

            const ip = '203.0.113.44';

            axiosGet = async (...args) => {
                axiosCalls.push(args);

                return {
                    data: createGeoResponse({
                        city: 'Kathmandu',
                    }),
                };
            };

            findOneAndUpdate = async () => {
                databaseCallCount++;

                return {
                    _id: `metadata-cache-${databaseCallCount}`,
                };
            };

            await saveUserMetadata(
                createRequest({
                    vercelIp: ip,
                }),
                'user-cache-1',
            );

            await saveUserMetadata(
                createRequest({
                    vercelIp: ip,
                }),
                'user-cache-2',
            );

            expect(axiosCalls).to.have.length(1);
            expect(databaseCallCount).to.equal(2);
        });
    });

    describe('User-agent parsing', () => {
        it('should store parsed browser and operating system', async () => {
            process.env.NODE_ENV = 'production';

            let savedUpdate;

            const ip = '203.0.113.45';

            axiosGet = async () => ({
                data: createGeoResponse({
                    city: 'San Francisco',
                    country: 'United States',
                    region: 'California',
                }),
            });

            findOneAndUpdate = async (filter, update, options) => {
                savedUpdate = {
                    filter,
                    update,
                    options,
                };

                return {
                    _id: 'metadata-ua',
                };
            };

            await saveUserMetadata(
                createRequest({
                    vercelIp: ip,
                    userAgent:
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153.0.0.0 Safari/537.36',
                }),
                'user-ua',
            );

            expect(savedUpdate.update.device).to.be.an('object');

            expect(savedUpdate.update.device.browser).to.be.a(
                'string',
            );

            expect(savedUpdate.update.device.os).to.be.a(
                'string',
            );

            expect(savedUpdate.update.userAgent).to.contain(
                'Chrome',
            );
        });

        it('should default device type to desktop when parser provides no type', async () => {
            process.env.NODE_ENV = 'production';

            let savedUpdate;

            const ip = '203.0.113.46';

            axiosGet = async () => ({
                data: createGeoResponse({
                    city: 'Kathmandu',
                }),
            });

            findOneAndUpdate = async (filter, update, options) => {
                savedUpdate = {
                    filter,
                    update,
                    options,
                };

                return {
                    _id: 'metadata-default-device',
                };
            };

            await saveUserMetadata(
                createRequest({
                    vercelIp: ip,
                    userAgent: 'SomeUnknownBrowser/1.0',
                }),
                'user-default-device',
            );

            expect(savedUpdate.update.device.type).to.equal(
                'desktop',
            );
        });
    });

    describe('Database handling', () => {
        it('should upsert metadata using the user ID', async () => {
            process.env.NODE_ENV = 'production';

            let databaseCall;

            const ip = '203.0.113.47';

            axiosGet = async () => ({
                data: createGeoResponse({
                    city: 'Pokhara',
                }),
            });

            findOneAndUpdate = async (filter, update, options) => {
                databaseCall = {
                    filter,
                    update,
                    options,
                };

                return {
                    _id: 'metadata-upsert',
                };
            };

            await saveUserMetadata(
                createRequest({
                    vercelIp: ip,
                }),
                'user-upsert',
            );

            expect(databaseCall.filter).to.deep.equal({
                user: 'user-upsert',
            });

            expect(databaseCall.options).to.deep.equal({
                upsert: true,
                new: true,
            });

            expect(databaseCall.update.ipHash).to.equal(
                `hash:${ip}`,
            );
        });

        it('should not throw when database update fails', async () => {
            process.env.NODE_ENV = 'production';

            const ip = '203.0.113.48';

            axiosGet = async () => ({
                data: createGeoResponse(),
            });

            findOneAndUpdate = async () => {
                throw new Error('MongoDB unavailable');
            };

            let threw = false;

            try {
                await saveUserMetadata(
                    createRequest({
                        vercelIp: ip,
                    }),
                    'user-db-failure',
                );
            } catch {
                threw = true;
            }

            expect(threw).to.equal(false);
        });
    });

    describe('Circuit breaker', () => {
        it('should open after three consecutive geo request failures', async () => {
            process.env.NODE_ENV = 'production';

            const axiosCalls = [];

            const ips = [
                '203.0.113.51',
                '203.0.113.52',
                '203.0.113.53',
                '203.0.113.54',
            ];

            axiosGet = async (...args) => {
                axiosCalls.push(args);

                // success=false records exactly one circuit failure
                // and does not enter the retry branch.
                return {
                    data: {
                        success: false,
                    },
                };
            };

            findOneAndUpdate = async () => ({
                _id: 'metadata-circuit',
            });

            // Failure #1.
            await saveUserMetadata(
                createRequest({
                    vercelIp: ips[0],
                }),
                'user-circuit-1',
            );

            expect(axiosCalls).to.have.length(1);

            // Failure #2.
            await saveUserMetadata(
                createRequest({
                    vercelIp: ips[1],
                }),
                'user-circuit-2',
            );

            expect(axiosCalls).to.have.length(2);

            // Failure #3 opens the circuit.
            await saveUserMetadata(
                createRequest({
                    vercelIp: ips[2],
                }),
                'user-circuit-3',
            );

            expect(axiosCalls).to.have.length(3);

            // Circuit is open: no HTTP request should be made.
            await saveUserMetadata(
                createRequest({
                    vercelIp: ips[3],
                }),
                'user-circuit-4',
            );

            expect(axiosCalls).to.have.length(3);
        });
    });
});