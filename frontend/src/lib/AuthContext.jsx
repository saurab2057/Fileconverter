// src/lib/AuthContext.jsx
import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient, { session, refreshWithLock } from '@/lib/api'; // CHANGED: import refreshWithLock
import { authService } from '@/services/authService';
import NotFound from '@/components/common/NotFound';

// ─────────────────────────────────────────────────────────────
// Constants — module-level is fine for plain strings.
// AUTH_CHANNEL_NAME: the shared name both tabs use to find each
//   other's BroadcastChannel. Must match across the app.
// STORAGE_LOGOUT_KEY: localStorage key used as a fallback signal
//   for browsers that don't support BroadcastChannel (e.g. Safari
//   versions below 15.4).
// ─────────────────────────────────────────────────────────────
const AUTH_CHANNEL_NAME = 'auth-sync';
const STORAGE_LOGOUT_KEY = 'auth-logout-broadcast';

// ─────────────────────────────────────────────────────────────
// React Context — null default forces consumers to be wrapped
// inside AuthProvider (caught by the useAuth guard below).
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
export const AuthProvider = ({ children, loadingFallback = null }) => {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [serviceUnavailable, setServiceUnavailable] = useState(false);
  const navigate = useNavigate();

  // ───────────────────────────────────────────────────────────
  // channelRef — owns the BroadcastChannel instance.
  //
  // WHY useRef and not a module-level const:
  //   A module-level const is created once when the file is
  //   imported and shared for the entire page lifetime. The
  //   cleanup effect below calls .close() on unmount, which
  //   permanently kills that shared instance — it cannot be
  //   reopened. If AuthProvider ever remounts (e.g. during
  //   future refactors, route changes, or testing), the channel
  //   would be dead and cross-tab logout sync would silently stop
  //   working.
  //
  //   A useRef creates the channel tied to this component
  //   instance. If AuthProvider unmounts, the channel is closed.
  //   If it remounts, a fresh channel is created. Each mount
  //   owns exactly one live channel.
  //
  // WHY NOT useState:
  //   We don't need a re-render when the channel is created.
  //   The channel is an imperative resource, not UI state.
  // ───────────────────────────────────────────────────────────
  const channelRef = useRef(null);

  // Tracks the timestamp of the last processed broadcast so we
  // can debounce duplicate LOGOUT messages arriving within 1 s
  // (e.g. the tab that triggered logout receiving its own echo).
  const lastBroadcastRef = useRef(0);

  // ───────────────────────────────────────────────────────────
  // BroadcastChannel lifecycle — create on mount, close on unmount.
  //
  // Runs once (empty dep array). On mount it creates a fresh
  // channel and stores it in channelRef.current. On unmount the
  // cleanup closes it and nulls the ref so no stale reference
  // lingers after the component is gone.
  //
  // The typeof guard handles environments where BroadcastChannel
  // is undefined (older Safari, some SSR contexts). Those fall
  // through to the localStorage fallback in broadcastLogout.
  // ───────────────────────────────────────────────────────────
  useEffect(() => {
    channelRef.current = typeof BroadcastChannel !== 'undefined'
      ? new BroadcastChannel(AUTH_CHANNEL_NAME)
      : null;

    return () => {
      channelRef.current?.close();
      channelRef.current = null;
    };
  }, []);

  // ───────────────────────────────────────────────────────────
  // broadcastLogout — tells every other tab to log out.
  //
  // Primary path: BroadcastChannel.postMessage — fast, same-
  //   origin, no storage quota used.
  // Fallback path: write + immediately remove a localStorage key.
  //   Other tabs receive the 'storage' event even though the key
  //   is gone; the newValue in the event holds the JSON payload.
  //
  // Called BEFORE clearing local state so other tabs receive the
  // message while the channel is still open.
  // ───────────────────────────────────────────────────────────
  const broadcastLogout = useCallback(() => {
    const payload = { type: 'LOGOUT', timestamp: Date.now() };

    if (channelRef.current) {
      // BroadcastChannel does NOT fire in the tab that called
      // postMessage, so this tab's own logout is handled
      // separately by the explicit logout() function below.
      channelRef.current.postMessage(payload);
    } else {
      // Fallback for browsers without BroadcastChannel support.
      // Setting then immediately removing the key triggers the
      // 'storage' event in other tabs without leaving stale data.
      try {
        localStorage.setItem(STORAGE_LOGOUT_KEY, JSON.stringify(payload));
        localStorage.removeItem(STORAGE_LOGOUT_KEY);
      } catch (err) {
        console.warn('BroadcastChannel fallback failed:', err);
      }
    }
  }, []); // channelRef is a ref — stable, never needs to be a dep

  // ───────────────────────────────────────────────────────────
  // handleBroadcastLogout — reacts to a LOGOUT message sent by
  // another tab via BroadcastChannel or the localStorage fallback.
  //
  // Guards in order:
  //   1. isLoggingOut  — this tab is already mid-logout; ignore.
  //   2. Stale check   — message older than 5 s; probably a page
  //                      reload picking up a leftover event.
  //   3. Debounce      — same message processed within 1 s; the
  //                      BroadcastChannel and localStorage paths
  //                      can both fire for the same logout event
  //                      on some browsers.
  //
  // Does NOT call authService.logout() — the tab that initiated
  // the logout already did that. This tab only needs to clear its
  // own client state.
  // ───────────────────────────────────────────────────────────
  const handleBroadcastLogout = useCallback((payload) => {
    if (isLoggingOut) return;
    if (Date.now() - payload.timestamp > 5000) return;
    if (Date.now() - lastBroadcastRef.current < 1000) return;

    lastBroadcastRef.current = Date.now();

    session.clearToken();
    setUser(null);
    setAuthLoading(false);
    navigate('/', { replace: true });
  }, [navigate, isLoggingOut]);

  // ───────────────────────────────────────────────────────────
  // logout — the authoritative logout for THIS tab.
  //
  // Order matters:
  //   1. broadcastLogout()    — tell other tabs first, while the
  //                             channel is still open and the
  //                             access token is still set.
  //   2. Clear client state   — wipe token + user synchronously
  //                             so no further authenticated
  //                             requests can fire from this tab.
  //   3. Navigate to home     — do this AFTER state is clear to
  //                             prevent AdminRoute from reading
  //                             stale user state and flashing a
  //                             /403 redirect.
  //   4. Server logout        — fire-and-forget. The client is
  //                             already logged out; a network
  //                             failure here is non-critical.
  //
  // shouldNotifyServer = false is used by handleBroadcastLogout's
  // callers when the server was already notified by the other tab.
  // ───────────────────────────────────────────────────────────
  const logout = useCallback(async (shouldNotifyServer = true) => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);

    broadcastLogout();

    session.clearToken();
    setUser(null);
    setAuthLoading(false);

    navigate('/', { replace: true });

    if (shouldNotifyServer) {
      authService.logout().catch((err) => {
        console.warn('Server logout failed (client already cleared):', err);
      });
    }

    // Give navigation time to settle before re-enabling the guard,
    // so rapid clicks don't trigger a second logout attempt.
    setTimeout(() => setIsLoggingOut(false), 1000);

  }, [navigate, isLoggingOut, broadcastLogout]);

  // ───────────────────────────────────────────────────────────
  // login — called after any successful authentication.
  // Stores the short-lived access token in the in-memory session
  // object (never in localStorage) and saves the user payload to
  // React state so the whole tree re-renders as authenticated.
  // ───────────────────────────────────────────────────────────
  const login = useCallback((token, userData) => {
    session.setToken(token);
    setUser(userData);
  }, []);

  // ───────────────────────────────────────────────────────────
  // updateUser — patches the user object in context without
  // a full re-authentication. Used after profile edits so the
  // navbar/avatar reflects the new data immediately.
  // ───────────────────────────────────────────────────────────
  const updateUser = useCallback((newUserData) => {
    setUser(newUserData);
  }, []);

  // ───────────────────────────────────────────────────────────
  // Auth initialisation — runs once on mount.
  //
  // WHY CALL /refresh-token DIRECTLY:
  //   Previously, we called /api/user/profile and relied on the
  //   Axios interceptor to catch the 401, refresh the token, and
  //   retry. This guaranteed a visible 401 error in the network
  //   tab on every hard reload, wasting a full round-trip.
  //
  // NEW FLOW:
  //   1. Call refreshWithLock() (validates the httpOnly cookie).
  //   2. The backend checks the database for user status (banned/active).
  //   3. On success, we receive { accessToken, user } in a single response.
  //   4. Store the token and user state.
  //   5. If it fails (no cookie, banned, expired), we clear local state.
  //   This eliminates the 401 error entirely and speeds up initial load.
  //
  // CHANGED: uses refreshWithLock() instead of authService.refreshToken()
  //   directly. If this tab and another tab of the same site both load
  //   at the same time (e.g. two tabs restored together, or opened
  //   within the same instant), both would otherwise race to call
  //   /api/auth/refresh-token with the same not-yet-rotated cookie —
  //   which trips the backend's reuse-detection and wipes every
  //   session for the user (see the big comment in api.js above
  //   refreshWithLock() for the full explanation). Routing through
  //   the lock serializes these calls across tabs so only one hits
  //   the network at a time.
  // ───────────────────────────────────────────────────────────
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { accessToken, user: userData } = await refreshWithLock();
        session.setToken(accessToken);
        setUser(userData);
      } catch (error) {
        // Clear local state on any auth failure
        session.clearToken();
        setUser(null);

        // If the backend is down (no response or 5xx), show the service unavailable page
        if (!error.response || error.response.status >= 500) {
          setServiceUnavailable(true);
        }
      } finally {
        setAuthLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // ───────────────────────────────────────────────────────────
  // Global event listeners
  //
  // Re-registers whenever navigate, isLoggingOut, or
  // handleBroadcastLogout change so the callbacks always close
  // over the latest values. The cleanup removes the previous set
  // before the next set is added, preventing duplicate handlers.
  //
  // Events handled:
  //
  //   'session-refreshed'  — fired by the Axios response
  //     interceptor after a silent token refresh succeeds.
  //     Updates the user object so stale data (e.g. name change
  //     made in another tab) is reflected here.
  //
  //   'logout-event'  — safety net fired by the Axios interceptor
  //     when a token refresh fails (e.g. refresh token expired or
  //     server returns 403). Clears state and redirects to /login
  //     unless the user is already on a public route.
  //
  //   'pageshow' (persisted)  — fires when the browser restores a
  //     page from the back/forward cache (bfcache). The cached
  //     page may have an expired access token. We proactively
  //     call refreshWithLock() to avoid a 401 error on the next
  //     API call. This also updates the UI (avatar, name) in
  //     case the user changed their profile in another tab.
  //
  //   BroadcastChannel 'message'  — LOGOUT from another tab.
  //     Delegates to handleBroadcastLogout.
  //
  //   'storage'  — localStorage fallback for browsers without
  //     BroadcastChannel support. Same logic as above.
  // ───────────────────────────────────────────────────────────
  useEffect(() => {
    const handleSessionRefreshed = (event) => {
      setUser(event.detail);
    };

    const handleLogoutEvent = () => {
      if (isLoggingOut) return;

      // Don't double-handle a logout that was already processed
      // via the BroadcastChannel path (within the last 2 s).
      if (Date.now() - lastBroadcastRef.current < 2000) return;

      session.clearToken();
      setUser(null);
      setAuthLoading(false);

      // startsWith('/error') already covers /error/403, /error/500,
      // /error/503 — no need to list them individually.
      const publicRoutes = ['/', '/login', '/signup', '/403', '/503', '/error'];
      const isOnPublicRoute = publicRoutes.some(route =>
        window.location.pathname.startsWith(route)
      );

      if (!isOnPublicRoute) {
        navigate('/login', { replace: true });
      }
    };

    const handlePageShow = (event) => {
      if (event.persisted) {
        // If the page is restored from bfcache, the access token might be expired.
        // Proactively refresh it now to avoid a 401 on the next API call.
        // Since refresh returns the user, we can update the context immediately.
        //
        // CHANGED: uses refreshWithLock() instead of authService.refreshToken()
        // directly, for the same cross-tab race reason as initializeAuth above —
        // a bfcache restore in one tab can coincide with another tab refreshing
        // at the same moment.
        refreshWithLock()
          .then(({ accessToken, user: freshUser }) => {
            session.setToken(accessToken);
            setUser(freshUser); // Update UI with fresh user data
          })
          .catch(() => {
            session.clearToken();
            setUser(null);
            setAuthLoading(false);
          });
      }
    };

    const handleChannelMessage = (event) => {
      if (event.data?.type === 'LOGOUT') {
        handleBroadcastLogout(event.data);
      }
    };

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

    window.addEventListener('session-refreshed', handleSessionRefreshed);
    window.addEventListener('logout-event', handleLogoutEvent);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('storage', handleStorageEvent);

    // channelRef.current is set by the channel-lifecycle effect above.
    // Both effects use [] / stable deps, so the channel is always ready
    // before this effect runs in the same synchronous mount cycle.
    if (channelRef.current) {
      channelRef.current.addEventListener('message', handleChannelMessage);
    }

    return () => {
      window.removeEventListener('session-refreshed', handleSessionRefreshed);
      window.removeEventListener('logout-event', handleLogoutEvent);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('storage', handleStorageEvent);

      if (channelRef.current) {
        channelRef.current.removeEventListener('message', handleChannelMessage);
      }
    };
  }, [navigate, isLoggingOut, handleBroadcastLogout]);

  // ───────────────────────────────────────────────────────────
  // Context value
  //
  // isLoggingOut is exposed so route guards (AdminRoute,
  // ProtectedRoute) can distinguish "user is in the middle of
  // logging out" from "user is not authenticated", preventing a
  // spurious /403 redirect during the logout animation window.
  // ───────────────────────────────────────────────────────────
  const value = {
    user,
    isAuthenticated: !!user,
    authLoading,
    isLoggingOut,
    login,
    logout,
    updateUser,
  };

  // authLoading is true only during the initial refresh-token
  // check on first mount. Once resolved (success or failure) it
  // never goes back to true, so the loading screen shows exactly
  // once per page load.
  if (serviceUnavailable) {
    return <NotFound errorCode={503} />;
  }

  if (authLoading) {
    return loadingFallback;
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
