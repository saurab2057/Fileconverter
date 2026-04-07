// src/lib/htmlUtils.js
export const decodeHTML = (text) => {
  if (!text) return '';
  
  // Handle in browser environment
  if (typeof document !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');
    return doc.documentElement.textContent || text;
  }
  
  // Fallback for SSR/Node environments
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'");
};