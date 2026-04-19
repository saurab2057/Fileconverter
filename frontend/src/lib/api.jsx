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
// Request interceptor (add auth token if available)
// ─────────────────────────────────────────────────────────────
apiClient.interceptors.request.use(
  (config) => {
    const token = session.accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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
            // Retry with the original request
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
      // Optional: redirect to 403 page or show toast
      console.warn('Access forbidden:', error.response.data?.message);
    }

    // Updated interceptor section
    if (error.response?.status === 500 || error.response?.status === 503) {
      const skipRedirect = [
        '/api/health',          // health checks
        '/api/chat',            // chatbot messages
        '/api/convert',         // file conversion
        '/api/compress',        // file compression
        '/api/history',         // user history/stats
        '/api/ai',              // AI summarizer (and any future AI endpoints)
      ].some(path => originalRequest.url?.includes(path));

      if (!skipRedirect) {
        window.location.replace(`/error/${error.response.status}`);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;