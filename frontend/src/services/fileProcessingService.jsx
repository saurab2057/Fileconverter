// src/services/fileProcessingService.js
import apiClient from '@/lib/api';

/**
 * File processing service - handles conversion and compression API calls.
 */

export const fileProcessingService = {
  /**
   * Batch convert files.
   * @param {Array} files - Array of file objects with settings.
   * @param {string} toFormat - Target format.
   * @returns {Promise} - Array of results.
   */
  batchConvert: async (files, toFormat) => {
    const formData = new FormData();

    const settingsPayload = files.map(file => ({
      originalName: file.name,
      settings: file.settings,
    }));

    files.forEach(file => {
      formData.append('files', file.file, file.name);
    });

    formData.append('settings', JSON.stringify(settingsPayload));
    formData.append('toFormat', toFormat);

    const { data } = await apiClient.post('/api/convert/batch', formData);
    return data;
  },

  /**
   * Batch compress files.
   * @param {Array} files - Array of file objects with settings.
   * @returns {Promise} - Array of results.
   */
  batchCompress: async (files) => {
    const formData = new FormData();

    const settingsPayload = files.map(file => ({
      originalName: file.name,
      settings: file.settings,
    }));

    files.forEach(file => {
      formData.append('files', file.file, file.name);
    });

    formData.append('settings', JSON.stringify(settingsPayload));

    const { data } = await apiClient.post('/api/compress/batch', formData);
    return data;
  },

  /**
   * Summarize PDF or text.
   * @param {Object} payload - { text, pdf, max_pages }
   * @returns {Promise} - Summary string.
   */
  summarize: async (payload) => {
    const formData = new FormData();
    if (payload.text) {
      formData.append('text', payload.text);
    }
    if (payload.pdf) {
      formData.append('pdf', payload.pdf);
    }
    if (payload.max_pages) {
      formData.append('max_pages', payload.max_pages);
    }
    const { data } = await apiClient.post('/api/ai/summarize-pdf', formData);
    return data;
  },

  /**
   * Send chat message.
   * @param {string} message - User message.
   * @returns {Promise} - { reply }
   */
  sendChatMessage: async (message) => {
    const { data } = await apiClient.post('/api/chat', { message });
    return data;
  },

  /**
   * Get user file history.
   * @param {number} page - Page number.
   * @param {number} limit - Items per page.
   * @returns {Promise} - { history, total, page, limit, totalPages }
   */
  getHistory: async (page = 1, limit = 10) => {
    const { data } = await apiClient.get('/api/history', { params: { page, limit } });
    return data;
  },

  /**
   * Get user dashboard stats.
   * @returns {Promise} - { totalFiles, storageSaved, topFormat, weeklyActivity }
   */
  getDashboardStats: async () => {
    const { data } = await apiClient.get('/api/history/stats');
    return data;
  },
};

export default fileProcessingService;