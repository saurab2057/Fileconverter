import axios from 'axios';
import {
  MAX_CHAT_CHARS,
  CHAT_FORBIDDEN_PATTERNS,
  sanitizeInput,
  containsForbiddenPatterns,
  sanitizeAiResponse
} from '../utils/aiSecurity.js';

export const handleChat = async (req, res) => {
  const { message } = req.body;

  // 🔒 VALIDATE INPUT PRESENCE
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Valid message text is required' });
  }

  // 🔒 SANITIZE + VALIDATE LENGTH
  const sanitizedMessage = sanitizeInput(message);
  if (sanitizedMessage.length === 0) {
    return res.status(400).json({ error: 'Message contains only blocked characters' });
  }
  if (sanitizedMessage.length > MAX_CHAT_CHARS) {
    return res.status(400).json({
      error: `Message exceeds ${MAX_CHAT_CHARS} character limit. Please shorten your query.`
    });
  }

  // 🔒 BLOCK PROMPT INJECTION ATTEMPTS
  if (containsForbiddenPatterns(sanitizedMessage, CHAT_FORBIDDEN_PATTERNS)) {
    console.warn(`[SECURITY BLOCK] Prompt injection attempt blocked from IP: ${req.ip}`);
    return res.status(403).json({
      error: 'Message contains blocked patterns. Please rephrase your query.'
    });
  }

  try {
    // 🔒 HARD TIMEOUT (PROTECTS YOUR HF SERVICE)
    const aiResponse = await axios.post(
      'https://ai-microservices-xwid.onrender.com/chat',
      { message: sanitizedMessage },
      {
        timeout: 30000,
        headers: {
          'INTERNAL_API_KEY': process.env.INTERNAL_API_KEY,
        }
      }
    );

    // 🔒 SANITIZE AI RESPONSE (PREVENT XSS IN FRONTEND)
    const cleanReply = sanitizeAiResponse(aiResponse.data.reply);

    res.json({ reply: cleanReply });

  } catch (err) {
    console.error("AI Chat Service Error:");
    console.error("Message:", err.message);
    console.error("Code:", err.code);
    console.error("Status:", err.response?.status);
    console.error("Response:", err.response?.data);

    // 🔒 TIMEOUT HANDLING
    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      return res.status(504).json({
        error: 'AI service timed out. Please try a shorter query.'
      });
    }

    // 🔒 HF-SPECIFIC ERRORS
    if (err.response?.status === 422) {
      return res.status(400).json({
        error: 'Invalid query format. Please use plain text only.'
      });
    }

    res.status(500).json({
      error: 'AI service unavailable. Please try again later.'
    });
  }
};
