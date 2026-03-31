import React, { useState } from 'react';
import { Eye, EyeOff, Mail, Lock, Chrome, Facebook, Github, KeyRound } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useGoogleLogin } from '@react-oauth/google';
import apiClient from '@/lib/api';

const LoginForm = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: true,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [submissionStatus, setSubmissionStatus] = useState(null);
  const [backendError, setBackendError] = useState('');

  const navigate = useNavigate();
  const { login } = useAuth();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (errors[name]) { setErrors(prev => ({ ...prev, [name]: '' })); }
    if (backendError) { setBackendError(''); }
    if (submissionStatus) { setSubmissionStatus(null); }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.email) { newErrors.email = 'Email is required'; }
    else if (!/\S+@\S+\.\S+/.test(formData.email)) { newErrors.email = 'Please enter a valid email'; }
    if (!formData.password) { newErrors.password = 'Password is required'; }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ─────────────────────────────────────────────────────────────
  // GOOGLE LOGIN
  // ─────────────────────────────────────────────────────────────
  const handleGoogleLoginSuccess = async (tokenResponse) => {
    setSubmissionStatus('submitting');
    setBackendError('');
    try {
      const serverResponse = await apiClient.post('/api/auth/google', {
        access_token: tokenResponse.access_token,
      });
      const { accessToken, user } = serverResponse.data;
      login(accessToken, user);
      navigate(user.role === 'admin' ? '/admin' : '/', { replace: true });
    } catch (err) {
      setBackendError(err.response?.data?.message || 'Google authentication failed.');
      setSubmissionStatus('error');
    }
  };

  const googleLogin = useGoogleLogin({
    onSuccess: handleGoogleLoginSuccess,
    onError: () => {
      setBackendError('Google login was cancelled or failed.');
      setSubmissionStatus('error');
    },
  });

  // ─────────────────────────────────────────────────────────────
  // PASSWORD LOGIN
  // ─────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setBackendError('');
    setSubmissionStatus('submitting');

    if (validateForm()) {
      window.grecaptcha.ready(() => {
        window.grecaptcha.execute('6LfF_JkrAAAAADh5eTSImyZkNRgezC6UNdxzC0no', { action: 'login' }).then(async (token) => {
          try {
            const response = await apiClient.post('/api/auth/login', {
              email: formData.email,
              password: formData.password,
              'recaptcha-token': token,
            });
            const { accessToken, user } = response.data;
            setSubmissionStatus('success');
            login(accessToken, user);
            navigate(user.role === 'admin' ? '/admin' : '/', { replace: true });
          } catch (err) {
            setSubmissionStatus('error');
            setBackendError(err.response?.data?.message || 'Login failed. Please check your credentials.');
          }
        });
      });
    } else {
      setSubmissionStatus(null);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // PASSKEY LOGIN — navigate to dedicated passkey page
  // Passes the email (if already typed) as state so the passkey
  // page can pre-fill it and skip the email step.
  // ─────────────────────────────────────────────────────────────
  const handlePasskeyLogin = () => {
    navigate('/passkey-login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-emerald-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm mx-auto">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 p-6 relative overflow-hidden">
          <div className="relative z-10">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white">
                Login to Your Account
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* EMAIL */}
              <div className="space-y-1">
                <label htmlFor="email" className="block text-xs font-semibold text-gray-300 uppercase tracking-wide">
                  Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="username webauthn"
                    value={formData.email}
                    onChange={handleChange}
                    className={`block w-full pl-10 pr-3 py-2.5 bg-white/10 border border-white/10 rounded-xl shadow-sm placeholder-gray-400 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white/20 transition-all duration-300 ${errors.email ? 'ring-2 ring-red-300 bg-red-50/50' : ''}`}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-red-500 mt-1">{errors.email}</p>
                )}
              </div>

              {/* PASSWORD */}
              <div className="space-y-1">
                <label htmlFor="password" className="block text-xs font-semibold text-gray-300 uppercase tracking-wide">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={handleChange}
                    className={`block w-full pl-10 pr-10 py-2.5 bg-white/10 border border-white/10 rounded-xl shadow-sm placeholder-gray-400 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white/20 transition-all duration-300 ${errors.password ? 'ring-2 ring-red-300 bg-red-50/50' : ''}`}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword
                      ? <EyeOff className="h-4 w-4 text-gray-400 hover:text-white transition-colors" />
                      : <Eye className="h-4 w-4 text-gray-400 hover:text-white transition-colors" />
                    }
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-red-500 mt-1">{errors.password}</p>
                )}
              </div>

              {/* REMEMBER ME + FORGOT */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center">
                  <input
                    id="rememberMe"
                    name="rememberMe"
                    type="checkbox"
                    checked={formData.rememberMe}
                    onChange={handleChange}
                    className="h-3.5 w-3.5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="rememberMe" className="ml-2 text-gray-300">
                    Remember me
                  </label>
                </div>
                <Link
                  to="/forgot-password"
                  className="text-blue-400 hover:text-blue-300 font-medium transition-colors duration-200"
                >
                  Forgot
                </Link>
              </div>

              {/* STATUS MESSAGES */}
              {submissionStatus === 'submitting' && (
                <p className="text-sm text-blue-500 text-center">Logging in...</p>
              )}
              {submissionStatus === 'success' && (
                <p className="text-sm text-green-500 text-center">Login successful!</p>
              )}
              {submissionStatus === 'error' && backendError && (
                <p className="text-sm text-red-500 text-center">{backendError}</p>
              )}

              {/* LOGIN BUTTON */}
              <button
                type="submit"
                disabled={submissionStatus === 'submitting'}
                className={`w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-2.5 px-4 rounded-xl font-semibold shadow-lg hover:shadow-xl transform transition-all duration-300 hover:from-blue-600 hover:to-indigo-700 active:scale-95 ${submissionStatus === 'submitting' ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-0.5'}`}
              >
                {submissionStatus === 'submitting' ? 'Logging In...' : 'Login'}
              </button>

              {/* ✅ PASSKEY BUTTON — directly below Login, distinct emerald color */}
              <button
                type="button"
                onClick={handlePasskeyLogin}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 hover:border-emerald-400/50 rounded-xl text-emerald-300 hover:text-emerald-200 transition-all duration-300 hover:shadow-md"
              >
                <KeyRound className="w-4 h-4" />
                <span className="text-sm font-medium">Continue with Passkey</span>
              </button>

              {/* DIVIDER */}
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/20" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-3 bg-gray-900/80 backdrop-blur-sm text-gray-400 font-medium">or</span>
                </div>
              </div>

              {/* SOCIAL BUTTONS */}
              <div className="space-y-2">

                {/* GOOGLE */}
                <button
                  type="button"
                  onClick={() => googleLogin()}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-gray-300 hover:text-white transition-all duration-300 hover:shadow-md"
                >
                  <Chrome className="w-4 h-4" />
                  <span className="text-sm font-medium">Continue with Google</span>
                </button>

                {/* FACEBOOK */}
                <button
                  type="button"
                  onClick={() => console.log('Facebook Login Clicked')}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-gray-300 hover:text-blue-400 transition-all duration-300 hover:shadow-md"
                >
                  <Facebook className="w-4 h-4" />
                  <span className="text-sm font-medium">Continue with Facebook</span>
                </button>

                {/* GITHUB */}
                <button
                  type="button"
                  onClick={() => console.log('GitHub Login Clicked')}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-gray-300 hover:text-white transition-all duration-300 hover:shadow-md"
                >
                  <Github className="w-4 h-4" />
                  <span className="text-sm font-medium">Continue with GitHub</span>
                </button>
              </div>

              {/* RECAPTCHA NOTICE */}
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

            <div className="mt-5 text-center">
              <p className="text-sm text-gray-300">
                Don't have an account?{' '}
                <Link
                  to="/signup"
                  className="font-semibold text-blue-400 hover:text-blue-300 transition-colors duration-200"
                >
                  Sign up
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;