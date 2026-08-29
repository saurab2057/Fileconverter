// src/features/authpages/Signup.jsx
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Chrome } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';

import { useAuth } from '@/lib/AuthContext';
import { signupSchema } from '@/utils/validationSchemas';
import { authService } from '@/services/authService';
import { RECAPTCHA_SITE_KEY, GOOGLE_REDIRECT_URI } from '@/lib/constants';
import { useToast } from '@/context/ToastContext';

// ─────────────────────────────────────────────────────────────
// Maps the ?error=... query param the backend redirects back
// with (see authController.js googleAuthCallback) to a
// human-readable toast message. The backend always redirects
// Google-auth errors to /login, but this is kept here too in
// case this page is ever linked to directly with an error param.
// ─────────────────────────────────────────────────────────────
const GOOGLE_ERROR_MESSAGES = {
  google_auth_cancelled: 'Google sign-in was cancelled.',
  google_auth_failed: 'Google authentication failed. Please try again.',
  google_email_unverified: 'Your Google email address is not verified.',
  email_provider_conflict: 'This email is registered with a password. Please login with your email and password.',
  account_banned: 'Your account has been banned. Please contact support.',
};

const SignUpForm = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [oauthState, setOauthState] = useState(null);
  const navigate = useNavigate();
  const { login } = useAuth();
  const toast = useToast();

  // 🔽 reCAPTCHA script loader
  useEffect(() => {
    if (!document.querySelector('script[src*="recaptcha/api.js"]')) {
      const script = document.createElement('script');
      script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
  }, []);

  // ─────────────────────────────────────────────────────────
  // Fetch the CSRF `state` token before the user can click
  // "Continue with Google". The backend stores the matching
  // value in an httpOnly cookie (see authController.js
  // googleAuthInit) and verifies it on the callback — this
  // prevents an attacker's OAuth code being replayed against
  // a victim's browser (login CSRF).
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    authService.getGoogleOauthState()
      .then((data) => setOauthState(data.state))
      .catch(() => setOauthState(null));
  }, []);

  // ─────────────────────────────────────────────────────────
  // Catches errors the backend redirects back with after a
  // failed Google auth attempt, e.g. /signup?error=account_banned
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    if (!error) return;

    toast.error(GOOGLE_ERROR_MESSAGES[error] || 'Google authentication failed.');
    window.history.replaceState({}, '', '/signup');
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false,
    },
  });

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      const token = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'signup' });
      await authService.signup({
        name: data.name,
        email: data.email,
        password: data.password,
        confirmPassword: data.confirmPassword,
        recaptchaToken: token,
      });
      toast.success('Account created successfully! Please login.');
      navigate('/login', { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Signup failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─────────────────────────────────────────────────────────
  // Google OAuth — redirect flow (no popup).
  //
  // flow: 'auth-code'   → we get an authorization code, not a
  //                        client-side access token.
  // ux_mode: 'redirect' → clicking the button navigates the
  //                        whole tab to Google's consent screen.
  //                        No window.open() is ever called, so
  //                        ad-blockers / popup-blockers have
  //                        nothing to block.
  // redirect_uri        → points at the BACKEND callback route
  //                        (GET /api/auth/google/callback), which
  //                        exchanges the code, creates/logs into
  //                        the account, sets the session cookie,
  //                        and redirects back into the app.
  // state                → CSRF token fetched from /google/init above.
  //                        Google echoes it back on the callback URL;
  //                        the backend checks it against the cookie
  //                        it set, before doing anything else.
  //
  // There is no onSuccess/onError here — the entire flow completes
  // server-side; this page only handles the ?error=... case above.
  // ─────────────────────────────────────────────────────────
  const googleLogin = useGoogleLogin({
    flow: 'auth-code',
    ux_mode: 'redirect',
    redirect_uri: GOOGLE_REDIRECT_URI,
    state: oauthState,
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-emerald-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm mx-auto">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 p-6 relative overflow-hidden">
          <div className="relative z-10">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white">Join us</h2>
              <p className="text-sm text-gray-300">Create your account in seconds</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Name */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Enter your name"
                  className={`block w-full px-4 py-3 bg-white/10 border rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${errors.name ? 'border-red-400' : 'border-white/10'
                    }`}
                  {...register('name')}
                />
                {errors.name && <p className="text-xs text-red-400 mt-1 ml-1">{errors.name.message}</p>}
              </div>

              {/* Email */}
              <div className="relative">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className={`block w-full px-4 py-3 bg-white/10 border rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${errors.email ? 'border-red-400' : 'border-white/10'
                    }`}
                  {...register('email')}
                />
                {errors.email && <p className="text-xs text-red-400 mt-1 ml-1">{errors.email.message}</p>}
              </div>

              {/* Password */}
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create a strong password"
                  className={`block w-full px-4 py-3 bg-white/10 border rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${errors.password ? 'border-red-400' : 'border-white/10'
                    }`}
                  {...register('password')}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-4 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400 hover:text-white" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400 hover:text-white" />
                  )}
                </button>
                {errors.password && <p className="text-xs text-red-400 mt-1 ml-1">{errors.password.message}</p>}
              </div>

              {/* Confirm Password */}
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm password"
                  className={`block w-full px-4 py-3 bg-white/10 border rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${errors.confirmPassword ? 'border-red-400' : 'border-white/10'
                    }`}
                  {...register('confirmPassword')}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-4 flex items-center"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400 hover:text-white" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400 hover:text-white" />
                  )}
                </button>
                {errors.confirmPassword && <p className="text-xs text-red-400 mt-1 ml-1">{errors.confirmPassword.message}</p>}
              </div>

              {/* Accept Terms */}
              <div className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  id="acceptTerms"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-0.5"
                  {...register('acceptTerms')}
                />
                <label htmlFor="acceptTerms" className="text-xs text-gray-300 leading-relaxed">
                  I agree to the <button type="button" className="text-blue-400 hover:text-blue-300 font-medium hover:underline">Terms</button> and{' '}
                  <button type="button" className="text-blue-400 hover:text-blue-300 font-medium hover:underline">Privacy Policy</button>
                </label>
              </div>
              {errors.acceptTerms && <p className="text-xs text-red-400 ml-1">{errors.acceptTerms.message}</p>}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 text-white py-3 px-4 rounded-2xl font-semibold shadow-lg transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-1 hover:shadow-xl"
              >
                {isSubmitting ? 'Creating Account...' : 'Create Account'}
              </button>

              {/* Divider */}
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/20" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-3 bg-gray-900/80 backdrop-blur-sm text-gray-400 font-medium">or</span>
                </div>
              </div>

              {/* Google Button */}
              <button
                type="button"
                onClick={() => googleLogin()}
                disabled={!oauthState}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-gray-300 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Chrome className="w-4 h-4" />
                <span className="text-sm font-medium">Continue with Google</span>
              </button>

              {/* reCAPTCHA Notice */}
              <p className="text-xs text-gray-400 text-center mt-4">
                This site is protected by reCAPTCHA and the{' '}
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                  Privacy Policy
                </a>{' '}
                and{' '}
                <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                  Terms of Service
                </a>{' '}
                apply.
              </p>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-300">
                Already have an account?{' '}
                <Link to="/login" className="font-semibold text-blue-400 hover:text-blue-300">
                  Login
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignUpForm;
