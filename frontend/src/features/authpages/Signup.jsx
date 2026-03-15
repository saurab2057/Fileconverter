// src/pages/Signup.jsx
import React, { useState } from 'react';
import { Eye, EyeOff, Mail, Lock, Github, Chrome, Facebook } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useGoogleLogin } from '@react-oauth/google';
import apiClient from '@/lib/api';

const SignUpForm = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    acceptTerms: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    if (backendError) setBackendError('');
    if (submissionStatus) setSubmissionStatus(null);
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name) newErrors.name = 'Name is required';
    if (!formData.email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+.\S+/.test(formData.email)) newErrors.email = 'Please enter a valid email';
    if (!formData.password) newErrors.password = 'Password is required';
    else if (formData.password.length < 8) newErrors.password = 'Password must be at least 8 characters';
    else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) newErrors.password = 'A strong password is required';
    if (!formData.confirmPassword) newErrors.confirmPassword = 'Please confirm your password';
    else if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    if (!formData.acceptTerms) newErrors.acceptTerms = 'You must accept the terms';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleGoogleLoginSuccess = async (tokenResponse) => {
    setSubmissionStatus('submitting');
    setBackendError('');
    try {
      const serverResponse = await apiClient.post('/api/auth/google', {
        access_token: tokenResponse.access_token,
      });
      const { accessToken, user } = serverResponse.data;
      login(accessToken, user);
      navigate('/', { replace: true });
    } catch (err) {
      const message = err.response?.data?.message || "Google authentication failed.";
      setBackendError(message);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBackendError('');
    setSubmissionStatus('submitting');
    if (validateForm()) {
      window.grecaptcha.ready(() => {
        window.grecaptcha.execute('6LfF_JkrAAAAADh5eTSImyZkNRgezC6UNdxzC0no', { action: 'signup' }).then(async (token) => {
          try {
            const response = await apiClient.post('/api/auth/signup', {
              name: formData.name,
              email: formData.email,
              password: formData.password,
              confirmPassword: formData.confirmPassword,
              'recaptcha-token': token,
            });
            setSubmissionStatus('success');
            setTimeout(() => navigate('/login', { replace: true }), 1500);
          } catch (err) {
            setSubmissionStatus('error');
            setBackendError(err.response?.data?.message || 'Signup failed. Please try again.');
          }
        });
      });
    } else {
      setSubmissionStatus(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-emerald-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm mx-auto">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 p-6 relative overflow-hidden">
          <div className="relative z-10">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white">
                Join us
              </h2>
              <p className="text-sm text-gray-300">
                Create your account in seconds
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <input
                  id="signup-name" name="name" type="text" value={formData.name} onChange={handleChange}
                  className={`block w-full px-4 py-3 bg-white/10 border border-white/10 rounded-2xl shadow-sm placeholder-gray-400 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-300 ${errors.name ? 'ring-2 ring-red-300 bg-red-50/50' : ''}`}
                  placeholder="Enter your name"
                />
                {errors.name && <p className="text-xs text-red-500 mt-1 ml-1">{errors.name}</p>}
              </div>

              <div className="relative">
                <input
                  id="signup-email" name="email" type="email" value={formData.email} onChange={handleChange}
                  className={`block w-full px-4 py-3 bg-white/10 border border-white/10 rounded-2xl shadow-sm placeholder-gray-400 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-300 ${errors.email ? 'ring-2 ring-red-300 bg-red-50/50' : ''}`}
                  placeholder="Enter your email"
                />
                {errors.email && <p className="text-xs text-red-500 mt-1 ml-1">{errors.email}</p>}
              </div>

              <div className="relative">
                <input
                  id="signup-password" name="password" type={showPassword ? 'text' : 'password'} value={formData.password} onChange={handleChange}
                  className={`block w-full px-4 py-3 bg-white/10 border border-white/10 rounded-2xl shadow-sm placeholder-gray-400 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-300 ${errors.password ? 'ring-2 ring-red-300 bg-red-50/50' : ''}`}
                  placeholder="Create a strong password"
                />
                <button type="button" className="absolute inset-y-0 right-0 pr-4 flex items-center" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="h-4 w-4 text-gray-400 hover:text-white" /> : <Eye className="h-4 w-4 text-gray-400 hover:text-white" />}
                </button>
                {errors.password && <p className="text-xs text-red-500 mt-1 ml-1">{errors.password}</p>}
              </div>

              <div className="relative">
                <input
                  id="confirmPassword" name="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} value={formData.confirmPassword} onChange={handleChange}
                  className={`block w-full px-4 py-3 bg-white/10 border border-white/10 rounded-2xl shadow-sm placeholder-gray-400 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-300 ${errors.confirmPassword ? 'ring-2 ring-red-300 bg-red-50/50' : ''}`}
                  placeholder="Confirm password"
                />
                <button type="button" className="absolute inset-y-0 right-0 pr-4 flex items-center" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                  {showConfirmPassword ? <EyeOff className="h-4 w-4 text-gray-400 hover:text-white" /> : <Eye className="h-4 w-4 text-gray-400 hover:text-white" />}
                </button>
                {errors.confirmPassword && <p className="text-xs text-red-500 mt-1 ml-1">{errors.confirmPassword}</p>}
              </div>

              <div className="flex items-start space-x-3">
                <input id="acceptTerms" name="acceptTerms" type="checkbox" checked={formData.acceptTerms} onChange={handleChange} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-0.5" />
                <label htmlFor="acceptTerms" className="text-xs text-gray-300 leading-relaxed">
                  I agree to the  <button type="button" className="text-blue-400 hover:text-blue-300 font-medium hover:underline">Terms</button> and  <button type="button" className="text-blue-400 hover:text-blue-300 font-medium hover:underline">Privacy Policy</button>
                </label>
              </div>
              {errors.acceptTerms && <p className="text-xs text-red-500 ml-1">{errors.acceptTerms}</p>}

              {submissionStatus === 'submitting' && <p className="text-sm text-blue-400 text-center">Please wait...</p>}
              {submissionStatus === 'success' && <p className="text-sm text-green-400 text-center">Signup successful! Redirecting...</p>}
              {submissionStatus === 'error' && backendError && <p className="text-sm text-red-400 text-center">{backendError}</p>}

              <button
                type="submit"
                className={`w-full bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 text-white py-3 px-4 rounded-2xl font-semibold shadow-lg transition-all duration-300 active:scale-95 ${submissionStatus === 'submitting' ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-1 hover:shadow-xl'}`}
                disabled={submissionStatus === 'submitting'}
              >
                {submissionStatus === 'submitting' ? 'Creating Account...' : 'Create Account'}
              </button>

              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center"> <div className="w-full border-t border-white/20"> </div> </div>
                <div className="relative flex justify-center text-xs"> <span className="px-3 bg-gray-900/80 backdrop-blur-sm text-gray-400 font-medium">or</span> </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <button type="button" onClick={() => googleLogin()} disabled={submissionStatus === 'submitting'} className="flex items-center justify-center p-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-gray-300 hover:text-white transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 disabled:opacity-50">
                  <Chrome className="w-5 h-5" />
                </button>
                <button type="button" disabled={submissionStatus === 'submitting'} className="flex items-center justify-center p-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-gray-300 hover:text-blue-400 transition-all duration-300 hover:shadow-md  hover:-translate-y-0.5 disabled:opacity-50">
                  <Facebook className="w-5 h-5" />
                </button>
                <button type="button" disabled={submissionStatus === 'submitting'} className="flex items-center justify-center p-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-gray-300 hover:text-white transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 disabled:opacity-50">
                  <Github className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-gray-400 text-center mt-4">
                This site is protected by reCAPTCHA and the{" "}
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                  Privacy Policy
                </a>{" "}
                and{" "}
                <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                  Terms of Service
                </a>{" "}
                apply.
              </p>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-300">
                Already have an account?{' '}
                <Link to="/login" className="font-semibold text-blue-400 hover:text-blue-300 transition-colors duration-200">
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