// tests/AuthContext.test.jsx

import React from 'react';
import {
  render,
  screen,
  waitFor,
  act,
  fireEvent,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  BrowserRouter,
  useLocation,
} from 'react-router-dom';

import {
  AuthProvider,
  useAuth,
} from '@/lib/AuthContext';

import apiClient, {
  session,
  refreshWithLock,
} from '@/lib/api';

import { authService } from '@/services/authService';


// ─────────────────────────────────────────────────────────────
// Mock authentication service.
//
// AuthContext only uses authService.logout() now.
// Token refresh is handled by refreshWithLock() from api.js.
// ─────────────────────────────────────────────────────────────
jest.mock('@/services/authService', () => ({
  authService: {
    logout: jest.fn(() => Promise.resolve({})),
  },
}));


// ─────────────────────────────────────────────────────────────
// Mock api.js.
//
// We keep AuthContext connected to the real component logic,
// but control the authentication/session functions used by it.
// ─────────────────────────────────────────────────────────────
jest.mock('@/lib/api', () => {
  const actual = jest.requireActual('@/lib/api');

  return {
    ...actual,

    session: {
      accessToken: null,

      setToken: jest.fn(function (token) {
        this.accessToken = token;
      }),

      clearToken: jest.fn(function () {
        this.accessToken = null;
      }),

      getToken: jest.fn(function () {
        return this.accessToken;
      }),
    },

    refreshWithLock: jest.fn(),
  };
});


// ─────────────────────────────────────────────────────────────
// Mock NotFound.
//
// The real NotFound component is unrelated to AuthContext logic.
// This makes the service-unavailable branch easy to test.
// ─────────────────────────────────────────────────────────────
jest.mock('@/components/common/NotFound', () => ({
  __esModule: true,

  default: ({ errorCode }) => (
    <div data-testid="not-found">
      Error {errorCode}
    </div>
  ),
}));


// ─────────────────────────────────────────────────────────────
// Test component.
//
// This exercises the public API exposed by AuthContext.
// ─────────────────────────────────────────────────────────────
const TestComponent = () => {
  const {
    user,
    isAuthenticated,
    login,
    logout,
    updateUser,
    authLoading,
    isLoggingOut,
  } = useAuth();

  return (
    <div>
      <div data-testid="loading">
        {authLoading ? 'Loading' : 'Loaded'}
      </div>

      <div data-testid="auth">
        {isAuthenticated ? 'Logged In' : 'Logged Out'}
      </div>

      <div data-testid="logging-out">
        {isLoggingOut ? 'Logging Out' : 'Not Logging Out'}
      </div>

      {user && (
        <>
          <div data-testid="user-email">
            {user.email}
          </div>

          <div data-testid="user-name">
            {user.name}
          </div>
        </>
      )}

      <button
        onClick={() =>
          login('fake-token', {
            email: 'test@test.com',
            name: 'Test User',
          })
        }
      >
        Login
      </button>

      <button
        onClick={() =>
          updateUser({
            email: 'updated@test.com',
            name: 'Updated User',
          })
        }
      >
        Update User
      </button>

      <button onClick={() => logout()}>
        Logout
      </button>
    </div>
  );
};


// ─────────────────────────────────────────────────────────────
// Helper component used to verify navigation.
// ─────────────────────────────────────────────────────────────
const LocationDisplay = () => {
  const location = useLocation();

  return (
    <div data-testid="location">
      {location.pathname}
    </div>
  );
};


// ─────────────────────────────────────────────────────────────
// BrowserRouter wrapper.
//
// Keeping routing in one helper makes the individual tests
// easier to read.
// ─────────────────────────────────────────────────────────────
const renderAuthProvider = () => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <TestComponent />
        <LocationDisplay />
      </AuthProvider>
    </BrowserRouter>
  );
};


describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    session.accessToken = null;

    // Default behavior: there is no valid refresh session.
    refreshWithLock.mockRejectedValue({
      response: {
        status: 401,
      },
    });

    authService.logout.mockResolvedValue({});

    // Reset browser location between tests.
    window.history.replaceState(
      {},
      '',
      '/'
    );
  });


  // ───────────────────────────────────────────────────────────
  // useAuth
  // ───────────────────────────────────────────────────────────
  describe('useAuth', () => {
    it('should throw an error when used outside AuthProvider', () => {
      expect(() =>
        render(<TestComponent />)
      ).toThrow(
        'useAuth must be used within an AuthProvider'
      );
    });
  });


  // ───────────────────────────────────────────────────────────
  // Initial authentication
  // ───────────────────────────────────────────────────────────
  describe('authentication initialization', () => {
    it('should render children after initial authentication check fails with 401', async () => {
      renderAuthProvider();

      await waitFor(() => {
        expect(
          screen.getByTestId('auth')
        ).toHaveTextContent('Logged Out');
      });

      expect(
        screen.getByTestId('loading')
      ).toHaveTextContent('Loaded');

      expect(refreshWithLock).toHaveBeenCalledTimes(1);
    });


    it('should authenticate the user when refresh succeeds', async () => {
      refreshWithLock.mockResolvedValueOnce({
        accessToken: 'new-access-token',
        user: {
          email: 'existing@test.com',
          name: 'Existing User',
        },
      });

      renderAuthProvider();

      await waitFor(() => {
        expect(
          screen.getByTestId('auth')
        ).toHaveTextContent('Logged In');
      });

      expect(
        screen.getByTestId('user-email')
      ).toHaveTextContent('existing@test.com');

      expect(
        screen.getByTestId('user-name')
      ).toHaveTextContent('Existing User');

      expect(
        screen.getByTestId('loading')
      ).toHaveTextContent('Loaded');

      expect(session.setToken).toHaveBeenCalledWith(
        'new-access-token'
      );
    });


    it('should clear authentication when refresh returns 401', async () => {
      refreshWithLock.mockRejectedValueOnce({
        response: {
          status: 401,
        },
      });

      renderAuthProvider();

      await waitFor(() => {
        expect(
          screen.getByTestId('auth')
        ).toHaveTextContent('Logged Out');
      });

      expect(session.clearToken).toHaveBeenCalled();
    });


    it('should show service unavailable page when backend has no response', async () => {
      refreshWithLock.mockRejectedValueOnce(
        new Error('Network Error')
      );

      renderAuthProvider();

      await waitFor(() => {
        expect(
          screen.getByTestId('not-found')
        ).toHaveTextContent('Error 503');
      });

      expect(
        screen.queryByTestId('auth')
      ).not.toBeInTheDocument();

      expect(session.clearToken).toHaveBeenCalled();
    });


    it('should show service unavailable page for a 500 response', async () => {
      refreshWithLock.mockRejectedValueOnce({
        response: {
          status: 500,
        },
      });

      renderAuthProvider();

      await waitFor(() => {
        expect(
          screen.getByTestId('not-found')
        ).toHaveTextContent('Error 503');
      });
    });


    it('should show service unavailable page for a 503 response', async () => {
      refreshWithLock.mockRejectedValueOnce({
        response: {
          status: 503,
        },
      });

      renderAuthProvider();

      await waitFor(() => {
        expect(
          screen.getByTestId('not-found')
        ).toHaveTextContent('Error 503');
      });
    });
  });


  // ───────────────────────────────────────────────────────────
  // login()
  // ───────────────────────────────────────────────────────────
  describe('login', () => {
    it('should authenticate the user and store the access token', async () => {
      const user = userEvent.setup();

      renderAuthProvider();

      await waitFor(() => {
        expect(
          screen.getByTestId('auth')
        ).toHaveTextContent('Logged Out');
      });

      await user.click(
        screen.getByRole('button', {
          name: 'Login',
        })
      );

      expect(
        screen.getByTestId('auth')
      ).toHaveTextContent('Logged In');

      expect(
        screen.getByTestId('user-email')
      ).toHaveTextContent('test@test.com');

      expect(
        screen.getByTestId('user-name')
      ).toHaveTextContent('Test User');

      expect(session.setToken).toHaveBeenCalledWith(
        'fake-token'
      );
    });
  });


  // ───────────────────────────────────────────────────────────
  // updateUser()
  // ───────────────────────────────────────────────────────────
  describe('updateUser', () => {
    it('should update the current user data', async () => {
      const user = userEvent.setup();

      renderAuthProvider();

      await waitFor(() => {
        expect(
          screen.getByTestId('auth')
        ).toHaveTextContent('Logged Out');
      });

      await user.click(
        screen.getByRole('button', {
          name: 'Login',
        })
      );

      expect(
        screen.getByTestId('user-email')
      ).toHaveTextContent('test@test.com');

      await user.click(
        screen.getByRole('button', {
          name: 'Update User',
        })
      );

      expect(
        screen.getByTestId('user-email')
      ).toHaveTextContent('updated@test.com');

      expect(
        screen.getByTestId('user-name')
      ).toHaveTextContent('Updated User');
    });
  });


  // ───────────────────────────────────────────────────────────
  // logout()
  // ───────────────────────────────────────────────────────────
  describe('logout', () => {
    it('should clear authentication state when logging out', async () => {
      const user = userEvent.setup();

      renderAuthProvider();

      await waitFor(() => {
        expect(
          screen.getByTestId('auth')
        ).toHaveTextContent('Logged Out');
      });

      await user.click(
        screen.getByRole('button', {
          name: 'Login',
        })
      );

      expect(
        screen.getByTestId('auth')
      ).toHaveTextContent('Logged In');

      await user.click(
        screen.getByRole('button', {
          name: 'Logout',
        })
      );

      expect(
        screen.getByTestId('auth')
      ).toHaveTextContent('Logged Out');

      expect(session.clearToken).toHaveBeenCalled();

      expect(authService.logout).toHaveBeenCalledTimes(1);
    });


    it('should navigate to the home page after logout', async () => {
      const user = userEvent.setup();

      renderAuthProvider();

      await waitFor(() => {
        expect(
          screen.getByTestId('auth')
        ).toHaveTextContent('Logged Out');
      });

      await user.click(
        screen.getByRole('button', {
          name: 'Login',
        })
      );

      await user.click(
        screen.getByRole('button', {
          name: 'Logout',
        })
      );

      await waitFor(() => {
        expect(
          screen.getByTestId('location')
        ).toHaveTextContent('/');
      });
    });


    it('should prevent duplicate logout calls while already logging out', async () => {
      const user = userEvent.setup();

      // Make server logout stay pending.
      let resolveLogout;

      authService.logout.mockImplementationOnce(
        () =>
          new Promise(resolve => {
            resolveLogout = resolve;
          })
      );

      renderAuthProvider();

      await waitFor(() => {
        expect(
          screen.getByTestId('auth')
        ).toHaveTextContent('Logged Out');
      });

      await user.click(
        screen.getByRole('button', {
          name: 'Login',
        })
      );

      await user.click(
        screen.getByRole('button', {
          name: 'Logout',
        })
      );

      expect(
        screen.getByTestId('logging-out')
      ).toHaveTextContent('Logging Out');

      // A second click should be ignored while isLoggingOut=true.
      await user.click(
        screen.getByRole('button', {
          name: 'Logout',
        })
      );

      expect(
        authService.logout
      ).toHaveBeenCalledTimes(1);

      resolveLogout?.();
    });


    it('should handle server logout failure without restoring client authentication', async () => {
      const consoleWarnSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => {});

      authService.logout.mockRejectedValueOnce(
        new Error('Server logout failed')
      );

      const user = userEvent.setup();

      renderAuthProvider();

      await waitFor(() => {
        expect(
          screen.getByTestId('auth')
        ).toHaveTextContent('Logged Out');
      });

      await user.click(
        screen.getByRole('button', {
          name: 'Login',
        })
      );

      await user.click(
        screen.getByRole('button', {
          name: 'Logout',
        })
      );

      await waitFor(() => {
        expect(
          screen.getByTestId('auth')
        ).toHaveTextContent('Logged Out');
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Server logout failed (client already cleared):',
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });
  });


  // ───────────────────────────────────────────────────────────
  // session-refreshed event
  // ───────────────────────────────────────────────────────────
  describe('session-refreshed event', () => {
    it('should update the user when session-refreshed is dispatched', async () => {
      renderAuthProvider();

      await waitFor(() => {
        expect(
          screen.getByTestId('auth')
        ).toHaveTextContent('Logged Out');
      });

      const refreshedUser = {
        email: 'refreshed@test.com',
        name: 'Refreshed User',
      };

      act(() => {
        window.dispatchEvent(
          new CustomEvent('session-refreshed', {
            detail: refreshedUser,
          })
        );
      });

      expect(
        screen.getByTestId('user-email')
      ).toHaveTextContent('refreshed@test.com');

      expect(
        screen.getByTestId('user-name')
      ).toHaveTextContent('Refreshed User');

      expect(
        screen.getByTestId('auth')
      ).toHaveTextContent('Logged In');
    });
  });


  // ───────────────────────────────────────────────────────────
  // BroadcastChannel
  // ───────────────────────────────────────────────────────────
  describe('BroadcastChannel logout', () => {
    it('should create a BroadcastChannel on mount', async () => {
      const addEventListener = jest.fn();
      const removeEventListener = jest.fn();
      const close = jest.fn();
      const postMessage = jest.fn();

      global.BroadcastChannel = jest.fn(() => ({
        addEventListener,
        removeEventListener,
        close,
        postMessage,
      }));

      renderAuthProvider();

      await waitFor(() => {
        expect(
          global.BroadcastChannel
        ).toHaveBeenCalledWith('auth-sync');
      });

      expect(addEventListener).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      );
    });


    it('should broadcast logout through BroadcastChannel', async () => {
      const postMessage = jest.fn();

      global.BroadcastChannel = jest.fn(() => ({
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        close: jest.fn(),
        postMessage,
      }));

      const user = userEvent.setup();

      renderAuthProvider();

      await waitFor(() => {
        expect(
          screen.getByTestId('auth')
        ).toHaveTextContent('Logged Out');
      });

      await user.click(
        screen.getByRole('button', {
          name: 'Login',
        })
      );

      await user.click(
        screen.getByRole('button', {
          name: 'Logout',
        })
      );

      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'LOGOUT',
          timestamp: expect.any(Number),
        })
      );
    });


    it('should close BroadcastChannel on unmount', async () => {
      const close = jest.fn();

      global.BroadcastChannel = jest.fn(() => ({
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        close,
        postMessage: jest.fn(),
      }));

      const { unmount } = renderAuthProvider();

      await waitFor(() => {
        expect(
          global.BroadcastChannel
        ).toHaveBeenCalled();
      });

      unmount();

      expect(close).toHaveBeenCalledTimes(1);
    });


    it('should process a logout message from another tab', async () => {
      const listeners = {};

      global.BroadcastChannel = jest.fn(() => ({
        addEventListener: jest.fn(
          (event, callback) => {
            listeners[event] = callback;
          }
        ),
        removeEventListener: jest.fn(),
        close: jest.fn(),
        postMessage: jest.fn(),
      }));

      const user = userEvent.setup();

      renderAuthProvider();

      await waitFor(() => {
        expect(
          screen.getByTestId('auth')
        ).toHaveTextContent('Logged Out');
      });

      await user.click(
        screen.getByRole('button', {
          name: 'Login',
        })
      );

      expect(
        screen.getByTestId('auth')
      ).toHaveTextContent('Logged In');

      act(() => {
        listeners.message({
          data: {
            type: 'LOGOUT',
            timestamp: Date.now(),
          },
        });
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('auth')
        ).toHaveTextContent('Logged Out');
      });

      expect(session.clearToken).toHaveBeenCalled();
    });
  });


  // ───────────────────────────────────────────────────────────
  // localStorage fallback
  // ───────────────────────────────────────────────────────────
  describe('localStorage logout fallback', () => {
    it('should broadcast logout through localStorage when BroadcastChannel is unavailable', async () => {
      global.BroadcastChannel = undefined;

      const setItemSpy = jest.spyOn(
        window.localStorage,
        'setItem'
      );

      const removeItemSpy = jest.spyOn(
        window.localStorage,
        'removeItem'
      );

      const user = userEvent.setup();

      renderAuthProvider();

      await waitFor(() => {
        expect(
          screen.getByTestId('auth')
        ).toHaveTextContent('Logged Out');
      });

      await user.click(
        screen.getByRole('button', {
          name: 'Login',
        })
      );

      await user.click(
        screen.getByRole('button', {
          name: 'Logout',
        })
      );

      expect(setItemSpy).toHaveBeenCalledWith(
        'auth-logout-broadcast',
        expect.stringContaining('"type":"LOGOUT"')
      );

      expect(removeItemSpy).toHaveBeenCalledWith(
        'auth-logout-broadcast'
      );

      setItemSpy.mockRestore();
      removeItemSpy.mockRestore();
    });


    it('should process a valid logout storage event', async () => {
      global.BroadcastChannel = undefined;

      const user = userEvent.setup();

      renderAuthProvider();

      await waitFor(() => {
        expect(
          screen.getByTestId('auth')
        ).toHaveTextContent('Logged Out');
      });

      await user.click(
        screen.getByRole('button', {
          name: 'Login',
        })
      );

      act(() => {
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: 'auth-logout-broadcast',
            newValue: JSON.stringify({
              type: 'LOGOUT',
              timestamp: Date.now(),
            }),
          })
        );
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('auth')
        ).toHaveTextContent('Logged Out');
      });

      expect(session.clearToken).toHaveBeenCalled();
    });
  });


  // ───────────────────────────────────────────────────────────
  // pageshow / bfcache
  // ───────────────────────────────────────────────────────────
  describe('pageshow event', () => {
    it('should refresh authentication when a persisted pageshow event occurs', async () => {
      refreshWithLock.mockResolvedValueOnce({
        accessToken: 'initial-token',
        user: {
          email: 'initial@test.com',
          name: 'Initial User',
        },
      });

      renderAuthProvider();

      await waitFor(() => {
        expect(
          screen.getByTestId('auth')
        ).toHaveTextContent('Logged In');
      });

      refreshWithLock.mockResolvedValueOnce({
        accessToken: 'fresh-token',
        user: {
          email: 'fresh@test.com',
          name: 'Fresh User',
        },
      });

      act(() => {
        window.dispatchEvent(
          new PageTransitionEvent('pageshow', {
            persisted: true,
          })
        );
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('user-email')
        ).toHaveTextContent('fresh@test.com');
      });

      expect(refreshWithLock).toHaveBeenCalledTimes(2);

      expect(session.setToken).toHaveBeenCalledWith(
        'fresh-token'
      );
    });


    it('should clear authentication when bfcache refresh fails', async () => {
      refreshWithLock.mockResolvedValueOnce({
        accessToken: 'initial-token',
        user: {
          email: 'initial@test.com',
          name: 'Initial User',
        },
      });

      renderAuthProvider();

      await waitFor(() => {
        expect(
          screen.getByTestId('auth')
        ).toHaveTextContent('Logged In');
      });

      refreshWithLock.mockRejectedValueOnce(
        new Error('Refresh failed')
      );

      act(() => {
        window.dispatchEvent(
          new PageTransitionEvent('pageshow', {
            persisted: true,
          })
        );
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('auth')
        ).toHaveTextContent('Logged Out');
      });

      expect(session.clearToken).toHaveBeenCalled();
    });


    it('should not refresh authentication for a normal pageshow event', async () => {
      renderAuthProvider();

      await waitFor(() => {
        expect(
          screen.getByTestId('auth')
        ).toHaveTextContent('Logged Out');
      });

      const initialCallCount =
        refreshWithLock.mock.calls.length;

      act(() => {
        window.dispatchEvent(
          new PageTransitionEvent('pageshow', {
            persisted: false,
          })
        );
      });

      expect(
        refreshWithLock.mock.calls.length
      ).toBe(initialCallCount);
    });
  });


  // ───────────────────────────────────────────────────────────
  // logout-event from api.js
  // ───────────────────────────────────────────────────────────
  describe('logout-event', () => {
    it('should clear authentication when logout-event is received', async () => {
      const user = userEvent.setup();

      renderAuthProvider();

      await waitFor(() => {
        expect(
          screen.getByTestId('auth')
        ).toHaveTextContent('Logged Out');
      });

      await user.click(
        screen.getByRole('button', {
          name: 'Login',
        })
      );

      expect(
        screen.getByTestId('auth')
      ).toHaveTextContent('Logged In');

      act(() => {
        window.dispatchEvent(
          new Event('logout-event')
        );
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('auth')
        ).toHaveTextContent('Logged Out');
      });

      expect(session.clearToken).toHaveBeenCalled();
    });


    it('should not navigate to login when already on a public route', async () => {
      window.history.replaceState(
        {},
        '',
        '/login'
      );

      renderAuthProvider();

      await waitFor(() => {
        expect(
          screen.getByTestId('auth')
        ).toHaveTextContent('Logged Out');
      });

      act(() => {
        window.dispatchEvent(
          new Event('logout-event')
        );
      });

      expect(
        screen.getByTestId('location')
      ).toHaveTextContent('/login');
    });
  });


  // ───────────────────────────────────────────────────────────
  // cleanup
  // ───────────────────────────────────────────────────────────
  afterEach(() => {
    jest.restoreAllMocks();

    global.BroadcastChannel = undefined;

    session.accessToken = null;
  });
});