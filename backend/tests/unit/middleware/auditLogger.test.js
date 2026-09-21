import { expect } from 'chai';
import esmock from 'esmock';

describe('Audit Logger Middleware', () => {
    let logAdminAction;
    let logUserActivity;

    let auditLogCreate;
    let activityLogCreate;
    let hashIP;

    let originalNodeEnv;

    before(async () => {
        originalNodeEnv = process.env.NODE_ENV;

        auditLogCreate = async () => ({
            _id: 'mock-audit-id'
        });

        activityLogCreate = async () => ({
            _id: 'mock-activity-id'
        });

        hashIP = (ip) => `hashed-${ip}`;

        const module = await esmock(
            '../../../middleware/auditLogger.js',
            {
                '../../../models/AuditLog.js': {
                    default: {
                        create: (...args) => auditLogCreate(...args)
                    }
                },

                '../../../models/ActivityLog.js': {
                    default: {
                        create: (...args) =>
                            activityLogCreate(...args)
                    }
                },

                '../../../utils/authSecurity.js': {
                    hashIP: (ip) => hashIP(ip)
                }
            }
        );

        logAdminAction = module.logAdminAction;
        logUserActivity = module.logUserActivity;
    });

    after(() => {
        process.env.NODE_ENV = originalNodeEnv;
    });

    beforeEach(() => {
        process.env.NODE_ENV = 'development';

        auditLogCreate = async () => ({
            _id: 'mock-audit-id'
        });

        activityLogCreate = async () => ({
            _id: 'mock-activity-id'
        });

        hashIP = (ip) => `hashed-${ip}`;
    });

    describe('logAdminAction', () => {
        it('should skip audit logging in test environment', async () => {
            process.env.NODE_ENV = 'test';

            let auditCalled = false;
            let hashCalled = false;

            auditLogCreate = async () => {
                auditCalled = true;

                return {
                    _id: 'should-not-exist'
                };
            };

            hashIP = () => {
                hashCalled = true;
                return 'should-not-exist';
            };

            await logAdminAction(
                'admin-123',
                'USER_BANNED',
                'User',
                {
                    targetUser: 'user-456'
                },
                '8.8.8.8',
                'Mozilla/5.0'
            );

            expect(auditCalled).to.equal(false);
            expect(hashCalled).to.equal(false);
        });

        it('should create an audit log with all supplied values', async () => {
            let capturedData;

            auditLogCreate = async (data) => {
                capturedData = data;

                return {
                    _id: 'audit-123'
                };
            };

            await logAdminAction(
                'admin-123',
                'USER_BANNED',
                'User',
                {
                    targetUser: 'user-456',
                    reason: 'Policy violation'
                },
                '8.8.8.8',
                'Mozilla/5.0'
            );

            expect(capturedData).to.deep.equal({
                userId: 'admin-123',
                source: 'admin',
                action: 'USER_BANNED',
                resource: 'User',
                details: {
                    targetUser: 'user-456',
                    reason: 'Policy violation'
                },
                ipAddress: '8.8.8.8',
                ipHash: 'hashed-8.8.8.8',
                userAgent: 'Mozilla/5.0'
            });
        });

        it('should default userId to null when userId is not supplied', async () => {
            let capturedData;

            auditLogCreate = async (data) => {
                capturedData = data;

                return {
                    _id: 'audit-system'
                };
            };

            await logAdminAction(
                null,
                'CLEANUP_FILES',
                'System',
                {
                    deleted: 25
                },
                '8.8.4.4',
                'Cron'
            );

            expect(capturedData.userId).to.equal(null);
        });

        it('should default source to admin', async () => {
            let capturedData;

            auditLogCreate = async (data) => {
                capturedData = data;

                return {
                    _id: 'audit-default-source'
                };
            };

            await logAdminAction(
                'admin-123',
                'CONFIG_UPDATED',
                'Config',
                {
                    field: 'maxFileSize'
                },
                '1.1.1.1',
                'Mozilla/5.0'
            );

            expect(capturedData.source).to.equal('admin');
        });

        it('should accept system as the audit source', async () => {
            let capturedData;

            auditLogCreate = async (data) => {
                capturedData = data;

                return {
                    _id: 'audit-system-source'
                };
            };

            await logAdminAction(
                null,
                'CLEANUP_FILES',
                'File',
                {
                    deleted: 10
                },
                null,
                'Cron',
                'system'
            );

            expect(capturedData.source).to.equal('system');
            expect(capturedData.userId).to.equal(null);
        });

        it('should default IP address to unknown', async () => {
            let capturedData;

            auditLogCreate = async (data) => {
                capturedData = data;

                return {
                    _id: 'audit-unknown-ip'
                };
            };

            await logAdminAction(
                'admin-123',
                'VIEW_LOGS',
                'AuditLog',
                {},
                undefined,
                'Mozilla/5.0'
            );

            expect(capturedData.ipAddress).to.equal('unknown');
            expect(capturedData.ipHash).to.equal(
                'hashed-undefined'
            );
        });

        it('should default user agent to unknown', async () => {
            let capturedData;

            auditLogCreate = async (data) => {
                capturedData = data;

                return {
                    _id: 'audit-unknown-agent'
                };
            };

            await logAdminAction(
                'admin-123',
                'VIEW_LOGS',
                'AuditLog',
                {},
                '8.8.8.8',
                undefined
            );

            expect(capturedData.userAgent).to.equal('unknown');
        });

        it('should hash the supplied IP address', async () => {
            let capturedIP;

            hashIP = (ip) => {
                capturedIP = ip;

                return 'secure-ip-hash';
            };

            auditLogCreate = async (data) => data;

            await logAdminAction(
                'admin-123',
                'VIEW_LOGS',
                'AuditLog',
                {},
                '203.0.113.10',
                'Mozilla/5.0'
            );

            expect(capturedIP).to.equal('203.0.113.10');
        });

        it('should not throw when AuditLog.create fails', async () => {
            auditLogCreate = async () => {
                throw new Error('MongoDB unavailable');
            };

            let thrownError = null;

            try {
                await logAdminAction(
                    'admin-123',
                    'USER_BANNED',
                    'User',
                    {},
                    '8.8.8.8',
                    'Mozilla/5.0'
                );
            } catch (error) {
                thrownError = error;
            }

            expect(thrownError).to.equal(null);
        });
    });

    describe('logUserActivity', () => {
        it('should skip activity logging in test environment', async () => {
            process.env.NODE_ENV = 'test';

            let activityCalled = false;
            let hashCalled = false;

            activityLogCreate = async () => {
                activityCalled = true;

                return {
                    _id: 'should-not-exist'
                };
            };

            hashIP = () => {
                hashCalled = true;
                return 'should-not-exist';
            };

            await logUserActivity(
                'user-123',
                'LOGIN',
                'Auth',
                {
                    method: 'password'
                },
                '8.8.8.8',
                'Mozilla/5.0'
            );

            expect(activityCalled).to.equal(false);
            expect(hashCalled).to.equal(false);
        });

        it('should create an activity log with all supplied values', async () => {
            let capturedData;

            activityLogCreate = async (data) => {
                capturedData = data;

                return {
                    _id: 'activity-123'
                };
            };

            await logUserActivity(
                'user-123',
                'LOGIN',
                'Auth',
                {
                    method: 'password'
                },
                '8.8.8.8',
                'Mozilla/5.0'
            );

            expect(capturedData).to.deep.equal({
                userId: 'user-123',
                action: 'LOGIN',
                resource: 'Auth',
                details: {
                    method: 'password'
                },
                ipAddress: '8.8.8.8',
                ipHash: 'hashed-8.8.8.8',
                userAgent: 'Mozilla/5.0'
            });
        });

        it('should default IP address to unknown', async () => {
            let capturedData;

            activityLogCreate = async (data) => {
                capturedData = data;

                return {
                    _id: 'activity-unknown-ip'
                };
            };

            await logUserActivity(
                'user-123',
                'LOGIN',
                'Auth',
                {},
                undefined,
                'Mozilla/5.0'
            );

            expect(capturedData.ipAddress).to.equal('unknown');
            expect(capturedData.ipHash).to.equal(
                'hashed-undefined'
            );
        });

        it('should default user agent to unknown', async () => {
            let capturedData;

            activityLogCreate = async (data) => {
                capturedData = data;

                return {
                    _id: 'activity-unknown-agent'
                };
            };

            await logUserActivity(
                'user-123',
                'LOGIN',
                'Auth',
                {},
                '8.8.8.8',
                undefined
            );

            expect(capturedData.userAgent).to.equal('unknown');
        });

        it('should hash the supplied IP address', async () => {
            let capturedIP;

            hashIP = (ip) => {
                capturedIP = ip;

                return 'secure-ip-hash';
            };

            activityLogCreate = async (data) => data;

            await logUserActivity(
                'user-123',
                'LOGIN',
                'Auth',
                {},
                '203.0.113.20',
                'Mozilla/5.0'
            );

            expect(capturedIP).to.equal('203.0.113.20');
        });

        it('should not throw when ActivityLog.create fails', async () => {
            activityLogCreate = async () => {
                throw new Error('MongoDB unavailable');
            };

            let thrownError = null;

            try {
                await logUserActivity(
                    'user-123',
                    'LOGIN',
                    'Auth',
                    {},
                    '8.8.8.8',
                    'Mozilla/5.0'
                );
            } catch (error) {
                thrownError = error;
            }

            expect(thrownError).to.equal(null);
        });
    });
});