// src/features/authpages/Resetpassword.jsx
import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Lock } from 'lucide-react';
import { resetPasswordSchema } from '@/utils/validationSchemas';
import { authService } from '@/services/authService';
import { useToast } from '@/context/ToastContext';

const ResetPasswordPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const token = searchParams.get('token');
  const [isTokenExchanged, setIsTokenExchanged] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  useEffect(() => {
    if (token && !isTokenExchanged) {
      exchangeTokenForSession(token);
    }
  }, [token, isTokenExchanged]);

  const exchangeTokenForSession = async (token) => {
    setIsVerifying(true);
    try {
      await authService.validateResetToken(token);
      setSearchParams({}, { replace: true });
      setIsTokenExchanged(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid or expired reset link.');
      setSearchParams({}, { replace: true });
    } finally {
      setIsVerifying(false);
    }
  };

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      const response = await authService.resetPassword(data.password);
      toast.success(response.message);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      if (err.response?.status === 401) {
        toast.error('Reset session expired. Please request a new link.');
        setSearchParams({}, { replace: true });
      } else {
        toast.error(err.response?.data?.message || 'Password reset failed.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token && !isTokenExchanged) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-emerald-900 flex items-center justify-center p-4">
        <div className="w-full max-w-sm mx-auto bg-white/10 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 p-6 text-center">
          <h2 className="text-xl font-bold text-white mb-4">🔒 Secure Reset Session Required</h2>
          <p className="text-gray-300 mb-6">
            For your security, password reset links can only be used once.
          </p>
          <Link to="/forgot-password" className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl mb-4">
            Request New Reset Link
          </Link>
          <div>
            <Link to="/login" className="text-gray-400 hover:text-white text-sm">← Back to Login</Link>
          </div>
        </div>
      </div>
    );
  }

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-emerald-900 flex items-center justify-center p-4">
        <div className="w-full max-w-sm mx-auto bg-white/10 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 p-6 text-center">
          <h2 className="text-xl font-bold text-white mb-4">Verifying reset link...</h2>
          <p className="text-gray-300">This link will self-destruct after use for your security</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-emerald-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm mx-auto">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 p-6 relative overflow-hidden">
          <div className="relative z-10">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white">Set New Password</h2>
              <p className="text-sm text-gray-300 mt-2">
                {isTokenExchanged ? 'Your session is secure. Enter your new password below.' : 'Verifying your identity...'}
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="password"
                  placeholder="New password (min. 8 characters)"
                  className={`block w-full pl-11 pr-4 py-3 bg-white/10 border rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 ${
                    errors.password ? 'border-red-400' : 'border-white/10'
                  }`}
                  {...register('password')}
                />
              </div>
              {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="password"
                  placeholder="Confirm new password"
                  className={`block w-full pl-11 pr-4 py-3 bg-white/10 border rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 ${
                    errors.confirmPassword ? 'border-red-400' : 'border-white/10'
                  }`}
                  {...register('confirmPassword')}
                />
              </div>
              {errors.confirmPassword && <p className="text-xs text-red-400">{errors.confirmPassword.message}</p>}

              <button
                type="submit"
                disabled={isSubmitting || !isTokenExchanged}
                className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white py-3 rounded-2xl font-semibold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5"
              >
                {isSubmitting ? 'Resetting Password...' : 'Reset Password'}
              </button>

              <p className="text-xs text-gray-400 text-center mt-2">
                🔒 Your reset session expires in 5 minutes. All previous sessions will be revoked after reset.
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;