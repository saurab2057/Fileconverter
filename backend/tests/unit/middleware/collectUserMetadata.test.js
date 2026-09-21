import { expect } from 'chai';
import esmock from 'esmock';

describe('Collect User Metadata Middleware', () => {
    let saveUserMetadata;
    let axiosGet;
    let findOneAndUpdate;
    let originalNodeEnv;

    before(async () => {
        originalNodeEnv = process.env.NODE_ENV;

        axiosGet = async () => {
            throw new Error('axios mock not configured');
        };

        findOneAndUpdate = async () => ({
            _id: 'mock-metadata-id'
        });

        const module = await esmock(
            '../../../middleware/collectUserMetadata.js',
            {
                axios: {
                    default: {
                        get: (...args) => axiosGet(...args)
                    }
                },

                '../../../models/UserMetadata.js': {
                    default: {
                        findOneAndUpdate: (...args) =>
                            findOneAndUpdate(...args)
                    }
                },

                '../../../utils/authSecurity.js': {
                    hashIP: (ip) => `hashed-${ip}`
                }
            }
        );

        saveUserMetadata = module.saveUserMetadata;
    });

    after(() => {
        process.env.NODE_ENV = originalNodeEnv;
    });

    beforeEach(() => {
        process.env.NODE_ENV = 'development';

        axiosGet = async () => {
            throw new Error('axios mock not configured');
        };

        findOneAndUpdate = async () => ({
            _id: 'mock-metadata-id'
        });
    });

    describe('Test environment protection', () => {
        it('should skip metadata processing in test environment', async () => {
            process.env.NODE_ENV = 'test';

            let axiosCalled = false;
            let databaseCalled = false;

            axiosGet = async () => {
                axiosCalled = true;

                return {
                    data: {
                        success: true,
                        country: 'Nepal',
                        region: 'Bagmati',
                        city: 'Kathmandu'
                    }
                };
            };

            findOneAndUpdate = async () => {
                databaseCalled = true;

                return {
                    _id: 'should-not-exist'
                };
            };

            await saveUserMetadata(
                {
                    ip: '18.18.18.18',
                    headers: {
                        'user-agent':
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153.0.0.0 Safari/537.36'
                    }
                },
                'user-success'
            );

            expect(axiosCalled).to.equal(false);
            expect(databaseCalled).to.equal(false);
        });
    });

    describe('IP validation', () => {
        it('should skip private IPv4 addresses', async () => {
            let axiosCalled = false;
            let databaseCalled = false;

            axiosGet = async () => {
                axiosCalled = true;
                return {};
            };

            findOneAndUpdate = async () => {
                databaseCalled = true;
                return {};
            };

            const privateIPs = [
                '10.0.0.1',
                '192.168.1.10',
                '172.16.0.1',
                '127.0.0.1'
            ];

            for (const ip of privateIPs) {
                await saveUserMetadata(
                    {
                        ip,
                        headers: {
                            'user-agent': 'Mozilla/5.0'
                        }
                    },
                    'user-123'
                );
            }

            expect(axiosCalled).to.equal(false);
            expect(databaseCalled).to.equal(false);
        });

        it('should skip IPv6 loopback address', async () => {
            let axiosCalled = false;
            let databaseCalled = false;

            axiosGet = async () => {
                axiosCalled = true;
                return {};
            };

            findOneAndUpdate = async () => {
                databaseCalled = true;
                return {};
            };

            await saveUserMetadata(
                {
                    ip: '::1',
                    headers: {
                        'user-agent': 'Mozilla/5.0'
                    }
                },
                'user-123'
            );

            expect(axiosCalled).to.equal(false);
            expect(databaseCalled).to.equal(false);
        });

        it('should skip invalid IP addresses', async () => {
            let axiosCalled = false;
            let databaseCalled = false;

            axiosGet = async () => {
                axiosCalled = true;
                return {};
            };

            findOneAndUpdate = async () => {
                databaseCalled = true;
                return {};
            };

            await saveUserMetadata(
                {
                    ip: 'not-an-ip',
                    headers: {
                        'user-agent': 'Mozilla/5.0'
                    }
                },
                'user-123'
            );

            expect(axiosCalled).to.equal(false);
            expect(databaseCalled).to.equal(false);
        });

        it('should use req.socket.remoteAddress when req.ip is unavailable', async () => {
            let capturedUpdate;

            axiosGet = async () => ({
                data: {
                    success: true,
                    country: 'United States',
                    region: 'California',
                    city: 'Mountain View'
                }
            });

            findOneAndUpdate = async (filter, update) => {
                capturedUpdate = {
                    filter,
                    update
                };

                return {
                    _id: 'metadata-remote-ip'
                };
            };

            await saveUserMetadata(
                {
                    socket: {
                        remoteAddress: '8.8.8.8'
                    },
                    headers: {
                        'user-agent': 'Mozilla/5.0'
                    }
                },
                'user-remote-ip'
            );

            expect(capturedUpdate).to.not.equal(undefined);

            expect(capturedUpdate.filter.user).to.equal(
                'user-remote-ip'
            );

            expect(capturedUpdate.update.ipHash).to.equal(
                'hashed-8.8.8.8'
            );
        });
    });

    describe('Geo location lookup', () => {
        it('should fetch and save successful geo location data', async () => {
            let capturedUpdate;
            let axiosCall;

            axiosGet = async (...args) => {
                axiosCall = args;

                return {
                    data: {
                        success: true,
                        country: 'Nepal',
                        region: 'Bagmati Province',
                        city: 'Kathmandu'
                    }
                };
            };

            findOneAndUpdate = async (filter, update, options) => {
                capturedUpdate = {
                    filter,
                    update,
                    options
                };

                return {
                    _id: 'metadata-success'
                };
            };

            // Use a unique IP here so the test does not hit the
            // module-level geo cache populated by the remote-IP test.
            await saveUserMetadata(
                {
                    ip: '18.18.18.18',
                    headers: {
                        'user-agent':
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153.0.0.0 Safari/537.36'
                    }
                },
                'user-success'
            );

            expect(axiosCall[0]).to.equal(
                'https://ipwho.is/18.18.18.18'
            );

            expect(axiosCall[1]).to.deep.include({
                timeout: 4000,
                maxRedirects: 2
            });

            expect(capturedUpdate.filter).to.deep.equal({
                user: 'user-success'
            });

            expect(capturedUpdate.update.ipHash).to.equal(
                'hashed-18.18.18.18'
            );

            expect(capturedUpdate.update.location).to.deep.equal({
                country: 'Nepal',
                region: 'Bagmati Province',
                city: 'Kathmandu'
            });

            expect(capturedUpdate.update.device).to.include({
                browser: 'Chrome',
                os: 'Windows'
            });

            expect(capturedUpdate.update.userAgent).to.include(
                'Chrome/153.0.0.0'
            );

            expect(capturedUpdate.options).to.deep.equal({
                upsert: true,
                new: true
            });
        });

        it('should handle a geo API response with success=false', async () => {
            let capturedUpdate;

            axiosGet = async () => ({
                data: {
                    success: false
                }
            });

            findOneAndUpdate = async (filter, update) => {
                capturedUpdate = update;

                return {
                    _id: 'metadata-empty-location'
                };
            };

            await saveUserMetadata(
                {
                    ip: '1.1.1.1',
                    headers: {
                        'user-agent': 'Mozilla/5.0'
                    }
                },
                'user-empty-location'
            );

            expect(capturedUpdate.location).to.deep.equal({
                country: '',
                region: '',
                city: ''
            });
        });

        it('should retry once after a geo request failure', async () => {
            let callCount = 0;
            let secondCallOptions;

            axiosGet = async (url, options) => {
                callCount++;

                if (callCount === 1) {
                    throw new Error('Temporary geo API failure');
                }

                secondCallOptions = options;

                return {
                    data: {
                        success: true,
                        country: 'Nepal',
                        region: 'Bagmati',
                        city: 'Lalitpur'
                    }
                };
            };

            let capturedUpdate;

            findOneAndUpdate = async (filter, update) => {
                capturedUpdate = update;

                return {
                    _id: 'metadata-retry'
                };
            };

            await saveUserMetadata(
                {
                    ip: '9.9.9.9',
                    headers: {
                        'user-agent': 'Mozilla/5.0'
                    }
                },
                'user-retry'
            );

            expect(callCount).to.equal(2);

            expect(secondCallOptions).to.deep.equal({
                timeout: 2000
            });

            expect(capturedUpdate.location).to.deep.equal({
                country: 'Nepal',
                region: 'Bagmati',
                city: 'Lalitpur'
            });
        });

        it('should return empty location when the initial request and retry fail', async () => {
            let callCount = 0;
            let capturedUpdate;

            axiosGet = async () => {
                callCount++;

                throw new Error('Geo service unavailable');
            };

            findOneAndUpdate = async (filter, update) => {
                capturedUpdate = update;

                return {
                    _id: 'metadata-failed-geo'
                };
            };

            await saveUserMetadata(
                {
                    ip: '4.4.4.4',
                    headers: {
                        'user-agent': 'Mozilla/5.0'
                    }
                },
                'user-failed-geo'
            );

            expect(callCount).to.equal(2);

            expect(capturedUpdate.location).to.deep.equal({
                country: '',
                region: '',
                city: ''
            });
        });
    });

    describe('Geo cache', () => {
        it('should reuse cached geo data for the same IP', async () => {
            let axiosCallCount = 0;
            let databaseCallCount = 0;

            axiosGet = async () => {
                axiosCallCount++;

                return {
                    data: {
                        success: true,
                        country: 'Nepal',
                        region: 'Bagmati',
                        city: 'Kathmandu'
                    }
                };
            };

            findOneAndUpdate = async () => {
                databaseCallCount++;

                return {
                    _id: `metadata-cache-${databaseCallCount}`
                };
            };

            const req = {
                ip: '5.5.5.5',
                headers: {
                    'user-agent': 'Mozilla/5.0'
                }
            };

            await saveUserMetadata(req, 'user-cache-1');
            await saveUserMetadata(req, 'user-cache-2');

            expect(axiosCallCount).to.equal(1);
            expect(databaseCallCount).to.equal(2);
        });
    });

    describe('User-agent parsing', () => {
        it('should store parsed browser and operating system', async () => {
            let capturedUpdate;

            axiosGet = async () => ({
                data: {
                    success: true,
                    country: 'United States',
                    region: 'California',
                    city: 'San Francisco'
                }
            });

            findOneAndUpdate = async (filter, update) => {
                capturedUpdate = update;

                return {
                    _id: 'metadata-ua'
                };
            };

            await saveUserMetadata(
                {
                    ip: '6.6.6.6',
                    headers: {
                        'user-agent':
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153.0.0.0 Safari/537.36'
                    }
                },
                'user-ua'
            );

            expect(capturedUpdate.device.browser).to.equal(
                'Chrome'
            );

            expect(capturedUpdate.device.os).to.equal(
                'Windows'
            );

            expect(capturedUpdate.device.type).to.equal(
                'desktop'
            );
        });

        it('should default device type to desktop when parser provides no type', async () => {
            let capturedUpdate;

            axiosGet = async () => ({
                data: {
                    success: true,
                    country: 'Nepal',
                    region: 'Bagmati',
                    city: 'Bhaktapur'
                }
            });

            findOneAndUpdate = async (filter, update) => {
                capturedUpdate = update;

                return {
                    _id: 'metadata-default-device'
                };
            };

            await saveUserMetadata(
                {
                    ip: '7.7.7.7',
                    headers: {}
                },
                'user-default-device'
            );

            expect(capturedUpdate.device.type).to.equal(
                'desktop'
            );

            expect(capturedUpdate.userAgent).to.equal('');
        });
    });

    describe('Database handling', () => {
        it('should upsert metadata using the user ID', async () => {
            let capturedArguments;

            axiosGet = async () => ({
                data: {
                    success: true,
                    country: 'Nepal',
                    region: 'Bagmati',
                    city: 'Pokhara'
                }
            });

            findOneAndUpdate = async (...args) => {
                capturedArguments = args;

                return {
                    _id: 'metadata-upsert'
                };
            };

            await saveUserMetadata(
                {
                    ip: '11.11.11.11',
                    headers: {
                        'user-agent': 'Mozilla/5.0'
                    }
                },
                'user-upsert'
            );

            expect(capturedArguments[0]).to.deep.equal({
                user: 'user-upsert'
            });

            expect(capturedArguments[2]).to.deep.equal({
                upsert: true,
                new: true
            });
        });

        it('should not throw when database update fails', async () => {
            axiosGet = async () => ({
                data: {
                    success: true,
                    country: 'Nepal',
                    region: 'Bagmati',
                    city: 'Kathmandu'
                }
            });

            findOneAndUpdate = async () => {
                throw new Error('MongoDB unavailable');
            };

            const req = {
                ip: '12.12.12.12',
                headers: {
                    'user-agent': 'Mozilla/5.0'
                }
            };

            let thrownError = null;

            try {
                await saveUserMetadata(req, 'user-db-error');
            } catch (error) {
                thrownError = error;
            }

            expect(thrownError).to.equal(null);
        });
    });

    describe('Circuit breaker', () => {
        it('should open after three consecutive geo failures', async () => {
            let axiosCallCount = 0;
            let databaseCallCount = 0;

            axiosGet = async () => {
                axiosCallCount++;

                throw new Error('Geo API down');
            };

            findOneAndUpdate = async () => {
                databaseCallCount++;

                return {
                    _id: `metadata-circuit-${databaseCallCount}`
                };
            };

            await saveUserMetadata(
                {
                    ip: '13.13.13.13',
                    headers: {
                        'user-agent': 'Mozilla/5.0'
                    }
                },
                'user-circuit-1'
            );

            await saveUserMetadata(
                {
                    ip: '14.14.14.14',
                    headers: {
                        'user-agent': 'Mozilla/5.0'
                    }
                },
                'user-circuit-2'
            );

            await saveUserMetadata(
                {
                    ip: '15.15.15.15',
                    headers: {
                        'user-agent': 'Mozilla/5.0'
                    }
                },
                'user-circuit-3'
            );

            const callsAfterOpening = axiosCallCount;

            await saveUserMetadata(
                {
                    ip: '16.16.16.16',
                    headers: {
                        'user-agent': 'Mozilla/5.0'
                    }
                },
                'user-circuit-4'
            );

            expect(axiosCallCount).to.equal(callsAfterOpening);
            expect(databaseCallCount).to.equal(4);
        });
    });
});