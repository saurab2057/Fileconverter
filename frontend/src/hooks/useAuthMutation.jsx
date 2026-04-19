// src/hooks/useAuthMutation.js
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import apiClient from '@/lib/api';

/**
 * Generic auth mutation hook.
 * @param {string} endpoint - API endpoint (e.g., '/api/auth/login')
 * @param {Object} options - Additional options
 * @returns {Object} - Mutation object with mutate, isLoading, error
 */
export const useAuthMutation = (endpoint, options = {}) => {
  const { login, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await apiClient.post(endpoint, payload);
      return data;
    },
    onSuccess: (data, variables) => {
      // Handle login/signup/google auth responses
      if (data.accessToken && data.user) {
        login(data.accessToken, data.user);
        const redirectTo = data.user.role === 'admin' ? '/admin' : '/';
        navigate(redirectTo, { replace: true });
      }

      // Handle signup success (no auto-login)
      if (endpoint === '/api/auth/signup') {
        navigate('/login', { replace: true });
      }

      // Handle logout
      if (endpoint === '/api/auth/logout') {
        logout(false);
      }

      // Handle password change (requires re-login)
      if (endpoint === '/api/user/change-password') {
        setTimeout(() => logout(), 1500);
      }

      // Invalidate relevant queries
      if (endpoint === '/api/user/profile') {
        queryClient.invalidateQueries({ queryKey: ['user'] });
      }

      options.onSuccess?.(data, variables);
    },
    onError: (error, variables) => {
      console.error(`Auth mutation error [${endpoint}]:`, error);
      options.onError?.(error, variables);
    },
  });
};

export default useAuthMutation;