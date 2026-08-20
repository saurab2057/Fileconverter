// ─────────────────────────────────────────────────────────────
// Mock application constants
// Vite normally provides these values through import.meta.env.
// Jest does not process Vite's import.meta.env, so the constants
// module is replaced with predictable test values.
// ─────────────────────────────────────────────────────────────
jest.mock('@/lib/constants', () => ({
  API_BASE_URL: 'http://localhost:5000',
  RECAPTCHA_SITE_KEY: 'mock-recaptcha-key',
  GOOGLE_CLIENT_ID: 'mock-google-client-id',

  MAX_FILE_SIZE_MB: 100,
  MAX_FILES_PER_BATCH: 5,
  CHAT_MAX_CHARS: 500,

  DEFAULT_PAGE_SIZE: 20,
  DEFAULT_ADMIN_PAGE_SIZE: 50,

  STORAGE_KEYS: {
    THEME: 'theme',
    ADMIN_ACTIVE_TAB: 'adminActiveTab',
    CHATBOT_HAS_OPENED: 'chatbot_hasOpened',
    CHATBOT_TOOLTIP_DISMISSED: 'chatbot_tooltipDismissed',
  },
}));


// ─────────────────────────────────────────────────────────────
// Extend Jest's DOM assertions with Testing Library matchers.
// This enables assertions such as:
// expect(element).toBeInTheDocument()
// ─────────────────────────────────────────────────────────────
import '@testing-library/jest-dom';


// ─────────────────────────────────────────────────────────────
// TextEncoder / TextDecoder
// Some browser-oriented libraries expect these Web APIs,
// while the Jest Node environment may not provide them.
// ─────────────────────────────────────────────────────────────
import { TextEncoder, TextDecoder } from 'util';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;


// ─────────────────────────────────────────────────────────────
// Mock fetch
// Prevent tests from making real HTTP requests.
// Individual tests can override the mock when they need
// specific response data.
// ─────────────────────────────────────────────────────────────
global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    ok: true,
    status: 200,
  })
);


// ─────────────────────────────────────────────────────────────
// Mock localStorage
// Provides an in-memory Jest implementation so tests can use
// localStorage without depending on the browser environment.
// ─────────────────────────────────────────────────────────────
const localStorageMock = {
  getItem: jest.fn(() => null),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});


// ─────────────────────────────────────────────────────────────
// Mock sessionStorage
// Provides an in-memory Jest implementation for code that
// accesses sessionStorage during tests.
// ─────────────────────────────────────────────────────────────
const sessionStorageMock = {
  getItem: jest.fn(() => null),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
});


// ─────────────────────────────────────────────────────────────
// Mock matchMedia
// jsdom does not implement window.matchMedia by default.
// This mock prevents components using responsive/theme logic
// from failing during tests.
// ─────────────────────────────────────────────────────────────
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,

    addListener: jest.fn(),
    removeListener: jest.fn(),

    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),

    dispatchEvent: jest.fn(),
  })),
});


// ─────────────────────────────────────────────────────────────
// Mock URL object URL methods
// jsdom does not provide these methods completely.
// They are commonly used when handling uploaded/generated files.
// ─────────────────────────────────────────────────────────────
global.URL.createObjectURL = jest.fn(() => 'mock-url');
global.URL.revokeObjectURL = jest.fn();


// ─────────────────────────────────────────────────────────────
// Mock crypto.randomUUID
// Provides a deterministic UUID during tests instead of relying
// on the runtime's crypto implementation.
// ─────────────────────────────────────────────────────────────
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'mock-uuid-1234',
  },
  writable: true,
});


// ─────────────────────────────────────────────────────────────
// Mock Google reCAPTCHA
// Prevents tests from contacting Google's reCAPTCHA service.
// ─────────────────────────────────────────────────────────────
window.grecaptcha = {
  execute: jest.fn(() => Promise.resolve('mock-recaptcha-token')),
};