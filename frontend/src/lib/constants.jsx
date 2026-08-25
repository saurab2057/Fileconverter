// src/lib/constants.js

// ─────────────────────────────────────────────────────────────
// ENVIRONMENT VARIABLES (with validation fallbacks)
// ─────────────────────────────────────────────────────────────

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://backend-kijk.onrender.com';

export const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '6LfF_JkrAAAAADh5eTSImyZkNRgezC6UNdxzC0no';

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '720705456854-qetqatdv8oqjvn8jc1hnfov97eu0d3sg.apps.googleusercontent.com';

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

// ─────────────────────────────────────────────────────────────
// DEVELOPMENT WARNINGS (helpful during local development)
// ─────────────────────────────────────────────────────────────

if (import.meta.env.DEV) {
  if (!import.meta.env.VITE_API_BASE_URL) {
    console.warn('⚠️ VITE_API_BASE_URL not set, using default:', API_BASE_URL);
  }
  if (!import.meta.env.VITE_RECAPTCHA_SITE_KEY) {
    console.warn('⚠️ VITE_RECAPTCHA_SITE_KEY not set, using hardcoded fallback.');
  }
}
