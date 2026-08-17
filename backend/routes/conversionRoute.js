import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { conversionLimiter } from '../middleware/rateLimiter.js';
import { conversionUpload } from '../middleware/fileUpload.js';
import { batchConvert } from '../controllers/conversionController.js';
import { waf } from "../middleware/waf.js";

const router = express.Router();

// POST /api/conversion/batch
// 🔒 FIX: WAF moved AFTER conversionUpload so it can scan the actual multipart fields
// Order: Auth -> Rate Limit -> File Upload (populates req.body) -> WAF (scans it) -> Controller
router.post('/batch', [authenticateToken, conversionLimiter, conversionUpload, waf, batchConvert]);
export default router;