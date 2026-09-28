// src/features/authpages/Resetpassword.jsx

import React, { useEffect, useState } from 'react';
import {
  useSearchParams,
  Link,
  useNavigate,
} from 'react-router-dom';
import {
  useForm,
} from 'react-hook-form';
import {
  zodResolver,
} from '@hookform/resolvers/zod';
import { Lock } from 'lucide-react';

import {
  resetPasswordSchema,
} from '@/utils/validationSchemas';

import {
  authService,
} from '@/services/authService';

import {
  useToast,
} from '@/context/ToastContext';

const ResetPasswordPage = () => {
  const [searchParams, setSearchParams] =
    useSearchParams();

  const navigate = useNavigate();
  const toast = useToast();

  // ---------------------------------------------------------------------------
  // RESET TOKEN
  // ---------------------------------------------------------------------------

  const token = searchParams.get('token');

  const [
    isTokenExchanged,
    setIsTokenExchanged,
  ] = useState(false);

  const [
    isVerifying,
    setIsVerifying,
  ] = useState(false);

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(
      resetPasswordSchema
    ),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  // ---------------------------------------------------------------------------
  // EXCHANGE EMAIL TOKEN FOR RESTRICTED RESET SESSION
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (
      token &&
      !isTokenExchanged &&
      !isVerifying
    ) {
      exchangeTokenForSession(token);
    }
  }, [
    token,
    isTokenExchanged,
    isVerifying,
  ]);

  const exchangeTokenForSession = async (
    resetToken
  ) => {
    setIsVerifying(true);

    try {
      await authService.validateResetToken(
        resetToken
      );

      // Remove the raw token from the browser URL.
      //
      // This improves privacy by reducing the chance of the token remaining
      // in browser history or being accidentally copied/shared.
      //
      // Security does NOT depend on this because the backend has already
      // atomically marked the token as used.
      setSearchParams(
        {},
        { replace: true }
      );

      setIsTokenExchanged(true);
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          'This reset link is invalid or has expired.'
      );

      setIsTokenExchanged(false);

      setSearchParams(
        {},
        { replace: true }
      );
    } finally {
      setIsVerifying(false);
    }
  };

  // ---------------------------------------------------------------------------
  // RESET PASSWORD
  // ---------------------------------------------------------------------------

  const onSubmit = async (data) => {
    setIsSubmitting(true);

    try {
      const response =
        await authService.resetPassword(
          data.password
        );

      toast.success(
        response.message
      );

      // Do not automatically authenticate the user after password reset.
      //
      // The user must explicitly log in again.
      setTimeout(() => {
        navigate('/login', {
          replace: true,
        });
      }, 1500);
    } catch (err) {
      if (
        err.response?.status === 401
      ) {
        toast.error(
          'Your reset session has expired. Please request a new reset link.'
        );

        setIsTokenExchanged(false);

        setSearchParams(
          {},
          { replace: true }
        );
      } else {
        toast.error(
          err.response?.data?.message ||
            'Password reset failed.'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // VERIFYING
  // ---------------------------------------------------------------------------

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-emerald-900 flex items-center justify-center p-4">
        <div className="w-full max-w-sm mx-auto bg-white/10 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 p-6 text-center">

          <div className="mb-4">
            <Lock className="h-8 w-8 text-blue-400 mx-auto" />
          </div>

          <h2 className="text-xl font-bold text-white mb-3">
            Verifying reset link...
          </h2>

          <p className="text-gray-300 text-sm">
            Your reset link is being securely verified.
          </p>

        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // INVALID / EXPIRED / ALREADY-USED TOKEN
  // ---------------------------------------------------------------------------

  if (!isTokenExchanged) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-emerald-900 flex items-center justify-center p-4">
        <div className="w-full max-w-sm mx-auto bg-white/10 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 p-6 text-center">

          <div className="mb-4">
            <Lock className="h-8 w-8 text-red-400 mx-auto" />
          </div>

          <h2 className="text-xl font-bold text-white mb-4">
            Reset Link Unavailable
          </h2>

          <p className="text-gray-300 mb-6 text-sm">
            This reset link is invalid, expired, or has
            already been used.
          </p>

          <Link
            to="/forgot-password"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl mb-4"
          >
            Request New Reset Link
          </Link>

          <div>
            <Link
              to="/login"
              className="text-gray-400 hover:text-white text-sm"
            >
              ← Back to Login
            </Link>
          </div>

        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // PASSWORD RESET FORM
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-emerald-900 flex items-center justify-center p-4">

      <div className="w-full max-w-sm mx-auto">

        <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 p-6 relative overflow-hidden">

          <div className="relative z-10">

            <div className="text-center mb-6">

              <div className="mb-3">
                <Lock className="h-8 w-8 text-blue-400 mx-auto" />
              </div>

              <h2 className="text-2xl font-bold text-white">
                Set New Password
              </h2>

              <p className="text-sm text-gray-300 mt-2">
                Enter a new password for your account.
              </p>

            </div>

            <form
              onSubmit={handleSubmit(
                onSubmit
              )}
              className="space-y-4"
            >

              {/* NEW PASSWORD */}
              <div className="relative">

                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-gray-400" />
                </div>

                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="New password (min. 8 characters)"
                  disabled={isSubmitting}
                  className={`block w-full pl-11 pr-4 py-3 bg-white/10 border rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 ${
                    errors.password
                      ? 'border-red-400'
                      : 'border-white/10'
                  }`}
                  {...register('password')}
                />

              </div>

              {errors.password && (
                <p className="text-xs text-red-400">
                  {errors.password.message}
                </p>
              )}

              {/* CONFIRM PASSWORD */}
              <div className="relative">

                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-gray-400" />
                </div>

                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Confirm new password"
                  disabled={isSubmitting}
                  className={`block w-full pl-11 pr-4 py-3 bg-white/10 border rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 ${
                    errors.confirmPassword
                      ? 'border-red-400'
                      : 'border-white/10'
                  }`}
                  {...register(
                    'confirmPassword'
                  )}
                />

              </div>

              {errors.confirmPassword && (
                <p className="text-xs text-red-400">
                  {
                    errors.confirmPassword.message
                  }
                </p>
              )}

              {/* SUBMIT */}
              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  !isTokenExchanged
                }
                className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white py-3 rounded-2xl font-semibold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5"
              >
                {isSubmitting
                  ? 'Resetting Password...'
                  : 'Reset Password'}
              </button>

              <p className="text-xs text-gray-400 text-center mt-3">
                🔒 This reset session expires with
                your original 3-minute reset link.
                All previous login sessions will be
                revoked after the password is changed.
              </p>

            </form>

          </div>

        </div>

      </div>

    </div>
  );
};

export default ResetPasswordPage;