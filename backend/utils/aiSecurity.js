// utils/aiSecurity.js

// ==============================
// 📏 Input Limits (Security + Performance)
// ==============================

// Prevent prompt flooding / abuse
export const MAX_CHAT_CHARS = 500;

// Limit summarization input size
export const MAX_SUMMARIZE_WORDS = 500;
export const MAX_SUMMARIZER_PAGES = 2;

// Max upload size (2MB)
export const MAX_SUMMARIZER_FILE_SIZE = 2 * 1024 * 1024;


// ==============================
// 🚫 Forbidden Patterns (Prompt Injection + Attacks)
// ==============================

// Strong detection set for chat (strict)
export const CHAT_FORBIDDEN_PATTERNS = [
  /ignore\s+(previous|system)\s+(instructions|prompt)/i,
  /ignore\s+all\s+(rules|instructions)/i,
  /disregard\s+(previous|above)/i,

  /system\s*[:=]\s*["']?role/i,
  /system\s*:\s*["']?/i,
  /<\|system\|>/i,
  /role\s*=\s*["']system["']/i,

  /you\s+are\s+(not|no longer)\s+a/i,
  /act\s+as\s+(an?|the)/i,
  /pretend\s+to\s+be/i,

  /execute\s+(command|code)/i,
  /eval\s*\(/i,
  /Function\s*\(/i,

  /delete\s+(all|database)/i,

  /prompt\s*[:=]\s*["']/i,

  /bypass\s+(security|filters)/i,
  /jailbreak/i,
  /do\s+anything\s+now/i,

  /base64_decode|atob|btoa/i,
  /union\s+select/i,

  /<script/i,
  /javascript:/i
];

// Reduced set for summarizer (less strict, avoids false positives in documents)
export const SUMMARIZER_FORBIDDEN_PATTERNS = [
  /ignore\s+(previous|system)\s+(instructions|prompt)/i,
  /ignore\s+all\s+(rules|instructions)/i,
  /disregard\s+(previous|above)/i,

  /system\s*[:=]\s*["']?role/i,
  /system\s*:\s*["']?/i,

  /execute\s+(command|code)/i,
  /delete\s+(all|database)/i,

  /you\s+are\s+(not|no longer)\s+a/i,
  /act\s+as\s+(an?|the)/i,
  /pretend\s+to\s+be/i
];


// ==============================
// 🔒 Dangerous Unicode Characters
// ==============================

/**
 * Control characters regex that removes dangerous Unicode control characters
 * but PRESERVES newlines (\n = 0x0A) and carriage returns (\r = 0x0D)
 * 
 * Why: Newlines are essential for markdown list formatting in AI responses
 * Range: \u0000-\u0009 (0-9) and \u000B-\u001F (11-31) - skips \u000A (10) and \u000D (13)
 */
const CONTROL_CHARS_REGEX = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F\u200E\u200F\u202A-\u202E]/g;


// ==============================
// 🧹 Input Sanitization (FOR USER INPUT ONLY)
// ==============================

export const sanitizeInput = (text = '') => {
  return text
    // Remove zero-width/invisible characters
    .replace(/[\u200B-\u200D\uFEFF\u2060]/g, '')

    // Normalize Unicode (prevents homoglyph tricks)
    .normalize('NFKC')

    // Remove control + bidi override chars
    .replace(CONTROL_CHARS_REGEX, '')

    // Remove emojis (optional but reduces noise)
    .replace(/[\p{Extended_Pictographic}\u{1F000}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')

    // Collapse ALL whitespace to single spaces (for user input only)
    .replace(/\s+/g, ' ')
    .trim();
};


// ==============================
// 🔍 Pattern Detection
// ==============================

export const containsForbiddenPatterns = (text, patterns) => {
  const normalized = text.toLowerCase();
  return patterns.some(pattern => pattern.test(normalized));
};


// ==============================
// ✂️ Word Limiting Utility
// ==============================

export const truncateToWords = (text, maxWords) => {
  if (!text) return '';

  const words = text.trim().split(/\s+/);

  return words.length <= maxWords
    ? text
    : words.slice(0, maxWords).join(' ');
};


// ==============================
// 🛡️ AI Response Sanitization (PRESERVES MARKDOWN FORMATTING)
// ==============================

export const sanitizeAiResponse = (text) => {
  if (!text) return 'No response generated';

  return text
    // Remove dangerous control characters (newlines are preserved)
    .replace(CONTROL_CHARS_REGEX, '')

    // Remove spammy symbol clusters
    .replace(/[$%#^*&]{3,}/g, '')

    // Escape HTML to prevent XSS (ReactMarkdown handles rendering safely)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

    // Collapse multiple spaces/tabs to single space (but preserve newlines)
    .replace(/[ \t]{2,}/g, ' ')

    // Clean up whitespace around newlines (preserve newlines)
    .replace(/[ \t]*\n[ \t]*/g, '\n')

    // Collapse 3+ newlines to 2 (keeps markdown lists readable)
    .replace(/\n{3,}/g, '\n\n')

    .trim();
};