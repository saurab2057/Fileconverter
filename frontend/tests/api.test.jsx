import apiClient, { session } from '@/lib/api';

describe('api.js', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    session.clearToken();
  });

  describe('Token Management', () => {
    it('should store and retrieve token', () => {
      session.setToken('test-token');

      expect(session.getToken()).toBe('test-token');
      expect(session.accessToken).toBe('test-token');
    });

    it('should clear token', () => {
      session.setToken('test-token');
      session.clearToken();

      expect(session.getToken()).toBeNull();
    });
  });
});