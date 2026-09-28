import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Chrome, Mail } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

import { signupSchema } from '@/utils/validationSchemas';
import { authService } from '@/services/authService';
import { RECAPTCHA_SITE_KEY } from '@/lib/constants';
import { useToast } from '@/context/ToastContext';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';

// ─────────────────────────────────────────────────────────────
// Maps the ?error=... query param the backend redirects back
// with after a failed Google authentication attempt.
// ─────────────────────────────────────────────────────────────
const GOOGLE_ERROR_MESSAGES = {
  google_auth_cancelled: 'Google sign-in was cancelled.',
  google_auth_failed: 'Google authentication failed. Please try again.',
  google_email_unverified: 'Your Google email address is not verified.',
  email_provider_conflict:
    'This email is registered with a password. Please login with your email and password.',
  account_banned: 'Your account has been banned. Please contact support.',
};

const SignUpForm = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();
  const toast = useToast();

  const { handleGoogleClick, isLoading: isGoogleLoading } = useGoogleAuth();

  // Load reCAPTCHA v3 once when the signup page mounts.
  useEffect(() => {
    if (!document.querySelector('script[src*="recaptcha/api.js"]')) {
      const script = document.createElement('script');

      script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
      script.async = true;
      script.defer = true;

      document.body.appendChild(script);
    }
  }, []);

  // Handle Google authentication errors returned through the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');

    if (!error) return;

    toast.error(
      GOOGLE_ERROR_MESSAGES[error] || 'Google authentication failed.'
    );

    window.history.replaceState({}, '', '/signup');
  }, [toast]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data) => {
    setIsSubmitting(true);

    try {
      if (!window.grecaptcha) {
        throw new Error('reCAPTCHA is not ready. Please try again.');
      }

      const token = await window.grecaptcha.execute(
        RECAPTCHA_SITE_KEY,
        { action: 'signup_start' }
      );

      await authService.signupStart({
        email: data.email,
        recaptchaToken: token,
      });

      toast.success(
        'If this email can be used for a new account, a verification email has been sent.'
      );

      navigate('/signup/check-email', {
        replace: true,
        state: {
          email: data.email,
        },
      });
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          err.message ||
          'Unable to start signup. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-emerald-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm mx-auto">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 p-6 relative overflow-hidden">
          <div className="relative z-10">
            <div className="text-center mb-6">
              <div className="flex justify-center mb-3">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-500/20 border border-blue-400/20">
                  <Mail className="w-6 h-6 text-blue-400" />
                </div>
              </div>

              <h2 className="text-2xl font-bold text-white">
                Create your account
              </h2>

              <p className="text-sm text-gray-300 mt-1">
                Enter your email to get started
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Email */}
              <div className="relative">
                <input
                  type="email"
                  placeholder="Enter your email"
                  autoComplete="email"
                  className={`block w-full px-4 py-3 bg-white/10 border rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${
                    errors.email
                      ? 'border-red-400'
                      : 'border-white/10'
                  }`}
                  {...register('email')}
                />

                {errors.email && (
                  <p className="text-xs text-red-400 mt-1 ml-1">
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 text-white py-3 px-4 rounded-2xl font-semibold shadow-lg transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-1 hover:shadow-xl"
              >
                {isSubmitting
                  ? 'Sending verification link...'
                  : 'Continue with Email'}
              </button>

              {/* Divider */}
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/20" />
                </div>

                <div className="relative flex justify-center text-xs">
                  <span className="px-3 bg-gray-900/80 backdrop-blur-sm text-gray-400 font-medium">
                    or
                  </span>
                </div>
              </div>

              {/* Google Button */}
              <button
                type="button"
                onClick={handleGoogleClick}
                disabled={isGoogleLoading}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-gray-300 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGoogleLoading ? (
                  <span className="text-sm font-medium">
                    Initializing...
                  </span>
                ) : (
                  <>
                    <Chrome className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      Continue with Google
                    </span>
                  </>
                )}
              </button>

              {/* reCAPTCHA Notice */}
              <p className="text-xs text-gray-400 text-center mt-4">
                This site is protected by reCAPTCHA and the{' '}
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline"
                >
                  Privacy Policy
                </a>{' '}
                and{' '}
                <a
                  href="https://policies.google.com/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline"
                >
                  Terms of Service
                </a>{' '}
                apply.
              </p>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-300">
                Already have an account?{' '}
                <Link
                  to="/login"
                  className="font-semibold text-blue-400 hover:text-blue-300"
                >
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