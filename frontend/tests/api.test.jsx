// tests/api.test.jsx

import axios from 'axios';
import apiClient, {
  session,
  refreshWithLock,
} from '@/lib/api';

// Capture the interceptor callbacks registered when api.js
// creates the Axios client. These are captured before clearAllMocks()
// removes the recorded mock calls.
const requestSuccessInterceptor =
  apiClient.interceptors.request.use.mock.calls[0][0];

const requestErrorInterceptor =
  apiClient.interceptors.request.use.mock.calls[0][1];

const responseSuccessInterceptor =
  apiClient.interceptors.response.use.mock.calls[0][0];

const responseErrorInterceptor =
  apiClient.interceptors.response.use.mock.calls[0][1];

// Capture the configuration passed to axios.create().
const axiosCreateConfig =
  axios.create.mock.calls[0][0];

describe('api.js', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    session.clearToken();

    // Keep each test on a harmless application route.
    window.history.replaceState({}, '', '/dashboard');

    // Reset navigator.locks after tests that use it.
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: undefined,
    });
  });

  describe('Axios configuration', () => {
    it('should create Axios client with the correct configuration', () => {
      expect(axiosCreateConfig).toEqual(
        expect.objectContaining({
          baseURL: 'http://localhost:5000',
          withCredentials: true,
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json',
          },
        })
      );
    });

    it('should register a request interceptor', () => {
      expect(requestSuccessInterceptor).toEqual(
        expect.any(Function)
      );

      expect(requestErrorInterceptor).toEqual(
        expect.any(Function)
      );
    });

    it('should register a response interceptor', () => {
      expect(responseSuccessInterceptor).toEqual(
        expect.any(Function)
      );

      expect(responseErrorInterceptor).toEqual(
        expect.any(Function)
      );
    });
  });

  describe('Token Management', () => {
    it('should initially have no access token', () => {
      expect(session.getToken()).toBeNull();
      expect(session.accessToken).toBeNull();
    });

    it('should store and retrieve token', () => {
      session.setToken('test-token');

      expect(session.getToken()).toBe('test-token');
      expect(session.accessToken).toBe('test-token');
    });

    it('should replace an existing token', () => {
      session.setToken('first-token');
      session.setToken('second-token');

      expect(session.getToken()).toBe('second-token');
    });

    it('should clear token', () => {
      session.setToken('test-token');

      session.clearToken();

      expect(session.getToken()).toBeNull();
      expect(session.accessToken).toBeNull();
    });
  });

  describe('Request Interceptor', () => {
    it('should add Authorization header when a token exists', () => {
      session.setToken('test-access-token');

      const config = {
        headers: {},
      };

      const result = requestSuccessInterceptor(config);

      expect(result.headers.Authorization).toBe(
        'Bearer test-access-token'
      );
    });

    it('should not add Authorization header when no token exists', () => {
      session.clearToken();

      const config = {
        headers: {},
      };

      const result = requestSuccessInterceptor(config);

      expect(result.headers.Authorization).toBeUndefined();
    });

    it('should preserve existing request configuration', () => {
      session.setToken('test-token');

      const config = {
        url: '/api/test',
        method: 'GET',
        headers: {},
      };

      const result = requestSuccessInterceptor(config);

      expect(result.url).toBe('/api/test');
      expect(result.method).toBe('GET');
      expect(result.headers.Authorization).toBe(
        'Bearer test-token'
      );
    });

    it('should remove Content-Type for FormData requests', () => {
      session.setToken('test-token');

      const formData = new FormData();

      const config = {
        data: formData,
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const result = requestSuccessInterceptor(config);

      expect(
        result.headers['Content-Type']
      ).toBeUndefined();

      expect(result.headers.Authorization).toBe(
        'Bearer test-token'
      );
    });

    it('should reject request interceptor errors', async () => {
      const error = new Error('Request failed');

      await expect(
        requestErrorInterceptor(error)
      ).rejects.toBe(error);
    });
  });

  describe('Response Success Interceptor', () => {
    it('should return successful responses unchanged', () => {
      const response = {
        status: 200,
        data: {
          message: 'Success',
        },
      };

      expect(
        responseSuccessInterceptor(response)
      ).toBe(response);
    });
  });

  describe('refreshWithLock', () => {
    it('should refresh the token directly when Web Locks API is unavailable', async () => {
      const response = {
        data: {
          accessToken: 'new-token',
          user: {
            id: 'user-1',
          },
        },
      };

      apiClient.post.mockResolvedValueOnce(response);

      const result = await refreshWithLock();

      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/auth/refresh-token'
      );

      expect(result).toEqual(response.data);
    });

    it('should use Web Locks API when available', async () => {
      const response = {
        data: {
          accessToken: 'locked-token',
          user: {
            id: 'user-1',
          },
        },
      };

      apiClient.post.mockResolvedValueOnce(response);

      const lockRequest = jest.fn(
        async (lockName, callback) => {
          expect(lockName).toBe('auth-refresh-lock');
          return callback();
        }
      );

      Object.defineProperty(navigator, 'locks', {
        configurable: true,
        value: {
          request: lockRequest,
        },
      });

      const result = await refreshWithLock();

      expect(lockRequest).toHaveBeenCalledWith(
        'auth-refresh-lock',
        expect.any(Function)
      );

      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/auth/refresh-token'
      );

      expect(result).toEqual(response.data);
    });

    it('should propagate refresh errors', async () => {
      const error = new Error('Refresh failed');

      apiClient.post.mockRejectedValueOnce(error);

      await expect(
        refreshWithLock()
      ).rejects.toBe(error);
    });
  });

  describe('401 Response Handling', () => {
    it('should refresh the session after a 401 response', async () => {
      session.setToken('old-token');

      apiClient.post.mockResolvedValueOnce({
        data: {
          accessToken: 'new-token',
          user: {
            id: 'user-1',
          },
        },
      });

      apiClient.mockResolvedValueOnce({
        data: {
          message: 'Retried successfully',
        },
      });

      const originalRequest = {
        url: '/api/user/profile',
        method: 'GET',
        headers: {},
      };

      const error = {
        response: {
          status: 401,
        },
        config: originalRequest,
      };

      const refreshedEvent = jest.fn();

      window.addEventListener(
        'session-refreshed',
        refreshedEvent
      );

      const result = await responseErrorInterceptor(error);

      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/auth/refresh-token'
      );

      expect(session.getToken()).toBe('new-token');

      expect(refreshedEvent).toHaveBeenCalled();

      expect(apiClient).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/api/user/profile',
          _retry: true,
        })
      );

      expect(result).toEqual({
        data: {
          message: 'Retried successfully',
        },
      });

      window.removeEventListener(
        'session-refreshed',
        refreshedEvent
      );
    });

    it('should not retry the same request twice', async () => {
      const originalRequest = {
        url: '/api/user/profile',
        _retry: true,
      };

      const error = {
        response: {
          status: 401,
        },
        config: originalRequest,
      };

      await expect(
        responseErrorInterceptor(error)
      ).rejects.toBe(error);

      expect(apiClient.post).not.toHaveBeenCalled();
    });

    it('should skip refresh for the refresh-token endpoint', async () => {
      const originalRequest = {
        url: '/api/auth/refresh-token',
      };

      const error = {
        response: {
          status: 401,
        },
        config: originalRequest,
      };

      await expect(
        responseErrorInterceptor(error)
      ).rejects.toBe(error);

      expect(apiClient.post).not.toHaveBeenCalled();
    });

    it('should skip refresh for the login endpoint', async () => {
      const originalRequest = {
        url: '/api/auth/login',
      };

      const error = {
        response: {
          status: 401,
        },
        config: originalRequest,
      };

      await expect(
        responseErrorInterceptor(error)
      ).rejects.toBe(error);

      expect(apiClient.post).not.toHaveBeenCalled();
    });

    it('should skip refresh for the signup endpoint', async () => {
      const originalRequest = {
        url: '/api/auth/signup',
      };

      const error = {
        response: {
          status: 401,
        },
        config: originalRequest,
      };

      await expect(
        responseErrorInterceptor(error)
      ).rejects.toBe(error);

      expect(apiClient.post).not.toHaveBeenCalled();
    });

    it('should skip refresh for the logout endpoint', async () => {
      const originalRequest = {
        url: '/api/auth/logout',
      };

      const error = {
        response: {
          status: 401,
        },
        config: originalRequest,
      };

      await expect(
        responseErrorInterceptor(error)
      ).rejects.toBe(error);

      expect(apiClient.post).not.toHaveBeenCalled();
    });

    it('should skip refresh for forgot-password', async () => {
      const originalRequest = {
        url: '/api/auth/forgot-password',
      };

      const error = {
        response: {
          status: 401,
        },
        config: originalRequest,
      };

      await expect(
        responseErrorInterceptor(error)
      ).rejects.toBe(error);

      expect(apiClient.post).not.toHaveBeenCalled();
    });

    it('should skip refresh for reset-password', async () => {
      const originalRequest = {
        url: '/api/auth/reset-password',
      };

      const error = {
        response: {
          status: 401,
        },
        config: originalRequest,
      };

      await expect(
        responseErrorInterceptor(error)
      ).rejects.toBe(error);

      expect(apiClient.post).not.toHaveBeenCalled();
    });
  });

  describe('403 Response Handling', () => {
    it('should reject a 403 response', async () => {
      const consoleWarnSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => {});

      const error = {
        response: {
          status: 403,
          data: {
            message: 'Access denied',
          },
        },
        config: {
          url: '/api/admin/users',
        },
      };

      await expect(
        responseErrorInterceptor(error)
      ).rejects.toBe(error);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Access forbidden:',
        'Access denied'
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('Server Error Handling', () => {
    it('should reject a 500 response for API endpoints that are excluded from redirect', async () => {
      const error = {
        response: {
          status: 500,
        },
        config: {
          url: '/api/chat',
        },
      };

      await expect(
        responseErrorInterceptor(error)
      ).rejects.toBe(error);
    });

    it('should reject a 503 response for API endpoints that are excluded from redirect', async () => {
      const error = {
        response: {
          status: 503,
        },
        config: {
          url: '/api/convert',
        },
      };

      await expect(
        responseErrorInterceptor(error)
      ).rejects.toBe(error);
    });
  });

  describe('General Error Handling', () => {
    it('should reject errors that are not 401, 403, 500, or 503', async () => {
      const error = {
        response: {
          status: 400,
          data: {
            message: 'Bad request',
          },
        },
        config: {
          url: '/api/test',
        },
      };

      await expect(
        responseErrorInterceptor(error)
      ).rejects.toBe(error);
    });
  });
});