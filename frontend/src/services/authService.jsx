// src/services/authService.js

import apiClient from '@/lib/api';

/**
 * AuthService – handles all authentication-related API calls.
 * All methods use the pre-configured `apiClient` which:
 *   - Has baseURL set to the backend (e.g., https://backend-kijk.onrender.com)
 *   - Includes credentials (withCredentials: true) for cross-domain cookie handling
 */
export const authService = {
  /**
   * Login with email and password.
   * @param {Object} credentials - { email, password, recaptchaToken }
   * @returns {Promise} - { accessToken, user }
   */
  login: async (credentials) => {
    const { data } = await apiClient.post('/api/auth/login', {
      email: credentials.email,
      password: credentials.password,
      'recaptcha-token': credentials.recaptchaToken,
    });
    return data;
  },

  /**
   * Register a new user.
   * @param {Object} userData - { name, email, password, confirmPassword, recaptchaToken }
   * @returns {Promise} - { message }
   */
  signup: async (userData) => {
    const { data } = await apiClient.post('/api/auth/signup', {
      name: userData.name,
      email: userData.email,
      password: userData.password,
      confirmPassword: userData.confirmPassword,
      'recaptcha-token': userData.recaptchaToken,
    });
    return data;
  },

  /**
   * Fetch a one-time CSRF `state` token for Google OAuth.
   *
   * WHY THIS IS CRITICAL:
   *   - The backend sets an `oauth_state` httpOnly cookie when this endpoint is called.
   *   - That cookie must be stored on the SAME DOMAIN as your backend
   *     (because Google will redirect directly to your backend's callback URL).
   *   - Using `apiClient` ensures the request goes directly to the backend domain
   *     (not through a frontend proxy), so the cookie is set on the backend domain.
   *
   * Without this, the cookie would be set on the frontend domain, and the
   * callback request (which goes to the backend domain) would not receive it,
   * causing state mismatch errors.
   *
   * @returns {Promise<{ state: string }>}
   */
  getGoogleOauthState: async () => {
    const { data } = await apiClient.get('/api/auth/google/init');
    return data;
  },

  /**
   * Request a password reset email.
   * @param {string} email - User's registered email
   * @param {string} recaptchaToken - reCAPTCHA token
   * @returns {Promise} - { message }
   */
  forgotPassword: async (email, recaptchaToken) => {
    const { data } = await apiClient.post('/api/auth/forgot-password', {
      email,
      'recaptcha-token': recaptchaToken,
    });
    return data;
  },

  /**
   * Validate a password reset token (sent via email link).
   * @param {string} token - The reset token from the URL
   * @returns {Promise} - { valid, redirectUrl }
   */
  validateResetToken: async (token) => {
    const { data } = await apiClient.post('/api/auth/validate-reset-token', { token });
    return data;
  },

  /**
   * Reset password using the new password.
   * @param {string} newPassword - New password
   * @returns {Promise} - { message }
   */
  resetPassword: async (newPassword) => {
    const { data } = await apiClient.post('/api/auth/reset-password', { newPassword });
    return data;
  },

  /**
   * Refresh the access token using the httpOnly refresh token cookie.
   * @returns {Promise} - { accessToken, user }
   */
  refreshToken: async () => {
    const { data } = await apiClient.post('/api/auth/refresh-token');
    return data;
  },

  /**
   * Logout the current session (clears the refresh cookie).
   * @returns {Promise}
   */
  logout: async () => {
    await apiClient.post('/api/auth/logout');
  },

  /**
   * Logout all active devices (revokes all refresh tokens).
   * @returns {Promise}
   */
  logoutAll: async () => {
    await apiClient.post('/api/auth/logout-all');
  },

  /**
   * Get a list of all active sessions for the current user.
   * @returns {Promise<{ sessions: Array }>}
   */
  getSessions: async () => {
    const { data } = await apiClient.get('/api/auth/sessions');
    return data;
  },

  /**
   * Revoke a specific session by its ID.
   * @param {string} sessionId - Session ID to revoke
   * @returns {Promise}
   */
  revokeSession: async (sessionId) => {
    await apiClient.delete(`/api/auth/sessions/${sessionId}`);
  },

  /**
   * Change the password for the authenticated user.
   * @param {Object} passwords - { currentPassword, newPassword, confirmNewPassword }
   * @returns {Promise} - { message, logoutRequired }
   */
  changePassword: async (passwords) => {
    const { data } = await apiClient.post('/api/user/change-password', {
      currentPassword: passwords.currentPassword,
      newPassword: passwords.newPassword,
      confirmNewPassword: passwords.confirmNewPassword,
    });
    return data;
  },

  /**
   * Update user profile (e.g., name, avatar).
   * Accepts either a plain object or FormData (for file uploads).
   * @param {Object|FormData} payload - Profile data
   * @returns {Promise} - { message, user }
   */
  updateProfile: async (payload) => {
    const { data } = await apiClient.put('/api/user/profile', payload);
    return data;
  },
};

export default authService;
