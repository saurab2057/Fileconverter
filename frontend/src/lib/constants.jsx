// src/lib/constants.js

// ─────────────────────────────────────────────────────────────
// APPLICATION ENDPOINTS & CREDENTIALS
// ─────────────────────────────────────────────────────────────
// src/lib/constants.js
export const API_BASE_URL = ''; // same-origin now; Vercel rewrite proxies /api/* to Render
export const RECAPTCHA_SITE_KEY = '6LfF_JkrAAAAADh5eTSImyZkNRgezC6UNdxzC0no';
export const GOOGLE_CLIENT_ID = '720705456854-qetqatdv8oqjvn8jc1hnfov97eu0d3sg.apps.googleusercontent.com';
export const GOOGLE_REDIRECT_URI = 'https://fileconverter-mu.vercel.app/api/auth/google/callback';

// ─────────────────────────────────────────────────────────────
// APP CONSTANTS
// ─────────────────────────────────────────────────────────────

export const MAX_FILE_SIZE_MB = 100;
export const MAX_FILES_PER_BATCH = 5;
export const CHAT_MAX_CHARS = 500;

// Pagination defaults
export const DEFAULT_PAGE_SIZE = 20;
export const DEFAULT_ADMIN_PAGE_SIZE = 50;

// Local storage keys
export const STORAGE_KEYS = {
  THEME: 'theme',
  ADMIN_ACTIVE_TAB: 'adminActiveTab', // will be removed after nested routing
  CHATBOT_HAS_OPENED: 'chatbot_hasOpened',
  CHATBOT_TOOLTIP_DISMISSED: 'chatbot_tooltipDismissed',
};
