// src/lib/api.js
import axios from 'axios';
import { API_BASE_URL } from './constants';

// ─────────────────────────────────────────────────────────────
// Create Axios instance with base configuration
// ─────────────────────────────────────────────────────────────
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Crucial for sending httpOnly cookies
  timeout: 30000, // 30 second timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─────────────────────────────────────────────────────────────
// Request interceptor (add auth token + fix FormData Content-Type)
// ─────────────────────────────────────────────────────────────
apiClient.interceptors.request.use(
  (config) => {
    const token = session.accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // BUG FIX: When sending FormData (file uploads), the axios instance's
    // default 'Content-Type: application/json' overrides the browser's
    // automatic 'multipart/form-data; boundary=...' header.
    // Multer on the backend cannot parse the request without the boundary,
    // causing req.files to be empty → 400 "No files were uploaded."
    //
    // Fix: delete Content-Type for FormData requests so the browser sets
    // it automatically with the correct boundary.
    //
    // Affected endpoints without this fix:
    //   POST /api/convert/batch    (batchConvert)
    //   POST /api/compress/batch   (batchCompress)
    //   POST /api/ai/summarize-pdf (summarize)
    //   PUT  /api/user/profile     (updateProfile with avatar upload)
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ─────────────────────────────────────────────────────────────
// Token Refresh State Management (prevents race conditions)
// ─────────────────────────────────────────────────────────────
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// ─────────────────────────────────────────────────────────────
// Session token storage (in-memory, not persistent)
// ─────────────────────────────────────────────────────────────
export const session = {
  accessToken: null,

  setToken(token) {
    this.accessToken = token;
  },

  clearToken() {
    this.accessToken = null;
  },

  getToken() {
    return this.accessToken;
  },
};

// ─────────────────────────────────────────────────────────────
// Response interceptor (handle 401 and auto-refresh)
// ─────────────────────────────────────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Skip refresh for certain endpoints
    const skipEndpoints = [
      '/api/auth/refresh-token',
      '/api/auth/login',
      '/api/auth/signup',
      '/api/auth/google',
      '/api/auth/logout',
      '/api/auth/forgot-password',        // public — no token needed
      '/api/auth/validate-reset-token',   // public — uses reset_session cookie
      '/api/auth/reset-password',         // public — uses reset_session cookie

    ];

    const shouldSkip = skipEndpoints.some(endpoint =>
      originalRequest.url?.includes(endpoint)
    );

    // Only handle 401s that haven't been retried and are not excluded
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !shouldSkip
    ) {
      if (isRefreshing) {
        // If refresh is already in progress, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            // Retry with the original request — the request interceptor
            // will attach the new token from session.accessToken
            return apiClient(originalRequest);
          })
          .catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Attempt to refresh the token
        const response = await apiClient.post('/api/auth/refresh-token');
        const { accessToken, user } = response.data;

        session.setToken(accessToken);

        // Notify the app about successful refresh
        window.dispatchEvent(
          new CustomEvent('session-refreshed', { detail: user })
        );

        // Process any queued requests
        processQueue(null, accessToken);

        // Retry the original request
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed - clear session and redirect to login
        processQueue(refreshError, null);

        // Handle server down (no response)
        if (!refreshError.response) {
          window.location.href = '/error/503';
          return Promise.reject(refreshError);
        }

        // Clear session and notify logout
        session.clearToken();

        // Only dispatch logout if not already on login page
        if (window.location.pathname !== '/login') {
          window.dispatchEvent(new Event('logout-event'));
        }

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Handle 403 Forbidden (e.g., admin access denied)
    if (error.response?.status === 403) {
      console.warn('Access forbidden:', error.response.data?.message);
    }

    if (error.response?.status === 500 || error.response?.status === 503) {
      const skipRedirect = [
        '/api/health',
        '/api/chat',
        '/api/convert',
        '/api/compress',
        '/api/history',
        '/api/ai',
      ].some(path => originalRequest.url?.includes(path));

      if (!skipRedirect) {
        window.location.replace(`/error/${error.response.status}`);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;