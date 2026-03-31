// features/authpages/PasskeyLogin.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { KeyRound, Mail, ArrowLeft, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { startAuthentication } from '@simplewebauthn/browser';
import { useAuth } from '@/lib/AuthContext';
import apiClient from '@/lib/api';

// ─────────────────────────────────────────────────────────────
// PASSKEY LOGIN PAGE
//
// Flow:
//   1. User lands here (from Login page "Continue with Passkey" button)
//   2. User types their email
//   3. User submits email → server checks if passkeys exist
//   4. If yes → browser native biometric/PIN prompt appears
//   5. User completes prompt → JWT issued → navigated to dashboard
//
// States:
//   idle        → initial, waiting for email submit
//   loading     → waiting for server or browser prompt
//   success     → logged in, navigating away
//   error       → something went wrong, show message + retry
//   no_passkey  → email valid but no passkeys registered
// ─────────────────────────────────────────────────────────────

const PasskeyLogin = () => {
  const navigate  = useNavigate();
  const { login } = useAuth();

  const [email, setEmail]   = useState('');
  const [emailError, setEmailError] = useState('');
  const [status, setStatus] = useState('idle');  // idle | loading | success | error | no_passkey
  const [message, setMessage] = useState('');

  // ─────────────────────────────────────────────────────────────
  // VALIDATE EMAIL
  // ─────────────────────────────────────────────────────────────
  const validateEmail = () => {
    if (!email.trim()) {
      setEmailError('Email is required.');
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email.trim())) {
      setEmailError('Please enter a valid email address.');
      return false;
    }
    setEmailError('');
    return true;
  };

  // ─────────────────────────────────────────────────────────────
  // HANDLE PASSKEY LOGIN
  //
  // Step 1: POST /api/passkeys/login/start  → get challenge + options
  // Step 2: startAuthentication(options)    → browser shows biometric prompt
  // Step 3: POST /api/passkeys/login/finish → server verifies, returns JWT
  // ─────────────────────────────────────────────────────────────
  const handlePasskeyLogin = async (e) => {
    e.preventDefault();
    if (!validateEmail()) return;

    setStatus('loading');
    setMessage('');

    // ── Step 1: Get challenge from server ──────────────────────
    let authOptions;
    try {
      const res = await apiClient.post('/api/passkeys/login/start', {
        email: email.trim().toLowerCase(),
      });
      authOptions = res.data;
    } catch (err) {
      const msg = err.response?.data?.message || '';

      // Server returns 404 when email has no passkeys
      if (err.response?.status === 404) {
        setStatus('no_passkey');
        setMessage(msg || 'No passkey found for this account.');
        return;
      }

      // Account suspended
      if (err.response?.status === 403) {
        setStatus('error');
        setMessage('This account is not active. Please contact support.');
        return;
      }

      setStatus('error');
      setMessage(msg || 'Something went wrong. Please try again.');
      return;
    }

    // ── Step 2: Trigger browser biometric / PIN prompt ─────────
    let assertion;
    try {
      assertion = await startAuthentication({ optionsJSON: authOptions });
    } catch (err) {
      // User cancelled the prompt or device doesn't support WebAuthn
      if (err.name === 'NotAllowedError') {
        setStatus('error');
        setMessage('Passkey prompt was cancelled. Please try again.');
        return;
      }
      setStatus('error');
      setMessage('Your device does not support passkeys or the prompt failed.');
      return;
    }

    // ── Step 3: Send assertion to server for verification ──────
    try {
      const res = await apiClient.post('/api/passkeys/login/finish', {
        response: assertion,
      });
      const { accessToken, user } = res.data;

      setStatus('success');
      setMessage('Verified! Logging you in...');

      login(accessToken, user);

      // Small delay so user sees the success state before navigating
      setTimeout(() => {
        navigate(user.role === 'admin' ? '/admin' : '/', { replace: true });
      }, 800);

    } catch (err) {
      setStatus('error');
      setMessage(
        err.response?.data?.message || 'Passkey verification failed. Please try again.'
      );
    }
  };

  // ─────────────────────────────────────────────────────────────
  // STATUS UI HELPERS
  // ─────────────────────────────────────────────────────────────
  const isLoading = status === 'loading';

  const StatusMessage = () => {
    if (!message) return null;

    // No passkey registered — show helpful hint
    if (status === 'no_passkey') {
      return (
        <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm text-amber-300">{message}</p>
            <p className="text-xs text-amber-400/70 mt-1">
              Log in with your password first, then go to your{' '}
              <span className="font-medium text-amber-300">Dashboard</span>{' '}
              to add a passkey.
            </p>
          </div>
        </div>
      );
    }

    // Success
    if (status === 'success') {
      return (
        <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <p className="text-sm text-emerald-300">{message}</p>
        </div>
      );
    }

    // Error
    return (
      <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
        <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
        <p className="text-sm text-red-300">{message}</p>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-emerald-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm mx-auto">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 p-6">

          {/* HEADER */}
          <div className="text-center mb-6">
            {/* Icon */}
            <div className="flex justify-center mb-4">
            </div>
            <h2 className="text-2xl font-bold text-white">Sign in with Passkey</h2>
          </div>

          {/* FORM */}
          <form onSubmit={handlePasskeyLogin} className="space-y-4">

            {/* EMAIL INPUT */}
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
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailError('');
                    if (status !== 'idle') setStatus('idle');
                    setMessage('');
                  }}
                  placeholder="Enter your email"
                  autoComplete="username webauthn"
                  disabled={isLoading || status === 'success'}
                  className={`block w-full pl-10 pr-3 py-2.5 bg-white/10 border rounded-xl shadow-sm placeholder-gray-500 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:bg-white/20 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${
                    emailError
                      ? 'border-red-400/50 ring-1 ring-red-400/50'
                      : 'border-white/10'
                  }`}
                />
              </div>
              {emailError && (
                <p className="text-xs text-red-400 mt-1">{emailError}</p>
              )}
            </div>

            {/* STATUS MESSAGE */}
            <StatusMessage />

            {/* SUBMIT BUTTON */}
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

          {/* FOOTER HINT */}
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