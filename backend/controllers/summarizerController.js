import axios from 'axios';
import { extractPdfText } from '../middleware/pdfProcessor.js';
import { 
  MAX_SUMMARIZE_WORDS, 
  MAX_SUMMARIZER_PAGES, 
  SUMMARIZER_FORBIDDEN_PATTERNS, 
  sanitizeInput, 
  containsForbiddenPatterns, 
  truncateToWords, 
  sanitizeAiResponse 
} from '../utils/aiSecurity.js';

export const handleSummarization = async (req, res) => {
  try {
    let inputText = '';

    // 🔒 PDF PROCESSING PATH
    if (req.file) {
      const { text } = await extractPdfText(
        new Uint8Array(req.file.buffer),
        MAX_SUMMARIZER_PAGES
      );
      
      if (!text || text.trim().length <= 500) {
        return res.status(400).json({
          message: 'No extractable text found. Please use a text-based PDF.'
        });
      }
      
      // 🔒 SANITIZE EXTRACTED PDF TEXT
      inputText = sanitizeInput(text);
      
    // 🔒 TEXT INPUT PATH  
    } else if (req.body.text) {
      // 🔒 SANITIZE + TRUNCATE USER TEXT
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

    // 🔒 FINAL SAFETY CHECKS
    if (inputText.length === 0) {
      return res.status(400).json({ message: 'No valid text to summarize after sanitization.' });
    }
    if (inputText.split(/\s+/).length > MAX_SUMMARIZE_WORDS) {
      inputText = truncateToWords(inputText, MAX_SUMMARIZE_WORDS);
    }

    // 🔒 CALL AI SERVICE WITH HARD TIMEOUT
    const aiResponse = await axios.post(
      'http://localhost:8000/summarize',
      { text: inputText },
      { timeout: 40000,
        headers:{
          'INTERNAL_API_KEY': process.env.INTERNAL_API_KEY,
        }
       }
    );

    const { summary } = aiResponse.data;
    
    // 🔒 SANITIZE AI RESPONSE (PREVENT XSS)
    const cleanSummary = sanitizeAiResponse(summary);
    
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.send(cleanSummary);

  } catch (err) {
    console.error('Summarization Security Error:', err.message);

    // Note: LIMIT_FILE_SIZE is handled in the middleware wrapper now, 
    // but kept here for safety if multer throws differently
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        message: `File exceeds 2MB limit` 
      });
    }
    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      return res.status(504).json({ 
        message: 'AI service timed out. Try a shorter input.' 
      });
    }
    if (err.response?.status === 422) {
      return res.status(400).json({ 
        message: 'Invalid content. Please use plain text or text-based PDF.' 
      });
    }

    res.status(500).json({ 
      message: 'Failed to generate summary. Please try again.' 
    });
  }
};