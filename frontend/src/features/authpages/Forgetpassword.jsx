// src/features/authpages/Forgetpassword.jsx
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail } from 'lucide-react';
import { forgotPasswordSchema } from '@/utils/validationSchemas';
import { authService } from '@/services/authService';
import { RECAPTCHA_SITE_KEY } from '@/lib/constants';
import { useToast } from '@/context/ToastContext';

const ForgotPasswordPage = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const toast = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    setSuccessMessage('');
    try {
      const token = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'forgot_password' });
      const response = await authService.forgotPassword(data.email, token);
      setSuccessMessage(response.message);
      toast.success('Reset link sent! Check your email.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-emerald-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm mx-auto">
        <div className="bg-white/10 backdrop-blur-md rounded-3xl shadow-xl border border-white/20 p-6">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white">Forgot Your Password</h2>
            <p className="text-sm text-gray-300 mt-1">Enter your email to receive a reset link</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="email"
                placeholder="Your registered email"
                className={`block w-full pl-11 pr-4 py-3 bg-white/10 border rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${
                  errors.email ? 'border-red-400' : 'border-white/10'
                }`}
                {...register('email')}
              />
            </div>
            {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}

            {successMessage && <p className="text-sm text-green-400 text-center">{successMessage}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 text-white py-3 rounded-2xl font-semibold shadow-lg disabled:opacity-50 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl"
            >
              {isSubmitting ? 'Sending...' : 'Send Reset Link'}
            </button>

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
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;