// src/lib/AuthContext.jsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import apiClient from '@/lib/api';
import { useNavigate } from 'react-router-dom';


// ─────────────────────────────────────────────────────────────
// Static Session Bridge (Token storage + Axios header sync)
// ─────────────────────────────────────────────────────────────
const session = {
  accessToken: null,

  setToken(token) {
    console.log('Session: Setting access token', token ? 'present' : 'null');
    this.accessToken = token;
    if (token) {
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete apiClient.defaults.headers.common['Authorization'];
    }
  },

  clearToken() {
    console.log('Session: Clearing access token');
    this.accessToken = null;
    delete apiClient.defaults.headers.common['Authorization'];
  },

  getToken() {
    return this.accessToken;
  },
};

// ─────────────────────────────────────────────────────────────
// Token Refresh Guard (Prevent concurrent refresh calls)
// ─────────────────────────────────────────────────────────────
let refreshPromise = null;

// ─────────────────────────────────────────────────────────────
// 🔒 Axios Response Interceptor (Auto-refresh on 401)
// ─────────────────────────────────────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only handle 401s on non-auth endpoints, and only once per request
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      originalRequest.url !== '/api/auth/refresh-token' &&
      originalRequest.url !== '/api/auth/login' &&
      originalRequest.url !== '/api/auth/signup' &&
      originalRequest.url !== '/api/auth/google'
    ) {
      originalRequest._retry = true;

      // If no refresh is in progress, start one
      if (!refreshPromise) {
        console.log('Interceptor: Attempting token refresh for', originalRequest.url);

        refreshPromise = apiClient
          .post('/api/auth/refresh-token')
          .then((res) => {
            const { accessToken, user } = res.data;
            session.setToken(accessToken);
            // Notify other components/tabs that session was refreshed
            window.dispatchEvent(new CustomEvent('session-refreshed', { detail: user }));
            return res;
          })
          .catch((refreshError) => {
            // ✅ ADD THIS — server is completely down (no response at all)
            if (!refreshError.response) {
              window.location.href = '/error/503';
              return Promise.reject(refreshError);
            }
            if (window.location.pathname !== '/login') {
              window.dispatchEvent(new Event('logout-event'));
            }
            return Promise.reject(refreshError);
          })
          .finally(() => {
            console.log('Interceptor: Refresh promise cleared');
            refreshPromise = null;
          });
      }

      // Wait for the refresh to complete, then retry the original request
      try {
        await refreshPromise;
        console.log('Interceptor: Retrying original request', originalRequest.url);
        return apiClient(originalRequest);
      } catch (e) {
        return Promise.reject(e);
      }
    }

    return Promise.reject(error);
  }
);

// ─────────────────────────────────────────────────────────────
// React Context Setup
// ─────────────────────────────────────────────────────────────
const AuthContext = createContext(null);
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// ─────────────────────────────────────────────────────────────
// AuthProvider Component
// ─────────────────────────────────────────────────────────────
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const navigate = useNavigate();

  // 🔒 Logout: Clear local state + optionally notify server
  const logout = async (shouldNotifyServer = true) => {

    if (shouldNotifyServer) {
      try {
        await apiClient.post('/api/auth/logout');
      } catch (e) {
        // Non-critical: don't block logout if server call fails
        console.warn('⚠️ Server logout failed (non-critical):', e.message);
      }
    }

    session.clearToken();
    setUser(null);
    setAuthLoading(false);
    navigate('/', { replace: true });
  };

  const login = (token, userData) => {
    session.setToken(token);
    setUser(userData);
  };

  // 🔒 Update user data (e.g., after profile edit)
  const updateUser = (newUserData) => {
    console.log('AuthProvider: Updating user, new role:', newUserData.role);
    setUser(newUserData);
  };

  // ───────────────────────────────────────────────────────────
  // Initialize Auth on Mount + Event Listeners
  // ───────────────────────────────────────────────────────────
  useEffect(() => {
    // Event: Global logout trigger (from interceptor or other tabs)
    const handleLogoutEvent = () => logout(false);

    // Event: Session refreshed in another tab/component
    const handleSessionRefreshed = (event) => {
      setUser(event.detail);
    };

    // Event: Page restored from browser back/forward cache (bfcache)
    const handlePageShow = (event) => {
      if (event.persisted) {
        // Force a fresh session check when returning via browser navigation
        initializeAuth();
      }
    };

    // Register event listeners
    window.addEventListener('logout-event', handleLogoutEvent);
    window.addEventListener('session-refreshed', handleSessionRefreshed);
    window.addEventListener('pageshow', handlePageShow);

    // Initial auth check: try to restore session from refresh token
    const initializeAuth = async () => {
      try {
        const { data } = await apiClient.post('/api/auth/refresh-token');
        session.setToken(data.accessToken);
        setUser(data.user);
      } catch (error) {
        setUser(null);
      } finally {
        setAuthLoading(false);
      }
    };

    initializeAuth();

    // Cleanup: Remove event listeners on unmount
    return () => {
      window.removeEventListener('logout-event', handleLogoutEvent);
      window.removeEventListener('session-refreshed', handleSessionRefreshed);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, []); // Empty deps = run once on mount

  // ───────────────────────────────────────────────────────────
  // Context Value
  // ───────────────────────────────────────────────────────────
  const value = {
    user,
    isAuthenticated: !!user,
    authLoading,
    login,
    logout,
    updateUser,
  };

  // ───────────────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────────────
  return (
    <AuthContext.Provider value={value}>
      {!authLoading ? children : <div className="min-h-screen flex items-center justify-center text-gray-600 dark:text-gray-300">Loading session...</div>}
    </AuthContext.Provider>
  );
};