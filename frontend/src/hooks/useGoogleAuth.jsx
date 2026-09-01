// src/hooks/useGoogleAuth.js
import { useState, useCallback } from 'react';

/**
 * Kicks off Google OAuth with a real top-level navigation.
 *
 * IMPORTANT: this must NOT fetch the backend first and then navigate.
 * Fetching /api/auth/google/init as a background XHR sets the
 * oauth_state cookie in a cross-site (third-party) context, which
 * gets blocked or wiped by the browser before the callback ever
 * sees it. Navigating the browser directly to the backend route
 * lets the backend set the cookie during an actual top-level
 * redirect chain, and build + redirect to the Google URL itself.
 */
export const useGoogleAuth = () => {
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleClick = useCallback(() => {
    setIsLoading(true);
    window.location.href = `${import.meta.env.VITE_API_BASE_URL}/api/auth/google/init`;
  }, []);

  return { handleGoogleClick, isLoading };
};

export default useGoogleAuth;
