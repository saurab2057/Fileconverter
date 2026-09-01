// src/hooks/useGoogleAuth.js
import { useState, useCallback } from 'react';
import { API_BASE_URL } from '../lib/constants';

export const useGoogleAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const handleGoogleClick = useCallback(() => {
    setIsLoading(true);
    window.location.href = `${API_BASE_URL}/api/auth/google/init`;
  }, []);
  return { handleGoogleClick, isLoading };
};
export default useGoogleAuth;
