// src/features/authpages/PasskeyLogin.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound, Mail, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { startAuthentication } from '@simplewebauthn/browser';
import { useAuth } from '@/lib/AuthContext';
import apiClient from '@/lib/api';
import { passkeyEmailSchema } from '@/utils/validationSchemas';
import { useToast } from '@/context/ToastContext';

const PasskeyLogin = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(passkeyEmailSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (data) => {
    setStatus('loading');
    setMessage('');

    try {
      // Step 1: Get challenge from server
      const res = await apiClient.post('/api/passkeys/login/start', {
        email: data.email.trim().toLowerCase(),
      });
      const authOptions = res.data;

      // Step 2: Trigger browser biometric/PIN prompt
      let assertion;
      try {
        assertion = await startAuthentication({ optionsJSON: authOptions });
      } catch (err) {
        if (err.name === 'NotAllowedError') {
          setStatus('error');
          setMessage('Passkey prompt was cancelled. Please try again.');
          return;
        }
        setStatus('error');
        setMessage('Your device does not support passkeys or the prompt failed.');
        return;
      }

      // Step 3: Send assertion to server for verification
      const verifyRes = await apiClient.post('/api/passkeys/login/finish', {
        response: assertion,
      });
      const { accessToken, user } = verifyRes.data;

      setStatus('success');
      setMessage('Verified! Logging you in...');
      toast.success('Login successful!');
      login(accessToken, user);

      setTimeout(() => {
        navigate(user.role === 'admin' ? '/admin' : '/', { replace: true });
      }, 800);
    } catch (err) {
      const msg = err.response?.data?.message || '';
      if (err.response?.status === 404) {
        setStatus('no_passkey');
        setMessage(msg || 'No passkey found for this account.');
      } else if (err.response?.status === 403) {
        setStatus('error');
        setMessage('This account is not active. Please contact support.');
      } else {
        setStatus('error');
        setMessage(msg || 'Something went wrong. Please try again.');
      }
    }
  };

  const isLoading = status === 'loading';

  const StatusMessage = () => {
    if (!message) return null;
    if (status === 'no_passkey') {
      return (
        <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm text-amber-300">{message}</p>
            <p className="text-xs text-amber-400/70 mt-1">
              Log in with your password first, then go to your{' '}
              <span className="font-medium text-amber-300">Dashboard</span> to add a passkey.
            </p>
          </div>
        </div>
      );
    }
    if (status === 'success') {
      return (
        <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <p className="text-sm text-emerald-300">{message}</p>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
        <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
        <p className="text-sm text-red-300">{message}</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-emerald-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm mx-auto">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 p-6">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white">Sign in with Passkey</h2>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wide">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="email"
                  placeholder="Enter your email"
                  autoComplete="username webauthn"
                  disabled={isLoading || status === 'success'}
                  className={`block w-full pl-10 pr-3 py-2.5 bg-white/10 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all disabled:opacity-50 ${
                    errors.email ? 'border-red-400' : 'border-white/10'
                  }`}
                  {...register('email')}
                />
              </div>
              {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>}
            </div>

            <StatusMessage />

            <button
              type="submit"
              disabled={isLoading || status === 'success'}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white py-2.5 px-4 rounded-xl font-semibold shadow-lg hover:shadow-xl transform transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Waiting for device...</span>
                </>
              ) : status === 'success' ? (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Verified!</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Continue with Passkey</span>
                </>
              )}
            </button>
          </form>

          <p className="text-xs text-gray-500 text-center mt-5 leading-relaxed">
            Passkeys use your device's biometric sensor or PIN.
            <br />
            No password is transmitted or stored.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PasskeyLogin;