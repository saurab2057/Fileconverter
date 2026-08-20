import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { summarizeLimiter } from '../middleware/rateLimiter.js';
import { conditionalPdfUpload } from '../middleware/fileUpload.js';
import { handleSummarization } from '../controllers/summarizerController.js';
import {waf} from '../middleware/waf.js';

const router = express.Router();

router.post('/summarize-pdf', authenticateToken, summarizeLimiter, conditionalPdfUpload, waf, handleSummarization);
export default router;