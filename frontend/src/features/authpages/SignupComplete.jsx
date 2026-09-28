import React, { useState } from 'react';
import { Eye, EyeOff, CheckCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';

import { authService } from '@/services/authService';
import { useToast } from '@/context/ToastContext';
import { signupCompleteSchema } from '@/utils/validationSchemas';

const SignupComplete = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();
  const toast = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(signupCompleteSchema),
    defaultValues: {
      name: '',
      password: '',
      confirmPassword: '',
      termsAccepted: false,
    },
  });

  const onSubmit = async (data) => {
    setIsSubmitting(true);

    try {
      await authService.completeSignup({
        name: data.name,
        password: data.password,
        confirmPassword: data.confirmPassword,
        termsAccepted: data.termsAccepted,
      });

      toast.success('Account created successfully. Please login.');

      navigate('/login', { replace: true });
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          'Unable to create your account. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-emerald-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm mx-auto">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 p-6">
          <div className="relative z-10">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="flex justify-center mb-4">
                <div className="flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-400/20">
                  <CheckCircle className="w-7 h-7 text-emerald-400" />
                </div>
              </div>

              <h2 className="text-2xl font-bold text-white">
                Finish creating your account
              </h2>

              <p className="text-sm text-gray-300 mt-2">
                Your email has been verified. Set up your account below.
              </p>
            </div>

            <form
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-4"
            >
              {/* Name */}
              <div>
                <input
                  type="text"
                  placeholder="Enter your name"
                  autoComplete="name"
                  className={`block w-full px-4 py-3 bg-white/10 border rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${
                    errors.name
                      ? 'border-red-400'
                      : 'border-white/10'
                  }`}
                  {...register('name')}
                />

                {errors.name && (
                  <p className="text-xs text-red-400 mt-1 ml-1">
                    {errors.name.message}
                  </p>
                )}
              </div>

              {/* Password */}
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create a strong password"
                  autoComplete="new-password"
                  className={`block w-full px-4 py-3 pr-12 bg-white/10 border rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${
                    errors.password
                      ? 'border-red-400'
                      : 'border-white/10'
                  }`}
                  {...register('password')}
                />

                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-4 flex items-center"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={
                    showPassword
                      ? 'Hide password'
                      : 'Show password'
                  }
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400 hover:text-white" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400 hover:text-white" />
                  )}
                </button>

                {errors.password && (
                  <p className="text-xs text-red-400 mt-1 ml-1">
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Confirm Password */}
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm password"
                  autoComplete="new-password"
                  className={`block w-full px-4 py-3 pr-12 bg-white/10 border rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${
                    errors.confirmPassword
                      ? 'border-red-400'
                      : 'border-white/10'
                  }`}
                  {...register('confirmPassword')}
                />

                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-4 flex items-center"
                  onClick={() =>
                    setShowConfirmPassword((value) => !value)
                  }
                  aria-label={
                    showConfirmPassword
                      ? 'Hide confirm password'
                      : 'Show confirm password'
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400 hover:text-white" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400 hover:text-white" />
                  )}
                </button>

                {errors.confirmPassword && (
                  <p className="text-xs text-red-400 mt-1 ml-1">
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>

              {/* Terms */}
              <div className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  id="termsAccepted"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-0.5"
                  {...register('termsAccepted')}
                />

                <label
                  htmlFor="termsAccepted"
                  className="text-xs text-gray-300 leading-relaxed"
                >
                  I agree to the{' '}
                  <button
                    type="button"
                    className="text-blue-400 hover:text-blue-300 font-medium hover:underline"
                  >
                    Terms
                  </button>{' '}
                  and{' '}
                  <button
                    type="button"
                    className="text-blue-400 hover:text-blue-300 font-medium hover:underline"
                  >
                    Privacy Policy
                  </button>
                </label>
              </div>

              {errors.termsAccepted && (
                <p className="text-xs text-red-400 ml-1">
                  {errors.termsAccepted.message}
                </p>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 text-white py-3 px-4 rounded-2xl font-semibold shadow-lg transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-1 hover:shadow-xl"
              >
                {isSubmitting
                  ? 'Creating Account...'
                  : 'Create Account'}
              </button>
            </form>

            <p className="text-xs text-gray-500 text-center mt-5 leading-relaxed">
              Your verified email address is securely associated with this
              signup session. You do not need to enter it again.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignupComplete;