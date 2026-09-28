// src/features/authpages/VerifySignupEmail.jsx
import React, { useEffect, useState } from 'react';
import { CheckCircle, Loader2, XCircle } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

import { authService } from '@/services/authService';
import { useToast } from '@/context/ToastContext';

const VerifySignupEmail = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { success } = useToast();

  const [status, setStatus] = useState('verifying');
  const [message, setMessage] = useState(
    'Verifying your email address...'
  );

  useEffect(() => {
    let isMounted = true;

    const verifyEmail = async () => {
      const params = new URLSearchParams(location.search);
      const token = params.get('token');

      if (!token) {
        if (!isMounted) return;

        setStatus('error');
        setMessage(
          'This verification link is invalid or incomplete.'
        );
        return;
      }

      try {
        const response = await authService.verifySignupEmail(token);

        if (!isMounted) return;

        setStatus('success');
        setMessage(
          response?.message || 'Email verified successfully.'
        );

        success('Email verified successfully.');

        setTimeout(() => {
          if (isMounted) {
            navigate('/signup/complete', { replace: true });
          }
        }, 1000);
      } catch (err) {
        if (!isMounted) return;

        setStatus('error');
        setMessage(
          err.response?.data?.message ||
            'This verification link is invalid or has expired. Please request a new verification link.'
        );
      }
    };

    verifyEmail();

    return () => {
      isMounted = false;
    };
  }, [location.search, navigate, success]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-emerald-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm mx-auto">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 p-6">
          <div className="text-center">

            {status === 'verifying' && (
              <>
                <div className="flex justify-center mb-5">
                  <div className="flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/20 border border-blue-400/20">
                    <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                  </div>
                </div>

                <h2 className="text-2xl font-bold text-white">
                  Verifying your email
                </h2>

                <p className="text-sm text-gray-300 mt-3">
                  Please wait while we verify your email address.
                </p>
              </>
            )}

            {status === 'success' && (
              <>
                <div className="flex justify-center mb-5">
                  <div className="flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-400/20">
                    <CheckCircle className="w-8 h-8 text-emerald-400" />
                  </div>
                </div>

                <h2 className="text-2xl font-bold text-white">
                  Email verified
                </h2>

                <p className="text-sm text-gray-300 mt-3">
                  {message}
                </p>

                <p className="text-xs text-gray-500 mt-4">
                  Taking you to the account setup page...
                </p>
              </>
            )}

            {status === 'error' && (
              <>
                <div className="flex justify-center mb-5">
                  <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-500/20 border border-red-400/20">
                    <XCircle className="w-8 h-8 text-red-400" />
                  </div>
                </div>

                <h2 className="text-2xl font-bold text-white">
                  Verification failed
                </h2>

                <p className="text-sm text-gray-300 mt-3 leading-relaxed">
                  {message}
                </p>

                <button
                  type="button"
                  onClick={() =>
                    navigate('/signup', { replace: true })
                  }
                  className="w-full mt-6 bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 text-white py-3 px-4 rounded-2xl font-semibold shadow-lg transition-all duration-300 active:scale-95 hover:-translate-y-1 hover:shadow-xl"
                >
                  Back to signup
                </button>
              </>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifySignupEmail;