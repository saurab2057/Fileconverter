// src/App.jsx
import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@/context/ThemeContext';
import { ToastProvider } from '@/context/ToastContext';
import ErrorBoundary from '@/components/common/ErrorBoundary';

// Static, small imports stay eager (these are essential for the app shell)
import { AuthProvider } from '@/lib/AuthContext';
import ProtectedRoute from '@/lib/ProtectedRoute';
import AdminGuard from '@/lib/AdminGuard';

// React Query
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Google Auth Layout (only wraps login & signup)
import GoogleAuthLayout from '@/lib/GoogleAuthLayout';   // 👈 new import

// --- Everything else is now LAZY LOADED ---
const MainLayout = lazy(() => import('@/components/layout/MainLayout'));
const HomePage = lazy(() => import('@/components/layout/Home'));
const SignUpForm = lazy(() => import('@/features/authpages/Signup'));
const LoginForm = lazy(() => import('@/features/authpages/Login'));
const ResetPasswordPage = lazy(() => import('@/features/authpages/Resetpassword'));
const ForgotPasswordPage = lazy(() => import('@/features/authpages/Forgetpassword'));
const PasskeyLogin = lazy(() => import('@/features/authpages/PasskeyLogin'));
const DynamicConverterPage = lazy(() => import('@/features/conversion/pages/DynamicConverterPage'));
const DynamicCompressorPage = lazy(() => import('@/features/compression/pages/DynamicCompressorPage'));
const PdfToSummary = lazy(() => import('@/features/conversion/pages/PdfToSummary'));
const UserDashboard = lazy(() => import('@/components/layout/Dashboard/UserDashboard'));
const AdminRoutes = lazy(() => import('@/routes/AdminRoutes'));
const NotFound = lazy(() => import('@/components/common/NotFound'));

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

// Simple loading fallback
const PageLoader = () => (
  <div className="flex items-center justify-center h-96 w-full">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
              <AuthProvider>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    {/* --- Public Routes --- */}
                    <Route element={<MainLayout />}>
                      <Route index element={<HomePage />} />
                      <Route path="/convert/:from/:to" element={<DynamicConverterPage />} />
                      <Route path="/compress/:type" element={<DynamicCompressorPage />} />
                      <Route path="/ai/summarizer" element={<PdfToSummary />} />
                    </Route>

                    {/* --- Auth Routes (Google OAuth only here) --- */}
                    <Route element={<GoogleAuthLayout />}>
                      <Route path="/login" element={<LoginForm />} />
                      <Route path="/signup" element={<SignUpForm />} />
                    </Route>

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
                </Suspense>
              </AuthProvider>
            </QueryClientProvider>
          </ErrorBoundary>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;