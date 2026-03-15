import multer from 'multer';
import { MAX_SUMMARIZER_FILE_SIZE } from '../utils/aiSecurity.js';

// 🔒 MULTER CONFIG (MEMORY STORAGE FOR PDF PROCESSING)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SUMMARIZER_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Only PDF files allowed'), false);
    }
    cb(null, true);
  }
});

// 🔒 CONDITIONAL UPLOAD MIDDLEWARE
// Preserves original logic: Only run multer if content-type is multipart/form-data
export const conditionalPdfUpload = (req, res, next) => {
  if (req.is('multipart/form-data')) {
    upload.single('pdf')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ message: err.message || 'Invalid file' });
      }
      next();
    });
  } else {
    next();
  }
};

// 🔒 CONVERSION UPLOAD CONFIG (100MB, 5 FILES)
export const conversionUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB
        files: 5
    }
}).array('files', 5);