import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { conversionLimiter } from '../middleware/rateLimiter.js';
import { conversionUpload } from '../middleware/fileUpload.js';
import { batchConvert } from '../controllers/conversionController.js';



const router = express.Router();

// POST /api/conversion/batch
// Order: Auth -> Rate Limit -> File Upload -> Controller
router.post('/batch', [authenticateToken, conversionLimiter, conversionUpload], batchConvert);

export default router;