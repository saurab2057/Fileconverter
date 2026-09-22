import React from 'react';
import {
    render,
    screen,
    waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
    MemoryRouter,
    Routes,
    Route,
} from 'react-router-dom';

import SignUpForm from '@/features/authpages/Signup';
import { authService } from '@/services/authService';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';


// ─────────────────────────────────────────────────────────────
// Mock authentication service
// ─────────────────────────────────────────────────────────────

jest.mock('@/services/authService', () => ({
    authService: {
        signup: jest.fn(),
    },
}));


// ─────────────────────────────────────────────────────────────
// Mock authentication context
// ─────────────────────────────────────────────────────────────

jest.mock('@/lib/AuthContext', () => ({
    useAuth: jest.fn(),
}));


// ─────────────────────────────────────────────────────────────
// Mock toast context
// ─────────────────────────────────────────────────────────────

jest.mock('@/context/ToastContext', () => ({
    useToast: jest.fn(),
}));


// ─────────────────────────────────────────────────────────────
// Mock Google authentication hook
// ─────────────────────────────────────────────────────────────

jest.mock('@/hooks/useGoogleAuth', () => ({
    useGoogleAuth: jest.fn(),
}));


describe('SignUpForm', () => {
    const mockLogin = jest.fn();

    const mockToast = {
        success: jest.fn(),
        error: jest.fn(),
    };

    const mockHandleGoogleClick = jest.fn();


    // ─────────────────────────────────────────────────────────
    // Render the component without testing navigation
    // ─────────────────────────────────────────────────────────

    const renderPage = () => {
        return render(
            <MemoryRouter initialEntries={['/signup']}>
                <SignUpForm />
            </MemoryRouter>
        );
    };


    // ─────────────────────────────────────────────────────────
    // Render with explicit routes so navigation can be tested
    // ─────────────────────────────────────────────────────────

    const renderPageWithRoutes = () => {
        return render(
            <MemoryRouter initialEntries={['/signup']}>
                <Routes>
                    <Route
                        path="/signup"
                        element={<SignUpForm />}
                    />

                    <Route
                        path="/login"
                        element={<div>Login Route</div>}
                    />
                </Routes>
            </MemoryRouter>
        );
    };


    // ─────────────────────────────────────────────────────────
    // Fill all fields with a valid signup payload
    // ─────────────────────────────────────────────────────────

    const fillValidForm = async (user) => {
        await user.type(
            screen.getByPlaceholderText('Enter your name'),
            'John Doe'
        );

        await user.type(
            screen.getByPlaceholderText('Enter your email'),
            'john@example.com'
        );

        await user.type(
            screen.getByPlaceholderText(
                'Create a strong password'
            ),
            'StrongPass1!'
        );

        await user.type(
            screen.getByPlaceholderText('Confirm password'),
            'StrongPass1!'
        );

        await user.click(
            screen.getByRole('checkbox', {
                name: /i agree to/i,
            })
        );
    };


    // ─────────────────────────────────────────────────────────
    // Reset mocks and browser state before every test
    // ─────────────────────────────────────────────────────────

    beforeEach(() => {
        jest.clearAllMocks();

        useAuth.mockReturnValue({
            login: mockLogin,
        });

        useToast.mockReturnValue(mockToast);

        useGoogleAuth.mockReturnValue({
            handleGoogleClick: mockHandleGoogleClick,
            isLoading: false,
        });

        window.grecaptcha.execute = jest
            .fn()
            .mockResolvedValue('mock-recaptcha-token');

        window.history.replaceState(
            {},
            '',
            '/signup'
        );
    });


    // ─────────────────────────────────────────────────────────
    // Rendering
    // ─────────────────────────────────────────────────────────

    it('should render the signup form', () => {
        renderPage();

        expect(
            screen.getByRole('heading', {
                name: 'Join us',
            })
        ).toBeInTheDocument();

        expect(
            screen.getByText(
                'Create your account in seconds'
            )
        ).toBeInTheDocument();

        expect(
            screen.getByPlaceholderText(
                'Enter your name'
            )
        ).toBeInTheDocument();

        expect(
            screen.getByPlaceholderText(
                'Enter your email'
            )
        ).toBeInTheDocument();

        expect(
            screen.getByPlaceholderText(
                'Create a strong password'
            )
        ).toBeInTheDocument();

        expect(
            screen.getByPlaceholderText(
                'Confirm password'
            )
        ).toBeInTheDocument();

        expect(
            screen.getByRole('checkbox', {
                name: /i agree to/i,
            })
        ).toBeInTheDocument();

        expect(
            screen.getByRole('button', {
                name: 'Create Account',
            })
        ).toBeInTheDocument();

        expect(
            screen.getByRole('button', {
                name: /continue with google/i,
            })
        ).toBeInTheDocument();

        expect(
            screen.getByRole('link', {
                name: 'Login',
            })
        ).toHaveAttribute('href', '/login');
    });


    // ─────────────────────────────────────────────────────────
    // Required fields
    // ─────────────────────────────────────────────────────────

    it('should require all signup fields', async () => {
        const user = userEvent.setup();

        renderPage();

        await user.click(
            screen.getByRole('button', {
                name: 'Create Account',
            })
        );

        expect(
            await screen.findByText('Name is required')
        ).toBeInTheDocument();

        expect(
            screen.getByText('Email is required')
        ).toBeInTheDocument();

        expect(
            screen.getByText(
                'Password must be at least 8 characters'
            )
        ).toBeInTheDocument();

        expect(
            screen.getByText(
                'Please confirm your password'
            )
        ).toBeInTheDocument();

        expect(
            screen.getByText(
                'Invalid input: expected true'
            )
        ).toBeInTheDocument();

        expect(
            authService.signup
        ).not.toHaveBeenCalled();

        expect(
            window.grecaptcha.execute
        ).not.toHaveBeenCalled();
    });


    // ─────────────────────────────────────────────────────────
    // Email validation
    // ─────────────────────────────────────────────────────────

    it('should reject an invalid email address', async () => {
        const user = userEvent.setup();

        renderPage();

        await user.type(
            screen.getByPlaceholderText(
                'Enter your name'
            ),
            'John Doe'
        );

        await user.type(
            screen.getByPlaceholderText(
                'Enter your email'
            ),
            'invalid-email'
        );

        await user.type(
            screen.getByPlaceholderText(
                'Create a strong password'
            ),
            'StrongPass1!'
        );

        await user.type(
            screen.getByPlaceholderText(
                'Confirm password'
            ),
            'StrongPass1!'
        );

        await user.click(
            screen.getByRole('checkbox', {
                name: /i agree to/i,
            })
        );

        await user.click(
            screen.getByRole('button', {
                name: 'Create Account',
            })
        );

        await waitFor(() => {
            expect(
                authService.signup
            ).not.toHaveBeenCalled();
        });

        expect(
            window.grecaptcha.execute
        ).not.toHaveBeenCalled();
    });


    // ─────────────────────────────────────────────────────────
    // Password minimum length validation
    // ─────────────────────────────────────────────────────────

    it('should reject passwords shorter than 8 characters', async () => {
        const user = userEvent.setup();

        renderPage();

        await user.type(
            screen.getByPlaceholderText(
                'Enter your name'
            ),
            'John Doe'
        );

        await user.type(
            screen.getByPlaceholderText(
                'Enter your email'
            ),
            'john@example.com'
        );

        await user.type(
            screen.getByPlaceholderText(
                'Create a strong password'
            ),
            'weak'
        );

        await user.type(
            screen.getByPlaceholderText(
                'Confirm password'
            ),
            'weak'
        );

        await user.click(
            screen.getByRole('checkbox', {
                name: /i agree to/i,
            })
        );

        await user.click(
            screen.getByRole('button', {
                name: 'Create Account',
            })
        );

        expect(
            await screen.findByText(
                'Password must be at least 8 characters'
            )
        ).toBeInTheDocument();

        expect(
            authService.signup
        ).not.toHaveBeenCalled();
    });


    // ─────────────────────────────────────────────────────────
    // Password lowercase validation
    // ─────────────────────────────────────────────────────────

    it('should reject passwords without a lowercase letter', async () => {
        const user = userEvent.setup();

        renderPage();

        await user.type(
            screen.getByPlaceholderText(
                'Enter your name'
            ),
            'John Doe'
        );

        await user.type(
            screen.getByPlaceholderText(
                'Enter your email'
            ),
            'john@example.com'
        );

        await user.type(
            screen.getByPlaceholderText(
                'Create a strong password'
            ),
            'PASSWORD1!'
        );

        await user.type(
            screen.getByPlaceholderText(
                'Confirm password'
            ),
            'PASSWORD1!'
        );

        await user.click(
            screen.getByRole('checkbox', {
                name: /i agree to/i,
            })
        );

        await user.click(
            screen.getByRole('button', {
                name: 'Create Account',
            })
        );

        expect(
            await screen.findByText(
                'Password must contain at least one lowercase letter'
            )
        ).toBeInTheDocument();

        expect(
            authService.signup
        ).not.toHaveBeenCalled();
    });


    // ─────────────────────────────────────────────────────────
    // Password uppercase validation
    // ─────────────────────────────────────────────────────────

    it('should reject passwords without an uppercase letter', async () => {
        const user = userEvent.setup();

        renderPage();

        await user.type(
            screen.getByPlaceholderText(
                'Enter your name'
            ),
            'John Doe'
        );

        await user.type(
            screen.getByPlaceholderText(
                'Enter your email'
            ),
            'john@example.com'
        );

        await user.type(
            screen.getByPlaceholderText(
                'Create a strong password'
            ),
            'password1!'
        );

        await user.type(
            screen.getByPlaceholderText(
                'Confirm password'
            ),
            'password1!'
        );

        await user.click(
            screen.getByRole('checkbox', {
                name: /i agree to/i,
            })
        );

        await user.click(
            screen.getByRole('button', {
                name: 'Create Account',
            })
        );

        expect(
            await screen.findByText(
                'Password must contain at least one uppercase letter'
            )
        ).toBeInTheDocument();

        expect(
            authService.signup
        ).not.toHaveBeenCalled();
    });


    // ─────────────────────────────────────────────────────────
    // Password number validation
    // ─────────────────────────────────────────────────────────

    it('should reject passwords without a number', async () => {
        const user = userEvent.setup();

        renderPage();

        await user.type(
            screen.getByPlaceholderText(
                'Enter your name'
            ),
            'John Doe'
        );

        await user.type(
            screen.getByPlaceholderText(
                'Enter your email'
            ),
            'john@example.com'
        );

        await user.type(
            screen.getByPlaceholderText(
                'Create a strong password'
            ),
            'Password!'
        );

        await user.type(
            screen.getByPlaceholderText(
                'Confirm password'
            ),
            'Password!'
        );

        await user.click(
            screen.getByRole('checkbox', {
                name: /i agree to/i,
            })
        );

        await user.click(
            screen.getByRole('button', {
                name: 'Create Account',
            })
        );

        expect(
            await screen.findByText(
                'Password must contain at least one number'
            )
        ).toBeInTheDocument();

        expect(
            authService.signup
        ).not.toHaveBeenCalled();
    });


    // ─────────────────────────────────────────────────────────
    // Password special-character validation
    // ─────────────────────────────────────────────────────────

    it('should reject passwords without a special character', async () => {
        const user = userEvent.setup();

        renderPage();

        await user.type(
            screen.getByPlaceholderText(
                'Enter your name'
            ),
            'John Doe'
        );

        await user.type(
            screen.getByPlaceholderText(
                'Enter your email'
            ),
            'john@example.com'
        );

        await user.type(
            screen.getByPlaceholderText(
                'Create a strong password'
            ),
            'Password1'
        );

        await user.type(
            screen.getByPlaceholderText(
                'Confirm password'
            ),
            'Password1'
        );

        await user.click(
            screen.getByRole('checkbox', {
                name: /i agree to/i,
            })
        );

        await user.click(
            screen.getByRole('button', {
                name: 'Create Account',
            })
        );

        expect(
            await screen.findByText(
                'Password must contain at least one special character'
            )
        ).toBeInTheDocument();

        expect(
            authService.signup
        ).not.toHaveBeenCalled();
    });


    // ─────────────────────────────────────────────────────────
    // Confirm-password validation
    // ─────────────────────────────────────────────────────────

    it('should reject passwords that do not match', async () => {
        const user = userEvent.setup();

        renderPage();

        await user.type(
            screen.getByPlaceholderText(
                'Enter your name'
            ),
            'John Doe'
        );

        await user.type(
            screen.getByPlaceholderText(
                'Enter your email'
            ),
            'john@example.com'
        );

        await user.type(
            screen.getByPlaceholderText(
                'Create a strong password'
            ),
            'StrongPass1!'
        );

        await user.type(
            screen.getByPlaceholderText(
                'Confirm password'
            ),
            'DifferentPass1!'
        );

        await user.click(
            screen.getByRole('checkbox', {
                name: /i agree to/i,
            })
        );

        await user.click(
            screen.getByRole('button', {
                name: 'Create Account',
            })
        );

        expect(
            await screen.findByText(
                'Passwords do not match'
            )
        ).toBeInTheDocument();

        expect(
            authService.signup
        ).not.toHaveBeenCalled();
    });


    // ─────────────────────────────────────────────────────────
    // Terms validation
    // ─────────────────────────────────────────────────────────

    it('should require acceptance of the terms', async () => {
        const user = userEvent.setup();

        renderPage();

        await user.type(
            screen.getByPlaceholderText(
                'Enter your name'
            ),
            'John Doe'
        );

        await user.type(
            screen.getByPlaceholderText(
                'Enter your email'
            ),
            'john@example.com'
        );

        await user.type(
            screen.getByPlaceholderText(
                'Create a strong password'
            ),
            'StrongPass1!'
        );

        await user.type(
            screen.getByPlaceholderText(
                'Confirm password'
            ),
            'StrongPass1!'
        );

        await user.click(
            screen.getByRole('button', {
                name: 'Create Account',
            })
        );

        expect(
            await screen.findByText(
                'Invalid input: expected true'
            )
        ).toBeInTheDocument();

        expect(
            authService.signup
        ).not.toHaveBeenCalled();
    });


    // ─────────────────────────────────────────────────────────
    // Password visibility
    // ─────────────────────────────────────────────────────────

    it('should toggle the password visibility', async () => {
        const user = userEvent.setup();

        renderPage();

        const passwordInput =
            screen.getByPlaceholderText(
                'Create a strong password'
            );

        expect(passwordInput).toHaveAttribute(
            'type',
            'password'
        );

        const passwordContainer =
            passwordInput.closest('.relative');

        const passwordToggle =
            passwordContainer.querySelector('button');

        await user.click(passwordToggle);

        expect(passwordInput).toHaveAttribute(
            'type',
            'text'
        );

        await user.click(passwordToggle);

        expect(passwordInput).toHaveAttribute(
            'type',
            'password'
        );
    });


    // ─────────────────────────────────────────────────────────
    // Confirm-password visibility
    // ─────────────────────────────────────────────────────────

    it('should toggle the confirm-password visibility', async () => {
        const user = userEvent.setup();

        renderPage();

        const confirmPasswordInput =
            screen.getByPlaceholderText(
                'Confirm password'
            );

        expect(confirmPasswordInput).toHaveAttribute(
            'type',
            'password'
        );

        const confirmPasswordContainer =
            confirmPasswordInput.closest('.relative');

        const confirmPasswordToggle =
            confirmPasswordContainer.querySelector(
                'button'
            );

        await user.click(confirmPasswordToggle);

        expect(confirmPasswordInput).toHaveAttribute(
            'type',
            'text'
        );

        await user.click(confirmPasswordToggle);

        expect(confirmPasswordInput).toHaveAttribute(
            'type',
            'password'
        );
    });


    // ─────────────────────────────────────────────────────────
    // Successful signup payload
    // ─────────────────────────────────────────────────────────

    it('should submit the correct signup data with the reCAPTCHA token', async () => {
        const user = userEvent.setup();

        authService.signup.mockResolvedValueOnce({});

        renderPage();

        await fillValidForm(user);

        await user.click(
            screen.getByRole('button', {
                name: 'Create Account',
            })
        );

        await waitFor(() => {
            expect(
                window.grecaptcha.execute
            ).toHaveBeenCalledWith(
                expect.anything(),
                {
                    action: 'signup',
                }
            );
        });

        expect(
            authService.signup
        ).toHaveBeenCalledWith({
            name: 'John Doe',
            email: 'john@example.com',
            password: 'StrongPass1!',
            confirmPassword: 'StrongPass1!',
            recaptchaToken: 'mock-recaptcha-token',
        });
    });


    // ─────────────────────────────────────────────────────────
    // Signup loading state
    // ─────────────────────────────────────────────────────────

    it('should show the creating-account state while signup is in progress', async () => {
        const user = userEvent.setup();

        let resolveSignup;

        authService.signup.mockReturnValueOnce(
            new Promise((resolve) => {
                resolveSignup = resolve;
            })
        );

        renderPage();

        await fillValidForm(user);

        await user.click(
            screen.getByRole('button', {
                name: 'Create Account',
            })
        );

        const creatingButton =
            await screen.findByRole(
                'button',
                {
                    name: 'Creating Account...',
                }
            );

        expect(creatingButton).toBeDisabled();

        resolveSignup({});

        await waitFor(() => {
            expect(
                screen.getByRole('button', {
                    name: 'Create Account',
                })
            ).not.toBeDisabled();
        });
    });


    // ─────────────────────────────────────────────────────────
    // Successful signup toast
    // ─────────────────────────────────────────────────────────

    it('should show a success toast after successful signup', async () => {
        const user = userEvent.setup();

        authService.signup.mockResolvedValueOnce({});

        renderPage();

        await fillValidForm(user);

        await user.click(
            screen.getByRole('button', {
                name: 'Create Account',
            })
        );

        await waitFor(() => {
            expect(
                mockToast.success
            ).toHaveBeenCalledWith(
                'Account created successfully! Please login.'
            );
        });
    });


    // ─────────────────────────────────────────────────────────
    // Navigation after successful signup
    // ─────────────────────────────────────────────────────────

    it('should navigate to login after successful signup', async () => {
        const user = userEvent.setup();

        authService.signup.mockResolvedValueOnce({});

        renderPageWithRoutes();

        await fillValidForm(user);

        await user.click(
            screen.getByRole('button', {
                name: 'Create Account',
            })
        );

        expect(
            await screen.findByText('Login Route')
        ).toBeInTheDocument();
    });


    // ─────────────────────────────────────────────────────────
    // Backend signup error
    // ─────────────────────────────────────────────────────────

    it('should show the backend signup error through the toast', async () => {
        const user = userEvent.setup();

        authService.signup.mockRejectedValueOnce({
            response: {
                data: {
                    message: 'Email already exists.',
                },
            },
        });

        renderPage();

        await fillValidForm(user);

        await user.click(
            screen.getByRole('button', {
                name: 'Create Account',
            })
        );

        await waitFor(() => {
            expect(
                mockToast.error
            ).toHaveBeenCalledWith(
                'Email already exists.'
            );
        });
    });


    // ─────────────────────────────────────────────────────────
    // Generic signup error
    // ─────────────────────────────────────────────────────────

    it('should show the default signup error when the backend provides no message', async () => {
        const user = userEvent.setup();

        authService.signup.mockRejectedValueOnce(
            new Error('Network error')
        );

        renderPage();

        await fillValidForm(user);

        await user.click(
            screen.getByRole('button', {
                name: 'Create Account',
            })
        );

        await waitFor(() => {
            expect(
                mockToast.error
            ).toHaveBeenCalledWith(
                'Signup failed. Please try again.'
            );
        });
    });


    // ─────────────────────────────────────────────────────────
    // Google authentication
    // ─────────────────────────────────────────────────────────

    it('should call the Google authentication handler', async () => {
        const user = userEvent.setup();

        renderPage();

        await user.click(
            screen.getByRole('button', {
                name: /continue with google/i,
            })
        );

        expect(
            mockHandleGoogleClick
        ).toHaveBeenCalledTimes(1);
    });


    // ─────────────────────────────────────────────────────────
    // Google loading state
    // ─────────────────────────────────────────────────────────

    it('should show the Google loading state and disable the Google button', () => {
        useGoogleAuth.mockReturnValue({
            handleGoogleClick: mockHandleGoogleClick,
            isLoading: true,
        });

        renderPage();

        const googleButton =
            screen.getByRole('button', {
                name: /initializing/i,
            });

        expect(googleButton).toBeDisabled();

        expect(
            screen.queryByText(
                'Continue with Google'
            )
        ).not.toBeInTheDocument();
    });


    // ─────────────────────────────────────────────────────────
    // Google OAuth error: cancelled
    // ─────────────────────────────────────────────────────────

    it('should show the Google cancelled error toast', () => {
        window.history.replaceState(
            {},
            '',
            '/signup?error=google_auth_cancelled'
        );

        renderPage();

        expect(
            mockToast.error
        ).toHaveBeenCalledWith(
            'Google sign-in was cancelled.'
        );

        expect(
            window.location.search
        ).toBe('');
    });


    // ─────────────────────────────────────────────────────────
    // Google OAuth error: authentication failed
    // ─────────────────────────────────────────────────────────

    it('should show the Google authentication failed error toast', () => {
        window.history.replaceState(
            {},
            '',
            '/signup?error=google_auth_failed'
        );

        renderPage();

        expect(
            mockToast.error
        ).toHaveBeenCalledWith(
            'Google authentication failed. Please try again.'
        );

        expect(
            window.location.search
        ).toBe('');
    });


    // ─────────────────────────────────────────────────────────
    // Google OAuth error: unverified email
    // ─────────────────────────────────────────────────────────

    it('should show the unverified Google email error toast', () => {
        window.history.replaceState(
            {},
            '',
            '/signup?error=google_email_unverified'
        );

        renderPage();

        expect(
            mockToast.error
        ).toHaveBeenCalledWith(
            'Your Google email address is not verified.'
        );

        expect(
            window.location.search
        ).toBe('');
    });


    // ─────────────────────────────────────────────────────────
    // Google OAuth error: provider conflict
    // ─────────────────────────────────────────────────────────

    it('should show the provider conflict error toast', () => {
        window.history.replaceState(
            {},
            '',
            '/signup?error=email_provider_conflict'
        );

        renderPage();

        expect(
            mockToast.error
        ).toHaveBeenCalledWith(
            'This email is registered with a password. Please login with your email and password.'
        );

        expect(
            window.location.search
        ).toBe('');
    });


    // ─────────────────────────────────────────────────────────
    // Google OAuth error: banned account
    // ─────────────────────────────────────────────────────────

    it('should show the account-banned Google error toast', () => {
        window.history.replaceState(
            {},
            '',
            '/signup?error=account_banned'
        );

        renderPage();

        expect(
            mockToast.error
        ).toHaveBeenCalledWith(
            'Your account has been banned. Please contact support.'
        );

        expect(
            window.location.search
        ).toBe('');
    });


    // ─────────────────────────────────────────────────────────
    // Google OAuth unknown error
    // ─────────────────────────────────────────────────────────

    it('should show the fallback Google error for an unknown error code', () => {
        window.history.replaceState(
            {},
            '',
            '/signup?error=unknown_google_error'
        );

        renderPage();

        expect(
            mockToast.error
        ).toHaveBeenCalledWith(
            'Google authentication failed.'
        );

        expect(
            window.location.search
        ).toBe('');
    });


    // ─────────────────────────────────────────────────────────
    // reCAPTCHA script protection
    // ─────────────────────────────────────────────────────────

    it('should not add a duplicate reCAPTCHA script when one already exists', () => {
        document
            .querySelectorAll(
                'script[src*="recaptcha/api.js"]'
            )
            .forEach((script) => {
                script.remove();
            });

        const existingScript =
            document.createElement('script');

        existingScript.src =
            'https://www.google.com/recaptcha/api.js?render=mock-recaptcha-key';

        document.body.appendChild(existingScript);

        expect(
            document.querySelectorAll(
                'script[src*="recaptcha/api.js"]'
            )
        ).toHaveLength(1);

        renderPage();

        const scripts =
            document.querySelectorAll(
                'script[src*="recaptcha/api.js"]'
            );

        expect(scripts).toHaveLength(1);
    });


    // ─────────────────────────────────────────────────────────
    // Login link
    // ─────────────────────────────────────────────────────────

    it('should expose a Login link pointing to /login', () => {
        renderPage();

        expect(
            screen.getByRole('link', {
                name: 'Login',
            })
        ).toHaveAttribute(
            'href',
            '/login'
        );
    });
});
