// src/hooks/useGoogleAuth.js
import { useState, useCallback } from 'react';
import { authService } from '@/services/authService';
import { GOOGLE_REDIRECT_URI, GOOGLE_CLIENT_ID } from '@/lib/constants';
import { useToast } from '@/context/ToastContext';

export const useGoogleAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

  // The function to attach to the button's onClick
  const handleGoogleClick = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch the CSRF state token ONLY when the user clicks the button
      const { state } = await authService.getGoogleOauthState();
      
      // 2. Manually construct the Google OAuth URL with the fresh state
      // This bypasses the @react-oauth/google library's broken redirect mode
      const scope = encodeURIComponent('openid email profile');
      const googleAuthUrl = 
        `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${GOOGLE_CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(GOOGLE_REDIRECT_URI)}&` +
        `response_type=code&` +
        `scope=${scope}&` +
        `state=${state}&` +
        `access_type=offline&` +
        `prompt=select_account`;

      // 3. Redirect the browser directly to Google
      window.location.href = googleAuthUrl;
      
    } catch (err) {
      console.error('[Google Auth] Failed to initialize:', err);
      toast.error('Could not initialize Google login. Please try again.');
      setIsLoading(false);
    }
  }, [toast]);

  return { handleGoogleClick, isLoading };
};
