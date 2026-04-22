// controllers/summarizerController.js
import axios from 'axios';
import { Worker } from 'node:worker_threads';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MAX_SUMMARIZE_WORDS,
  MAX_SUMMARIZER_PAGES,
  SUMMARIZER_FORBIDDEN_PATTERNS,
  sanitizeInput,
  containsForbiddenPatterns,
  truncateToWords,
  sanitizeAiResponse
} from '../utils/aiSecurity.js';
import { validateFileSecurity } from '../utils/fileSecurity.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AI_SERVICE_URL = process.env.AI_SUMMARIZE_URL || 'http://localhost:8000/summarize';
const PDF_WORKER_TIMEOUT_MS = 12000; // 12s (worker has internal 8s)

/**
 * Run PDF text extraction in a worker thread.
 * @param {Buffer} buffer - PDF file buffer
 * @param {number} maxPages - Maximum pages to process
 * @returns {Promise<{text: string, totalPages: number, pagesProcessed: number}>}
 */
const runPdfWorker = (buffer, maxPages) => {
  return new Promise((resolve, reject) => {
    const workerPath = path.resolve(__dirname, '../workers/pdfWorker.js');
    const worker = new Worker(workerPath);

    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error('PDF processing timed out in worker'));
    }, PDF_WORKER_TIMEOUT_MS);

    worker.on('message', (msg) => {
      clearTimeout(timeout);
      if (msg.success) {
        resolve(msg.result);
      } else {
        reject(new Error(msg.error || 'PDF extraction failed'));
      }
    });

    worker.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    worker.on('exit', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
    });

    worker.postMessage({ buffer, maxPages });
  });
};

export const handleSummarization = async (req, res) => {
  try {
    let inputText = '';

    // ─────────────────────────────────────────────────────────────
    // PDF PROCESSING PATH
    // ─────────────────────────────────────────────────────────────
    if (req.file) {
      // 🔒 STEP 1: Deep file security validation (steg checks, PDF JS scan, etc.)
      const userId = req.user?._id?.toString() || 'anonymous';
      const securityError = await validateFileSecurity(req.file, userId);
      if (securityError) {
        console.warn(`[SECURITY BLOCK] PDF summarization blocked: ${securityError.message}`);
        return res.status(400).json({ message: securityError.message });
      }

      // 🔒 STEP 2: Extract text using worker thread (non-blocking)
      try {
        const result = await runPdfWorker(req.file.buffer, MAX_SUMMARIZER_PAGES);
        const extractedText = result.text;

        if (!extractedText || extractedText.trim().length <= 500) {
          return res.status(400).json({
            message: 'No extractable text found. Please use a text-based PDF.'
          });
        }

        // 🔒 STEP 3: Sanitize extracted text
        inputText = sanitizeInput(extractedText);
      } catch (workerError) {
        console.error('PDF Worker Error:', workerError.message);
        return res.status(500).json({
          message: 'Failed to process PDF. The file may be corrupted or too complex.'
        });
      }

    // ─────────────────────────────────────────────────────────────
    // TEXT INPUT PATH
    // ─────────────────────────────────────────────────────────────
    } else if (req.body.text) {
      const sanitized = sanitizeInput(req.body.text);
      if (containsForbiddenPatterns(sanitized, SUMMARIZER_FORBIDDEN_PATTERNS)) {
        console.warn(`[SECURITY BLOCK] Forbidden pattern in summarization text from IP: ${req.ip}`);
        return res.status(403).json({
          message: 'Text contains blocked patterns. Please rephrase.'
        });
      }
      inputText = truncateToWords(sanitized, MAX_SUMMARIZE_WORDS);
    } else {
      return res.status(400).json({
        message: 'Provide either a PDF file or text content.'
      });
    }

    // ─────────────────────────────────────────────────────────────
    // FINAL SAFETY CHECKS
    // ─────────────────────────────────────────────────────────────
    if (inputText.length === 0) {
      return res.status(400).json({ message: 'No valid text to summarize after sanitization.' });
    }

    if (inputText.split(/\s+/).length > MAX_SUMMARIZE_WORDS) {
      inputText = truncateToWords(inputText, MAX_SUMMARIZE_WORDS);
    }

    // ─────────────────────────────────────────────────────────────
    // CALL AI SERVICE
    // ─────────────────────────────────────────────────────────────
    const aiResponse = await axios.post(
      AI_SERVICE_URL,
      { text: inputText },
      {
        timeout: 40000,
        headers: {
          'INTERNAL_API_KEY': process.env.INTERNAL_API_KEY,
        }
      }
    );

    const { summary } = aiResponse.data;
    const cleanSummary = sanitizeAiResponse(summary);

    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.send(cleanSummary);

  } catch (err) {
    console.error('Summarization Error:', err.message);

    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File exceeds 2MB limit' });
    }
    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      return res.status(504).json({ message: 'AI service timed out. Try a shorter input.' });
    }
    if (err.response?.status === 422) {
      return res.status(400).json({ message: 'Invalid content. Please use plain text or text-based PDF.' });
    }

    res.status(500).json({ message: 'Failed to generate summary. Please try again.' });
  }
};