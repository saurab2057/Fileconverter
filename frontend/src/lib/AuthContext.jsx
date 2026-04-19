// src/lib/AuthContext.jsx
import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient, { session } from '@/lib/api';
import { authService } from '@/services/authService';
import LoadingAnimation from '@/components/ui/LoadingAnimation';

// ─────────────────────────────────────────────────────────────
// BroadcastChannel for cross-tab auth sync (with fallback)
// ─────────────────────────────────────────────────────────────
const AUTH_CHANNEL_NAME = 'auth-sync';
const authChannel = typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel(AUTH_CHANNEL_NAME)
  : null;

// Fallback: localStorage key for older browsers
const STORAGE_LOGOUT_KEY = 'auth-logout-broadcast';

// ─────────────────────────────────────────────────────────────
// React Context
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
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const navigate = useNavigate();

  // Track last broadcast timestamp to avoid duplicate handling
  const lastBroadcastRef = useRef(0);

  // ───────────────────────────────────────────────────────────
  // Broadcast logout to other tabs (BroadcastChannel + fallback)
  // ───────────────────────────────────────────────────────────
  const broadcastLogout = useCallback(() => {
    const payload = { type: 'LOGOUT', timestamp: Date.now() };

    if (authChannel) {
      authChannel.postMessage(payload);
    } else {
      // Fallback: localStorage event (triggers 'storage' event in other tabs)
      try {
        localStorage.setItem(STORAGE_LOGOUT_KEY, JSON.stringify(payload));
        localStorage.removeItem(STORAGE_LOGOUT_KEY); // Clean up immediately
      } catch (err) {
        console.warn('BroadcastChannel fallback failed:', err);
      }
    }
  }, []);

  // ───────────────────────────────────────────────────────────
  // Handle incoming broadcast logout from other tabs
  // ───────────────────────────────────────────────────────────
  const handleBroadcastLogout = useCallback((payload) => {
    // Ignore if we're already logging out intentionally
    if (isLoggingOut) return;

    // Ignore stale broadcasts (> 5 seconds old)
    if (Date.now() - payload.timestamp > 5000) return;

    // Ignore if we just processed a recent broadcast (debounce)
    if (Date.now() - lastBroadcastRef.current < 1000) return;

    lastBroadcastRef.current = Date.now();

    // Clear state and navigate (same flow as explicit logout, but skip server call)
    session.clearToken();
    setUser(null);
    setAuthLoading(false);
    navigate('/', { replace: true });
  }, [navigate, isLoggingOut]);

  // ───────────────────────────────────────────────────────────
  // Logout function (clears session, syncs tabs, optional server notify)
  // ───────────────────────────────────────────────────────────
  const logout = useCallback(async (shouldNotifyServer = true) => {
    // Prevent duplicate/logout race conditions
    if (isLoggingOut) return;
    setIsLoggingOut(true);

    // 📢 Broadcast logout to other tabs BEFORE clearing local state
    broadcastLogout();

    // 1️⃣ Clear client-side auth state IMMEDIATELY
    session.clearToken();
    setUser(null);
    setAuthLoading(false);

    // 2️⃣ Navigate AFTER state is clean (prevents AdminRoute /403 redirect)
    navigate('/', { replace: true });

    // 3️⃣ Fire server logout in background (non-blocking, fire-and-forget)
    if (shouldNotifyServer) {
      authService.logout().catch((err) => {
        // Client is already logged out; server errors are non-critical here
        console.warn('Server logout failed (client already cleared):', err);
      });
    }

    // Reset logout flag after navigation completes (prevents flicker on rapid actions)
    setTimeout(() => {
      setIsLoggingOut(false);
    }, 1000);

  }, [navigate, isLoggingOut, broadcastLogout]);

  // ───────────────────────────────────────────────────────────
  // Login function (stores token and user data)
  // ───────────────────────────────────────────────────────────
  const login = useCallback((token, userData) => {
    session.setToken(token);
    setUser(userData);
  }, []);

  // ───────────────────────────────────────────────────────────
  // Update user data (e.g., after profile edit)
  // ───────────────────────────────────────────────────────────
  const updateUser = useCallback((newUserData) => {
    setUser(newUserData);
  }, []);

  // ───────────────────────────────────────────────────────────
  // Initialize auth on mount (attempt token refresh)
  // ───────────────────────────────────────────────────────────
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { accessToken, user: userData } = await authService.refreshToken();
        session.setToken(accessToken);
        setUser(userData);
      } catch (error) {
        // No valid refresh token - user is not authenticated
        setUser(null);
        session.clearToken();
      } finally {
        setAuthLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // ───────────────────────────────────────────────────────────
  // Event listeners: cross-tab sync + bfcache + safety net logout
  // ───────────────────────────────────────────────────────────
  useEffect(() => {
    // Handle session refreshed (triggered by api interceptor on successful refresh)
    const handleSessionRefreshed = (event) => {
      setUser(event.detail);
    };

    // Handle forced logout (safety net: triggered by api interceptor when refresh fails)
    const handleLogoutEvent = () => {
      // Skip if we're already handling an intentional logout
      if (isLoggingOut) return;

      // Skip if we just processed a broadcast logout (avoid duplicate handling)
      if (Date.now() - lastBroadcastRef.current < 2000) return;

      // Clear state only - navigation handled by explicit logout flow or public route check
      session.clearToken();
      setUser(null);
      setAuthLoading(false);

      // Navigate only if not already on a public route (prevent redirect loops)
      const publicRoutes = [
        '/',
        '/login',
        '/signup',
        '/403',
        '/error',           // this already catches /error/500, /error/503, /error/403 etc.
        '/error/403',
        '/error/500',
        '/error/503',
        '/503'
      ];
      const isOnPublicRoute = publicRoutes.some(route =>
        window.location.pathname.startsWith(route)
      );

      if (!isOnPublicRoute) {
        navigate('/login', { replace: true });
      }
    };

    // Handle page restored from browser back/forward cache (bfcache)
    const handlePageShow = (event) => {
      if (event.persisted) {
        // Re-verify session by attempting a lightweight API call
        // The interceptor will handle token refresh if needed
        authService.getProfile().catch(() => {
          // If profile fetch fails, assume session expired
          session.clearToken();
          setUser(null);
          setAuthLoading(false);
        });
      }
    };

    // Listen for BroadcastChannel messages (cross-tab logout sync)
    const handleChannelMessage = (event) => {
      if (event.data?.type === 'LOGOUT') {
        handleBroadcastLogout(event.data);
      }
    };

    // Listen for localStorage fallback events (older browsers)
    const handleStorageEvent = (e) => {
      if (e.key === STORAGE_LOGOUT_KEY && e.newValue) {
        try {
          const payload = JSON.parse(e.newValue);
          if (payload?.type === 'LOGOUT') {
            handleBroadcastLogout(payload);
          }
        } catch (err) {
          console.warn('Failed to parse storage logout event:', err);
        }
      }
    };

    // Register all listeners
    window.addEventListener('session-refreshed', handleSessionRefreshed);
    window.addEventListener('logout-event', handleLogoutEvent);
    window.addEventListener('pageshow', handlePageShow);

    if (authChannel) {
      authChannel.addEventListener('message', handleChannelMessage);
    }
    window.addEventListener('storage', handleStorageEvent);

    // Cleanup listeners on unmount
    return () => {
      window.removeEventListener('session-refreshed', handleSessionRefreshed);
      window.removeEventListener('logout-event', handleLogoutEvent);
      window.removeEventListener('pageshow', handlePageShow);

      if (authChannel) {
        authChannel.removeEventListener('message', handleChannelMessage);
      }
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [navigate, isLoggingOut, handleBroadcastLogout]);

  // ───────────────────────────────────────────────────────────
  // Context value (expose isLoggingOut to route guards)
  // ───────────────────────────────────────────────────────────
  const value = {
    user,
    isAuthenticated: !!user,
    authLoading,
    isLoggingOut, // ← Critical for preventing /403 redirect during logout
    login,
    logout,
    updateUser,
  };

  // ───────────────────────────────────────────────────────────
  // Render loading state or children
  // ───────────────────────────────────────────────────────────

  return (
    <AuthContext.Provider value={value}>
      {authLoading ? (
        <LoadingAnimation text="....." />
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};

export default AuthContext;