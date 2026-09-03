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
// CROSS-TAB REFRESH LOCK  (NEW)
//
// THE PROBLEM THIS SOLVES:
//   The backend's generateDeviceId() hashes (IP + User-Agent) to
//   group sessions by "device". Every tab in the same browser on
//   the same network produces the SAME deviceId — so two tabs of
//   this site share the exact same Session document server-side.
//
//   The refresh token ROTATES on every use (old jti is invalidated,
//   a new one is issued). If Tab A and Tab B both read the current
//   (not-yet-rotated) refresh cookie and call /api/auth/refresh-token
//   within the same short window:
//     1. Tab A's request lands first → backend rotates jti X → Y.
//     2. Tab B's request lands next, still presenting jti X.
//     3. Backend finds no session matching jti X anymore →
//        "Token reuse detected" → wipes EVERY session for that user.
//
//   This is not a rare edge case — it happens any time two tabs'
//   access tokens expire around the same moment (e.g. both idle
//   past the 15-minute expiry, then the person switches tabs).
//
// THE FIX:
//   Use the browser's Web Locks API (navigator.locks) to serialize
//   the actual refresh call across tabs. Only one tab can hold the
//   'auth-refresh-lock' at a time:
//     - Tab A acquires the lock, calls refresh-token, rotates the
//       cookie, releases the lock.
//     - Tab B was blocked waiting for the lock. Once it acquires
//       the lock (after A releases it), IT MAKES ITS OWN CALL —
//       but the cookie has already been rotated by A, so Tab B's
//       browser sends the CURRENT jti, not the stale one. Tab B's
//       refresh succeeds normally instead of triggering reuse
//       detection.
//
//   Each tab still needs to make its own network request — the
//   resulting access token lives in the in-memory `session` object
//   below, which is a separate JS heap per tab and cannot be
//   shared directly between tabs. The lock's only job is to
//   prevent the two requests from OVERLAPPING, which is exactly
//   what causes the stale-cookie race.
//
//   Web Locks releases automatically if the holding tab is closed
//   or crashes mid-request, so there's no risk of a permanently
//   stuck lock the way a hand-rolled localStorage mutex could get.
//
//   Browser support: Chrome 69+, Firefox 96+, Safari 15.4+ (all
//   evergreen browsers). If navigator.locks is unavailable, this
//   falls back to a plain unlocked call — identical to the
//   previous behavior, so nothing regresses on old browsers.
// ─────────────────────────────────────────────────────────────
const REFRESH_LOCK_NAME = 'auth-refresh-lock';

export const refreshWithLock = async () => {
  const doRefresh = async () => {
    const { data } = await apiClient.post('/api/auth/refresh-token');
    return data; // { accessToken, user }
  };

  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request(REFRESH_LOCK_NAME, doRefresh);
  }

  // Fallback for browsers without Web Locks support.
  return doRefresh();
};

// ─────────────────────────────────────────────────────────────
// Token Refresh State Management (prevents race conditions
// WITHIN a single tab — multiple components hitting a 401 at
// once still queue behind one refresh call, same as before)
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
        // If refresh is already in progress (within this tab), queue this request
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
        // CHANGED: routed through refreshWithLock() instead of a raw
        // apiClient.post call, so this also coordinates with any other
        // TAB that might be refreshing at the same moment — not just
        // other requests within this tab (that's what isRefreshing above
        // already handled). See the big comment above refreshWithLock().
        const { accessToken, user } = await refreshWithLock();

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
