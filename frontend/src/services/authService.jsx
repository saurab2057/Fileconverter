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
   * @param {Object} credentials - { email, recaptchaToken }
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
   * Start email signup verification.
   *
   * Sends a 3-minute verification link to the supplied email.
   * No User account is created at this stage.
   *
   * @param {Object} signupData - { email, recaptchaToken }
   * @returns {Promise} - { message }
   */
  signupStart: async (signupData) => {
    const { data } = await apiClient.post('/api/auth/signup/start', {
      email: signupData.email,
      'recaptcha-token': signupData.recaptchaToken,
    });
    return data;
  },

  /**
   * Verify the email signup token.
   *
   * The backend consumes the one-time verification token and
   * creates the temporary 5-minute signup session cookie.
   *
   * @param {string} token - Verification token from email link
   * @returns {Promise} - { message }
   */
  verifySignupEmail: async (token) => {
    const { data } = await apiClient.post(
      '/api/auth/signup/verify-email',
      { token }
    );
    return data;
  },

  /**
   * Complete the email signup.
   *
   * The email is NOT sent by the frontend.
   * The backend derives the verified email from the
   * server-side signup_session cookie.
   *
   * @param {Object} signupData - { name, password, confirmPassword, termsAccepted }
   * @returns {Promise} - { message }
   */
  completeSignup: async (signupData) => {
    const { data } = await apiClient.post(
      '/api/auth/signup/complete',
      {
        name: signupData.name,
        password: signupData.password,
        confirmPassword: signupData.confirmPassword,
        termsAccepted: signupData.termsAccepted,
      }
    );
    return data;
  },

  /**
   * Resend the email signup verification link.
   *
   * @param {Object} signupData - { email, recaptchaToken }
   * @returns {Promise} - { message }
   */
  resendSignupVerification: async (signupData) => {
    const { data } = await apiClient.post(
      '/api/auth/signup/resend-verification',
      {
        email: signupData.email,
        'recaptcha-token': signupData.recaptchaToken,
      }
    );
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
    const { data } = await apiClient.post(
      '/api/auth/validate-reset-token',
      { token }
    );
    return data;
  },

  /**
   * Reset password using the new password.
   * @param {string} newPassword - New password
   * @returns {Promise} - { message }
   */
  resetPassword: async (newPassword) => {
    const { data } = await apiClient.post('/api/auth/reset-password', {
      newPassword,
    });
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
   * @param {string} sessionId - Session ID to revoke.
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