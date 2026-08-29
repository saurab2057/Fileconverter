// src/services/authService.js
import apiClient from '@/lib/api';

export const authService = {
  /**
   * Login with email and password.
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
   * Fetch a one-time CSRF `state` token before starting Google OAuth.
   * Backend stores the matching value in an httpOnly cookie
   * (see authController.js googleAuthInit) and verifies it on
   * /google/callback before completing the login. Call this on
   * mount of the Login/Signup page, before the user can click
   * "Continue with Google".
   * @returns {Promise} - { state }
   */
// In authService.js
export const getGoogleOauthState = async () => {
  const response = await axios.get('/api/auth/google/init', {
    withCredentials: true,  // ✅ THIS IS THE KEY
  });
  return response.data;
};

  /**
   * Send forgot password email.
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
   * Validate password reset token.
   * @param {string} token - Reset token from email link
   * @returns {Promise} - { valid, redirectUrl }
   */
  validateResetToken: async (token) => {
    const { data } = await apiClient.post('/api/auth/validate-reset-token', { token });
    return data;
  },

  /**
   * Reset password with new password.
   * @param {string} newPassword - New password
   * @returns {Promise} - { message }
   */
  resetPassword: async (newPassword) => {
    const { data } = await apiClient.post('/api/auth/reset-password', { newPassword });
    return data;
  },

  /**
   * Refresh access token using http-only cookie.
   * @returns {Promise} - { accessToken, user }
   */
  refreshToken: async () => {
    const { data } = await apiClient.post('/api/auth/refresh-token');
    return data;
  },

  /**
   * Logout current session.
   * @returns {Promise}
   */
  logout: async () => {
    await apiClient.post('/api/auth/logout');
  },

  /**
   * Logout all devices.
   * @returns {Promise}
   */
  logoutAll: async () => {
    await apiClient.post('/api/auth/logout-all');
  },

  /**
   * Get active sessions.
   * @returns {Promise} - { sessions }
   */
  getSessions: async () => {
    const { data } = await apiClient.get('/api/auth/sessions');
    return data;
  },

  /**
   * Revoke a specific session.
   * @param {string} sessionId - Session ID to revoke
   * @returns {Promise}
   */
  revokeSession: async (sessionId) => {
    await apiClient.delete(`/api/auth/sessions/${sessionId}`);
  },

  /**
   * Change password (authenticated user).
   * @param {Object} passwords - { currentPassword, newPassword }
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
   * Update user profile.
   * @param {Object|FormData} payload - Profile data (can be FormData for file upload)
   * @returns {Promise} - { message, user }
   */
  updateProfile: async (payload) => {
    const { data } = await apiClient.put('/api/user/profile', payload);
    return data;
  },
};

export default authService;
