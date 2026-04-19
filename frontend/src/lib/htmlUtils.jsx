// src/lib/htmlUtils.js
export const decodeHTML = (text) => {
  if (!text) return '';
  
  // Handle in browser environment
  if (typeof document !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');
      return doc.documentElement.textContent || text;
    } catch (error) {
      console.warn('DOMParser failed, falling back to regex decoding:', error);
      // Fall through to regex fallback
    }
  }
  
  // Fallback for SSR/Node environments or parser failure
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'");
};