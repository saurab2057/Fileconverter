import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import apiClient from '@/lib/api';

const ResetPasswordPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isTokenExchanged, setIsTokenExchanged] = useState(false);

  useEffect(() => {
    if (token && !isTokenExchanged) {
      exchangeTokenForSession(token);
    }
  }, [token, isTokenExchanged]);

  const exchangeTokenForSession = async (token) => {
    setLoading(true);
    setError('');
    try {
      await apiClient.post('/api/auth/validate-reset-token', { token });
      setSearchParams({}, { replace: true });
      setIsTokenExchanged(true);
      setMessage('');
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Invalid or expired reset link. Please request a new one.';
      setError(errorMsg);
      setSearchParams({}, { replace: true });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await apiClient.post('/api/auth/reset-password', {
        newPassword: password,
      });
      setMessage(response.data.message);
      setTimeout(() => { navigate('/login'); }, 2000);
    } catch (err) {
      if (err.response?.status === 401) {
        setError('Reset session expired. Please request a new reset link.');
        setSearchParams({}, { replace: true });
      } else {
        setError(err.response?.data?.message || 'Password reset failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!token && !isTokenExchanged) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-emerald-900 flex items-center justify-center p-4">
        <div className="w-full max-w-sm mx-auto bg-white/10 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 p-6 text-center">
          <h2 className="text-xl font-bold text-white mb-4">🔒 Secure Reset Session Required</h2>
          <p className="text-gray-300 mb-6">For your security, password reset links can only be used once. If you refreshed this page or the link expired, please request a new reset link.</p>
          <Link to="/forgot-password" className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl mb-4">Request New Reset Link</Link>
          <div><Link to="/login" className="text-gray-400 hover:text-white text-sm">← Back to Login</Link></div>
        </div>
      </div>
    );
  }

  if (loading && !isTokenExchanged) {
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
                {isTokenExchanged
                  ? "Your session is secure. Enter your new password below."
                  : "Verifying your identity..."}
              </p>
            </div>
            {message ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"> </path>
                  </svg>
                </div>
                <p className="text-lg text-green-400 font-medium mb-2">{message}</p>
                <p className="text-gray-300 text-sm mb-4">Redirecting to login...</p>
                <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                  <div className="bg-green-500 h-full w-1/2 animate-pulse"> </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="block w-full pl-11 pr-4 py-3 bg-white/10 border border-white/10 rounded-2xl placeholder-gray-400 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                    placeholder="New password (min. 8 characters)"
                  />
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="block w-full pl-11 pr-4 py-3 bg-white/10 border border-white/10 rounded-2xl placeholder-gray-400 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                    placeholder="Confirm new password"
                  />
                </div>

                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm text-center">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !isTokenExchanged}
                  className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white py-3 rounded-2xl font-semibold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5"
                >
                  {loading ? 'Resetting Password...' : 'Reset Password'}
                </button>

                <p className="text-xs text-gray-400 text-center mt-2">
                  🔒 Your reset session expires in 5 minutes. All previous sessions will be revoked after reset.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default ResetPasswordPage;