import { expect } from 'chai';
import Module from 'node:module';

describe('Cloudinary Upload Middleware', () => {
    let cloudinaryParser;

    let multerSingleHandler;
    let capturedStorageOptions;
    let capturedCloudinaryConfig;
    let MockMulterError;

    let originalLoad;
    let originalCloudName;

    before(async () => {
        originalCloudName = process.env.CLOUDINARY_CLOUD_NAME;
        process.env.CLOUDINARY_CLOUD_NAME = 'test-cloudinary-cloud';

        originalLoad = Module._load;

        const mockCloudinary = {
            config: (options) => {
                capturedCloudinaryConfig = options;
            }
        };

        const mockCloudinaryStorage = (options) => {
            capturedStorageOptions = options;

            return {
                _mockStorage: true
            };
        };

        MockMulterError = class MulterError extends Error {
            constructor(message) {
                super(message);
                this.name = 'MulterError';
            }
        };

        const mockMulter = () => {
            return {
                single: (fieldName) => {
                    expect(fieldName).to.equal('profilePicture');

                    return (req, res, callback) => {
                        if (!multerSingleHandler) {
                            return callback(null);
                        }

                        multerSingleHandler(req, res, callback);
                    };
                }
            };
        };

        mockMulter.MulterError = MockMulterError;

        Module._load = function (request, parent, isMain) {
            if (request === 'cloudinary') {
                return mockCloudinary;
            }

            if (request === 'multer-storage-cloudinary') {
                return mockCloudinaryStorage;
            }

            if (request === 'multer') {
                return mockMulter;
            }

            return originalLoad.call(this, request, parent, isMain);
        };

        const module = await import(
            `../../../middleware/cloudinary.cjs?test=${Date.now()}`
        );

        cloudinaryParser = module.default || module;
    });

    after(() => {
        Module._load = originalLoad;

        if (originalCloudName === undefined) {
            delete process.env.CLOUDINARY_CLOUD_NAME;
        } else {
            process.env.CLOUDINARY_CLOUD_NAME = originalCloudName;
        }
    });

    beforeEach(() => {
        multerSingleHandler = null;
        process.env.CLOUDINARY_CLOUD_NAME = 'test-cloudinary-cloud';
    });

    // ─────────────────────────────────────────────────────────────
    // MODULE CONFIGURATION
    // ─────────────────────────────────────────────────────────────

    describe('Module configuration', () => {
        it('should configure Cloudinary using environment variables', () => {
            expect(capturedCloudinaryConfig).to.deep.equal({
                cloud_name: 'test-cloudinary-cloud',
                api_key: process.env.CLOUDINARY_API_KEY,
                api_secret: process.env.CLOUDINARY_API_SECRET
            });
        });

        it('should configure the Cloudinary storage engine', () => {
            expect(capturedStorageOptions).to.exist;

            expect(capturedStorageOptions.folder).to.equal(
                'user_profile_pictures'
            );

            expect(capturedStorageOptions.allowedFormats).to.deep.equal([
                'jpeg',
                'png',
                'jpg'
            ]);

            expect(capturedStorageOptions.transformation).to.deep.equal([
                {
                    width: 250,
                    height: 250,
                    crop: 'fill',
                    gravity: 'face'
                }
            ]);
        });

        it('should configure the profile picture filename generator', () => {
            expect(capturedStorageOptions.filename).to.be.a('function');
        });
    });

    // ─────────────────────────────────────────────────────────────
    // CONTENT-TYPE HANDLING
    // ─────────────────────────────────────────────────────────────

    describe('Content-Type handling', () => {
        it('should skip upload processing for non-multipart requests', () => {
            const req = {
                headers: {
                    'content-type': 'application/json'
                }
            };

            const res = {};

            let nextCalled = false;

            cloudinaryParser(req, res, () => {
                nextCalled = true;
            });

            expect(nextCalled).to.equal(true);
        });

        it('should skip upload processing when Content-Type is missing', () => {
            const req = {
                headers: {}
            };

            const res = {};

            let nextCalled = false;

            cloudinaryParser(req, res, () => {
                nextCalled = true;
            });

            expect(nextCalled).to.equal(true);
        });

        it('should process multipart/form-data requests', () => {
            let uploadStarted = false;

            multerSingleHandler = (req, res, callback) => {
                uploadStarted = true;
                callback(null);
            };

            const req = {
                headers: {
                    'content-type':
                        'multipart/form-data; boundary=test-boundary'
                }
            };

            const res = {};

            cloudinaryParser(req, res, () => {});

            expect(uploadStarted).to.equal(true);
        });
    });

    // ─────────────────────────────────────────────────────────────
    // SUCCESSFUL UPLOAD HANDLING
    // ─────────────────────────────────────────────────────────────

    describe('Successful upload handling', () => {
        it('should call next after a successful upload', () => {
            let nextCalled = false;

            multerSingleHandler = (req, res, callback) => {
                req.file = {
                    originalname: 'profile.jpg',
                    mimetype: 'image/jpeg',
                    path: 'https://res.cloudinary.com/test/profile.jpg',
                    filename: 'profile_123'
                };

                callback(null);
            };

            const req = {
                headers: {
                    'content-type':
                        'multipart/form-data; boundary=test-boundary'
                }
            };

            const res = {};

            cloudinaryParser(req, res, () => {
                nextCalled = true;
            });

            expect(nextCalled).to.equal(true);

            expect(req.file).to.deep.include({
                originalname: 'profile.jpg',
                mimetype: 'image/jpeg'
            });
        });

        it('should call next when multipart request contains no file', () => {
            let nextCalled = false;

            multerSingleHandler = (req, res, callback) => {
                callback(null);
            };

            const req = {
                headers: {
                    'content-type':
                        'multipart/form-data; boundary=test-boundary'
                }
            };

            const res = {};

            cloudinaryParser(req, res, () => {
                nextCalled = true;
            });

            expect(nextCalled).to.equal(true);
            expect(req.file).to.equal(undefined);
        });
    });

    // ─────────────────────────────────────────────────────────────
    // MULTER ERROR HANDLING
    // ─────────────────────────────────────────────────────────────

    describe('Multer error handling', () => {
        it('should return 400 for a MulterError', () => {
            let response;

            multerSingleHandler = (req, res, callback) => {
                callback(new MockMulterError('File too large'));
            };

            const req = {
                headers: {
                    'content-type':
                        'multipart/form-data; boundary=test-boundary'
                },
                body: {}
            };

            const res = {
                status(code) {
                    response = {
                        status: code
                    };

                    return this;
                },

                json(body) {
                    response.body = body;
                    return this;
                }
            };

            cloudinaryParser(req, res, () => {});

            expect(response).to.exist;
            expect(response.status).to.equal(400);

            expect(response.body).to.deep.equal({
                message: 'Upload error: File too large'
            });
        });

        it('should return 500 for a non-Multer upload error when name is unavailable', () => {
            let response;

            multerSingleHandler = (req, res, callback) => {
                callback(new Error('Cloudinary upload failed'));
            };

            const req = {
                headers: {
                    'content-type':
                        'multipart/form-data; boundary=test-boundary'
                },
                body: {}
            };

            const res = {
                status(code) {
                    response = {
                        status: code
                    };

                    return this;
                },

                json(body) {
                    response.body = body;
                    return this;
                }
            };

            cloudinaryParser(req, res, () => {});

            expect(response).to.exist;
            expect(response.status).to.equal(500);

            expect(response.body).to.deep.equal({
                message: 'Picture upload failed.'
            });
        });

        it('should continue when upload fails but req.body.name exists', () => {
            let nextCalled = false;
            let responseStatusCalled = false;

            multerSingleHandler = (req, res, callback) => {
                callback(new Error('Cloudinary upload failed'));
            };

            const req = {
                headers: {
                    'content-type':
                        'multipart/form-data; boundary=test-boundary'
                },
                body: {
                    name: 'Saurab'
                }
            };

            const res = {
                status() {
                    responseStatusCalled = true;
                    return this;
                },

                json() {
                    return this;
                }
            };

            cloudinaryParser(req, res, () => {
                nextCalled = true;
            });

            expect(nextCalled).to.equal(true);
            expect(responseStatusCalled).to.equal(false);
        });
    });

    // ─────────────────────────────────────────────────────────────
    // FILENAME GENERATION
    // ─────────────────────────────────────────────────────────────

    describe('Filename generation', () => {
        it('should generate a safe public ID from the original filename', () => {
            const filename = capturedStorageOptions.filename;

            const req = {};

            const file = {
                originalname: 'my profile picture!.jpg'
            };

            let generatedPublicId;

            filename(req, file, (error, publicId) => {
                expect(error).to.equal(null);
                generatedPublicId = publicId;
            });

            expect(generatedPublicId).to.match(
                /^\d+_my_profile_picture_$/
            );
        });

        it('should reject filename generation when Cloudinary is not configured', () => {
            process.env.CLOUDINARY_CLOUD_NAME = '';

            const filename = capturedStorageOptions.filename;

            const req = {};

            const file = {
                originalname: 'profile.jpg'
            };

            let callbackError;

            filename(req, file, (error) => {
                callbackError = error;
            });

            expect(callbackError).to.be.instanceOf(Error);

            expect(callbackError.message).to.equal(
                'Cloudinary not configured'
            );
        });
    });
});
