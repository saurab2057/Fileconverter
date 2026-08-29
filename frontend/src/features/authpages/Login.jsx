// src/features/authpages/Login.jsx
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Mail, Lock, Chrome, KeyRound } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';

import { useAuth } from '@/lib/AuthContext';
import { loginSchema } from '@/utils/validationSchemas';
import { authService } from '@/services/authService';
import { RECAPTCHA_SITE_KEY, VITE_GOOGLE_REDIRECT_URI } from '@/lib/constants';
import { useToast } from '@/context/ToastContext';

import LoadingAnimation from '@/components/ui/LoadingAnimation';

const GOOGLE_ERROR_MESSAGES = {
  google_auth_cancelled: 'Google sign-in was cancelled.',
  google_auth_failed: 'Google authentication failed. Please try again.',
  google_email_unverified: 'Your Google email address is not verified.',
  email_provider_conflict: 'This email is registered with a password. Please login with your email and password.',
  account_banned: 'Your account has been banned. Please contact support.',
};

const LoginForm = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [oauthState, setOauthState] = useState(null);

  const navigate = useNavigate();
  const { login } = useAuth();
  const toast = useToast();

  // Load reCAPTCHA
  useEffect(() => {
    if (!document.querySelector('script[src*="recaptcha/api.js"]')) {
      const script = document.createElement('script');
      script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
  }, []);

  // Fetch CSRF state token for Google OAuth
  useEffect(() => {
    console.log('[Login] Fetching oauth_state from /google/init');
    authService.getGoogleOauthState()
      .then((data) => {
        console.log('[Login] Received oauth_state:', data.state.substring(0, 8) + '...');
        setOauthState(data.state);
      })
      .catch((err) => {
        console.error('[Login] Failed to fetch oauth_state:', err);
        setOauthState(null);
      });
  }, []);

  // Handle error query param from backend redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    if (!error) return;

    console.log('[Login] Received error from backend:', error);
    toast.error(GOOGLE_ERROR_MESSAGES[error] || 'Google authentication failed.');
    window.history.replaceState({}, '', '/login');
  }, [toast]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: true },
  });

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      const token = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'login' });
      const response = await authService.login({
        email: data.email,
        password: data.password,
        recaptchaToken: token,
      });
      login(response.accessToken, response.user);
      setIsRedirecting(true);
      setTimeout(() => {
        toast.success('Login successful!');
        navigate(response.user.role === 'admin' ? '/admin' : '/', { replace: true });
      }, 2000);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Google OAuth – redirect flow
  const googleLogin = useGoogleLogin({
    flow: 'auth-code',
    ux_mode: 'redirect',
    redirect_uri: VITE_GOOGLE_REDIRECT_URI,
    state: oauthState,
    onNonOAuthError: (error) => {
      console.error('[Login] Google login non-OAuth error:', error);
    },
  });

  const handleGoogleClick = () => {
    console.log('[Login] Google button clicked');
    console.log('[Login] Redirect URI:', VITE_GOOGLE_REDIRECT_URI);
    console.log('[Login] OAuth state:', oauthState ? oauthState.substring(0,8)+'...' : 'null');
    if (!oauthState) {
      toast.error('OAuth state not ready. Please refresh.');
      return;
    }
    console.log('[Login] Current document.cookie (for debugging):', document.cookie);
    googleLogin();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-emerald-900 flex items-center justify-center p-4 relative">
      {isRedirecting && <LoadingAnimation text='Hang Tight' />}
      <div className="w-full max-w-sm mx-auto">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 p-6 relative overflow-hidden">
          <div className="relative z-10">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white">Login to Your Account</h2>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Email */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wide">Email</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    autoComplete="username webauthn"
                    className={`block w-full pl-10 pr-3 py-2.5 bg-white/10 border rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${errors.email ? 'border-red-400' : 'border-white/10'}`}
                    placeholder="Enter your email"
                    {...register('email')}
                  />
                </div>
                {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>}
              </div>

              {/* Password */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wide">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className={`block w-full pl-10 pr-10 py-2.5 bg-white/10 border rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${errors.password ? 'border-red-400' : 'border-white/10'}`}
                    placeholder="Enter your password"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4 text-gray-400 hover:text-white" /> : <Eye className="h-4 w-4 text-gray-400 hover:text-white" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-red-400 mt-1">{errors.password.message}</p>}
              </div>

              {/* Remember Me + Forgot */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center">
                  <input type="checkbox" id="rememberMe" className="h-3.5 w-3.5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" {...register('rememberMe')} />
                  <label htmlFor="rememberMe" className="ml-2 text-gray-300">Remember me</label>
                </div>
                <Link to="/forgot-password" className="text-blue-400 hover:text-blue-300 font-medium">Forgot?</Link>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting || isRedirecting}
                className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-2.5 px-4 rounded-xl font-semibold shadow-lg hover:shadow-xl transform transition-all duration-300 hover:from-blue-600 hover:to-indigo-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5"
              >
                {isSubmitting ? 'Logging In...' : 'Login'}
              </button>

              {/* Passkey */}
              <button
                type="button"
                onClick={() => navigate('/passkey-login')}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 hover:border-emerald-400/50 rounded-xl text-emerald-300 hover:text-emerald-200 transition-all duration-300"
              >
                <KeyRound className="w-4 h-4" />
                <span className="text-sm font-medium">Continue with Passkey</span>
              </button>

              {/* Divider */}
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/20" /></div>
                <div className="relative flex justify-center text-xs"><span className="px-3 bg-gray-900/80 backdrop-blur-sm text-gray-400 font-medium">or</span></div>
              </div>

              {/* Google Button */}
              <button
                type="button"
                onClick={handleGoogleClick}
                disabled={!oauthState}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-gray-300 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Chrome className="w-4 h-4" />
                <span className="text-sm font-medium">Continue with Google</span>
              </button>

              {/* reCAPTCHA Notice */}
              <p className="text-xs text-gray-400 text-center mt-4">
                This site is protected by reCAPTCHA and the{' '}
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Privacy Policy</a>{' '}
                and{' '}
                <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Terms of Service</a>{' '}
                apply.
              </p>
            </form>

            <div className="mt-5 text-center">
              <p className="text-sm text-gray-300">Don't have an account? <Link to="/signup" className="font-semibold text-blue-400 hover:text-blue-300">Sign up</Link></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
