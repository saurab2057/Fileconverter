import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { compressionLimiter } from '../middleware/rateLimiter.js';
import { conversionUpload } from '../middleware/fileUpload.js';
import { batchCompress } from '../controllers/compressionController.js';
// 🔒 FIX: Import WAF so we can apply it AFTER multer
import { waf } from '../middleware/waf.js';

const router = express.Router();

// POST /api/compress/batch
// 🔒 FIX: WAF moved AFTER conversionUpload so it can scan the actual multipart fields
// Order: Auth -> Rate Limit -> File Upload (populates req.body) -> WAF (scans it) -> Controller
router.post('/batch', [authenticateToken, compressionLimiter, conversionUpload, waf, batchCompress]);

export default router;
