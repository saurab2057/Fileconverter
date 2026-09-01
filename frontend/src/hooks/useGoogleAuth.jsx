// src/hooks/useGoogleAuth.js
import { useState, useCallback } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { authService } from '@/services/authService';
import { GOOGLE_REDIRECT_URI } from '@/lib/constants';
import { useToast } from '@/context/ToastContext';

export const useGoogleAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

  // Initialize the Google login redirect flow (without state yet)
  const triggerGoogleRedirect = useGoogleLogin({
    flow: 'auth-code',
    ux_mode: 'redirect',
    redirect_uri: GOOGLE_REDIRECT_URI,
    onNonOAuthError: (error) => {
      console.error('[Google Auth] Non-OAuth error:', error);
      toast.error('Google authentication encountered an error.');
      setIsLoading(false);
    },
  });

  // The function to attach to the button's onClick
  const handleGoogleClick = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch the CSRF state token ONLY when the user clicks the button
      const { state } = await authService.getGoogleOauthState();
      
      // 2. Trigger the redirect, injecting the fresh state dynamically
      triggerGoogleRedirect({ state });
      
    } catch (err) {
      console.error('[Google Auth] Failed to initialize:', err);
      toast.error('Could not initialize Google login. Please try again.');
      setIsLoading(false);
    }
  }, [triggerGoogleRedirect, toast]);

  return { handleGoogleClick, isLoading };
};
