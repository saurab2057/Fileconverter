// 🔒 SECURITY CONSTANTS
export const MAX_CHAT_CHARS = 500;
export const MAX_SUMMARIZE_WORDS = 500;
export const MAX_SUMMARIZER_PAGES = 2;
export const MAX_SUMMARIZER_FILE_SIZE = 2 * 1024 * 1024; // 2MB

// 🔒 CHATBOT FORBIDDEN PATTERNS
export const CHAT_FORBIDDEN_PATTERNS = [
  /ignore\s+(previous|system)\s+(instructions|prompt)/i,
  /system\s*[:=]\s*["']?role/i,
  /<\|system\|>/i,
  /role\s*=\s*["']system["']/i,
  /execute\s+(command|code)/i,
  /delete\s+(all|database)/i,
  /you\s+are\s+(not|no longer)\s+a/i,
  /prompt\s*[:=]\s*["']/i,
  /base64_decode/i,
  /union\s+select/i,
  /<script/i,
  /javascript:/i
];

// 🔒 SUMMARIZER FORBIDDEN PATTERNS (Subset)
export const SUMMARIZER_FORBIDDEN_PATTERNS = [
  /ignore\s+(previous|system)\s+(instructions|prompt)/i,
  /system\s*[:=]\s*["']?role/i,
  /execute\s+(command|code)/i,
  /delete\s+(all|database)/i,
  /you\s+are\s+(not|no longer)\s+a/i
];

// 🔒 SHARED SANITIZATION LOGIC
export const sanitizeInput = (text = '') => {
  // 1. Remove zero-width injection vectors
  let clean = text.replace(/[\u200B-\u200D\uFEFF\u2060]/g, '');
  
  // 2. Normalize Unicode (collapse emoji sequences)
  clean = clean.normalize('NFKC');
  
  // 3. Remove ALL emojis (ZWJ sequences bypass simple filters)
  const emojiRegex = /[\p{Emoji}\u{1F000}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
  clean = clean.replace(emojiRegex, '');
  
  // 4. Collapse excessive whitespace
  clean = clean.replace(/\s+/g, ' ').trim();
  
  return clean;
};

// 🔒 PATTERN CHECKER
export const containsForbiddenPatterns = (text, patterns) => {
  const normalized = text.toLowerCase();
  return patterns.some(pattern => pattern.test(normalized));
};

// 🔒 HELPER: TRUNCATE WORDS
export const truncateToWords = (text, maxWords) => {
  if (!text) return '';
  const words = text.trim().split(/\s+/);
  return words.length <= maxWords ? text : words.slice(0, maxWords).join(' ');
};

export const sanitizeAiResponse = (text) => {
  if (!text) return 'No response generated';

  return text
    // remove script blocks
    .replace(/<script.*?>.*?<\/script>/gis, '')
    
    // remove any remaining HTML tags
    .replace(/<\/?[^>]+(>|$)/g, '')
    
    // collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
};