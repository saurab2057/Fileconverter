import React, { useEffect, useState } from 'react';
import { Mail, RefreshCw, ArrowLeft } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { authService } from '@/services/authService';
import { RECAPTCHA_SITE_KEY } from '@/lib/constants';
import { useToast } from '@/context/ToastContext';

const SignupVerification = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();

  const email = location.state?.email || '';

  const [isResending, setIsResending] = useState(false);

  // Load reCAPTCHA v3 when the page mounts.
  useEffect(() => {
    if (!document.querySelector('script[src*="recaptcha/api.js"]')) {
      const script = document.createElement('script');

      script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
      script.async = true;
      script.defer = true;

      document.body.appendChild(script);
    }
  }, []);

  const handleResend = async () => {
    if (!email) {
      navigate('/signup', { replace: true });
      return;
    }

    setIsResending(true);

    try {
      if (!window.grecaptcha) {
        throw new Error('reCAPTCHA is not ready. Please try again.');
      }

      const token = await window.grecaptcha.execute(
        RECAPTCHA_SITE_KEY,
        { action: 'signup_resend' }
      );

      await authService.resendSignupVerification({
        email,
        recaptchaToken: token,
      });

      toast.success(
        'If this email can be used for a new account, a new verification email has been sent.'
      );
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          err.message ||
          'Unable to resend the verification email. Please try again.'
      );
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-emerald-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm mx-auto">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 p-6">
          <div className="text-center">
            {/* Email icon */}
            <div className="flex justify-center mb-5">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/20 border border-blue-400/20">
                <Mail className="w-8 h-8 text-blue-400" />
              </div>
            </div>

            <h2 className="text-2xl font-bold text-white">
              Check your email
            </h2>

            <p className="text-sm text-gray-300 mt-3 leading-relaxed">
              We sent a verification link to
            </p>

            {email && (
              <p className="text-sm font-semibold text-white mt-1 break-all">
                {email}
              </p>
            )}

            <p className="text-sm text-gray-400 mt-4 leading-relaxed">
              Click the link in the email to verify your email address and
              continue creating your account.
            </p>

            <p className="text-xs text-gray-500 mt-3">
              The verification link expires in 3 minutes.
            </p>

            {/* Resend */}
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending || !email}
              className="w-full mt-6 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 text-white py-3 px-4 rounded-2xl font-semibold shadow-lg transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-1 hover:shadow-xl"
            >
              <RefreshCw
                className={`w-4 h-4 ${
                  isResending ? 'animate-spin' : ''
                }`}
              />

              {isResending
                ? 'Sending...'
                : 'Resend verification link'}
            </button>

            {/* Back to signup */}
            <Link
              to="/signup"
              className="mt-5 inline-flex items-center justify-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to signup
            </Link>

            <p className="text-xs text-gray-500 mt-6 leading-relaxed">
              If you don't see the email, check your spam or junk folder.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignupVerification;