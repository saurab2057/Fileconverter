const cloudinary = require('cloudinary');
const cloudinaryStorage = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

console.log('✅ Cloudinary configured with cloud_name:', process.env.CLOUDINARY_CLOUD_NAME || 'NOT SET');

// STORAGE ENGINE - v2.2.1 syntax
const storage = cloudinaryStorage({ // NO "new" keyword
    cloudinary: cloudinary,

    // folder can be string OR function
    folder: 'user_profile_pictures',

    // allowedFormats (NOT allowed_formats or inside params)
    allowedFormats: ['jpeg', 'png', 'jpg'],

    // filename function - called for each file
    filename: function (req, file, cb) {
        console.log('📦 filename() called - file:', file?.originalname);

        if (!process.env.CLOUDINARY_CLOUD_NAME) {
            return cb(new Error('Cloudinary not configured'));
        }

        // Sanitize public_id
        const baseName = file.originalname.replace(/\.[^/.]+$/, "");
        const safeName = baseName.replace(/[^a-zA-Z0-9_-]/g, '_');
        const publicId = `${Date.now()}_${safeName}`;
        console.log('🖼️ public_id:', publicId);

        cb(null, publicId); // pass to callback
    },

    // transformation (top-level, not inside params)
    transformation: [{ width: 250, height: 250, crop: 'fill', gravity: 'face' }]
});

// MULTER CONFIG
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        console.log('🔍 fileFilter received:', {
            originalname: file?.originalname,
            mimetype: file?.mimetype
        });

        if (!file.mimetype.match(/\/(jpg|jpeg|png)$/)) {
            console.warn('❌ Rejected mimetype:', file.mimetype);
            return cb(new Error('Only JPEG/PNG images allowed'), false);
        }

        console.log('✅ File accepted:', file.originalname);
        cb(null, true);
    }
});

// EXPORT MIDDLEWARE
module.exports = function cloudinaryParser(req, res, next) {
    console.log('\n━━━━━━━━━━ 📥 REQUEST HIT cloudinaryParser ━━━━━━━━━━');

    if (!req.headers['content-type']?.includes('multipart/form-data')) {
        console.log('⏩ Not multipart – skipping upload handling');
        return next();
    }

    console.log('📎 Multipart detected – running multer.single(profilePicture)');
    console.log('🚀 Starting multer upload stream...');

    upload.single('profilePicture')(req, res, (err) => {
        console.log('🎯 Multer callback triggered');

        if (err) {
            console.error('❌ Error in upload.single:', err);
            if (err instanceof multer.MulterError) {
                return res.status(400).json({ message: `Upload error: ${err.message}` });
            }
            if (req.body.name) {
                console.warn('⚠️ Upload failed but name exists – continuing');
                return next();
            }
            return res.status(500).json({ message: 'Picture upload failed.' });
        }

        if (req.file) {
            console.log('✅ Uploaded to Cloudinary');
            console.log('📄 File info:', req.file);
        } else {
            console.log('ℹ️ No file received');
        }

        console.log('━━━━━━━━━━ 📤 END REQUEST ━━━━━━━━━━\n');
        next();
    });
};