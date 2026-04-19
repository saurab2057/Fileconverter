// src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@/context/ThemeContext';
import { ToastProvider } from '@/context/ToastContext';
import ErrorBoundary from '@/components/common/ErrorBoundary';

// Layouts & pages
import MainLayout from '@/components/layout/MainLayout';
import HomePage from '@/components/layout/Home';

// Auth & guards
import { AuthProvider } from '@/lib/AuthContext';
import ProtectedRoute from '@/lib/ProtectedRoute';
import AdminGuard from '@/lib/AdminGuard';

// Admin Routes (nested)
import AdminRoutes from '@/routes/AdminRoutes';

// Auth pages
import SignUpForm from '@/features/authpages/Signup';
import LoginForm from '@/features/authpages/Login';
import ResetPasswordPage from '@/features/authpages/Resetpassword';
import ForgotPasswordPage from '@/features/authpages/Forgetpassword';
import PasskeyLogin from '@/features/authpages/PasskeyLogin';

// Dynamic pages
import DynamicConverterPage from '@/features/conversion/pages/DynamicConverterPage';
import DynamicCompressorPage from '@/features/compression/pages/DynamicCompressorPage';

// Special pages
import PdfToSummary from '@/features/conversion/pages/PdfToSummary';

// User Dashboard
import UserDashboard from '@/components/layout/Dashboard/UserDashboard';

// Fallback
import NotFound from '@/components/common/NotFound';

// React Query & Google OAuth
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { GOOGLE_CLIENT_ID } from '@/lib/constants';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      refetchOnWindowFocus: false,
      refetchOnMount: true,
    },
  },
});

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
              <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                <AuthProvider>
                  <Routes>
                    {/* --- Public Routes --- */}
                    <Route element={<MainLayout />}>
                      <Route path="/" element={<HomePage />} />
                      <Route path="/convert/:from/:to" element={<DynamicConverterPage />} />
                      <Route path="/compress/:type" element={<DynamicCompressorPage />} />
                      <Route path="/ai/summarizer" element={<PdfToSummary />} />
                    </Route>

                    {/* --- Auth Routes --- */}
                    <Route path="/login" element={<LoginForm />} />
                    <Route path="/signup" element={<SignUpForm />} />
                    <Route path="/passkey-login" element={<PasskeyLogin />} />
                    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                    <Route path="/reset-password" element={<ResetPasswordPage />} />

                    {/* --- Protected: Standard Users --- */}
                    <Route
                      path="/dashboard"
                      element={
                        <ProtectedRoute>
                          <UserDashboard />
                        </ProtectedRoute>
                      }
                    />

                    {/* --- Protected: Admins (Nested Routes) --- */}
                    <Route
                      path="/admin/*"
                      element={
                        <AdminGuard>
                          <AdminRoutes />
                        </AdminGuard>
                      }
                    />

                    {/* --- Fallback Routes --- */}
                    <Route path="/error/:code" element={<NotFound />} />
                    <Route path="/403" element={<NotFound errorCode={403} />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </AuthProvider>
              </GoogleOAuthProvider>
            </QueryClientProvider>
          </ErrorBoundary>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;