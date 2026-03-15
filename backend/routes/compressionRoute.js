import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { compressionLimiter } from '../middleware/rateLimiter.js';
import { conversionUpload } from '../middleware/fileUpload.js';
import { batchCompress } from '../controllers/compressionController.js';

const router = express.Router();

// POST /api/compress/batch
// Order: Auth -> Rate Limit -> File Upload -> Controller
router.post('/batch', [authenticateToken, compressionLimiter, conversionUpload], batchCompress);

export default router;
