import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { summarizeLimiter } from '../middleware/rateLimiter.js';
import { conditionalPdfUpload } from '../middleware/fileUpload.js';
import { handleSummarization } from '../controllers/summarizerController.js';

const router = express.Router();

router.post('/summarize-pdf', authenticateToken, summarizeLimiter, conditionalPdfUpload, handleSummarization);
export default router;