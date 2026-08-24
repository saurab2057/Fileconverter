// src/App.jsx
import React, { lazy, Suspense, useMemo } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ThemeProvider } from '@/context/ThemeContext';
import { ToastProvider } from '@/context/ToastContext';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import NotFound from '@/components/common/NotFound';

// Static, small imports stay eager (essential for the app shell)
import { AuthProvider } from '@/lib/AuthContext';
import ProtectedRoute from '@/lib/ProtectedRoute';
import AdminGuard from '@/lib/AdminGuard';

// React Query
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Google Auth Layout (only wraps login & signup)
import GoogleAuthLayout from '@/lib/GoogleAuthLayout';

// ─────────────────────────────────────────────────────────────
// Skeleton fallbacks — imported eagerly (tiny, no JS to split).
// Each group gets a skeleton that matches its visual shape so
// there is zero layout shift when the real chunk arrives.
// ─────────────────────────────────────────────────────────────
import MainLayoutSkeleton from '@/components/skeleton/MainLayoutSkeleton';
import AuthPageSkeleton   from '@/components/skeleton/AuthPageSkeleton';
import DashboardSkeleton  from '@/components/skeleton/DashboardSkeleton';

// ─────────────────────────────────────────────────────────────
// Lazy-loaded routes
// ─────────────────────────────────────────────────────────────
const MainLayout            = lazy(() => import('@/components/layout/MainLayout'));
const HomePage              = lazy(() => import('@/components/layout/Home'));
const SignUpForm             = lazy(() => import('@/features/authpages/Signup'));
const LoginForm             = lazy(() => import('@/features/authpages/Login'));
const ResetPasswordPage     = lazy(() => import('@/features/authpages/Resetpassword'));
const ForgotPasswordPage    = lazy(() => import('@/features/authpages/Forgetpassword'));
const PasskeyLogin          = lazy(() => import('@/features/authpages/PasskeyLogin'));
const DynamicConverterPage  = lazy(() => import('@/features/conversion/pages/DynamicConverterPage'));
const DynamicCompressorPage = lazy(() => import('@/features/compression/pages/DynamicCompressorPage'));
const PdfToSummary          = lazy(() => import('@/features/conversion/pages/PdfToSummary'));
const UserDashboard         = lazy(() => import('@/components/layout/Dashboard/UserDashboard'));
const AdminRoutes           = lazy(() => import('@/routes/AdminRoutes'));

// ─────────────────────────────────────────────────────────────
// AdminRoutes gets a minimal spinner — admin traffic is low and
// the bundle is already guarded, so a simple fallback is fine.
// ─────────────────────────────────────────────────────────────
const AdminFallback = () => (
  <div className="flex items-center justify-center h-screen w-full bg-gray-50 dark:bg-gray-900">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
  </div>
);

// ─────────────────────────────────────────────────────────────
// AuthShell — sits inside <BrowserRouter> so useLocation works.
// Picks the right skeleton based on the current URL and passes
// it to AuthProvider as loadingFallback. This keeps AuthContext
// clean (zero routing knowledge) while showing the correct
// skeleton during the one-time auth token check on first load.
// ─────────────────────────────────────────────────────────────
const AUTH_ROUTES = [
  '/login',
  '/signup',
  '/passkey-login',
  '/forgot-password',
  '/reset-password',
];

const AuthShell = ({ children }) => {
  const { pathname } = useLocation();

  const loadingFallback = useMemo(() => {
    if (AUTH_ROUTES.includes(pathname))    return <AuthPageSkeleton />;
    if (pathname.startsWith('/dashboard')) return <DashboardSkeleton />;
    return <MainLayoutSkeleton />;
  }, [pathname]);

  return (
    <AuthProvider loadingFallback={loadingFallback}>
      {children}
    </AuthProvider>
  );
};

// ─────────────────────────────────────────────────────────────
// Query client
// ─────────────────────────────────────────────────────────────
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
              {/*
                AuthShell replaces the old bare <AuthProvider>.
                Must live inside <BrowserRouter> (for useLocation)
                but outside <Routes> (so it wraps the entire tree).
              */}
              <AuthShell>
                <Routes>

                  {/* ── Public routes (MainLayout shell) ─────────
                      Suspense #1 wraps the layout element only.
                      Fires once when the MainLayout chunk first loads.
                      Child page chunks are caught by the inner Suspense
                      inside MainLayout itself — the header never
                      re-mounts or flickers on navigation.
                  ─────────────────────────────────────────────────── */}
                  <Route
                    element={
                      <Suspense fallback={<MainLayoutSkeleton />}>
                        <MainLayout />
                      </Suspense>
                    }
                  >
                    <Route index element={<HomePage />} />
                    <Route path="/convert/:from/:to" element={<DynamicConverterPage />} />
                    <Route path="/compress/:type"    element={<DynamicCompressorPage />} />
                    <Route path="/ai/summarizer"     element={<PdfToSummary />} />
                  </Route>

                  {/* ── Auth routes ───────────────────────────────
                      AuthPageSkeleton matches the dark-gradient
                      background of Login/Signup — transition is seamless.
                  ─────────────────────────────────────────────────── */}
                  <Route
                    element={
                      <Suspense fallback={<AuthPageSkeleton />}>
                        <GoogleAuthLayout />
                      </Suspense>
                    }
                  >
                    <Route path="/login"  element={<LoginForm />} />
                    <Route path="/signup" element={<SignUpForm />} />
                  </Route>

                  {/* Standalone auth pages — same dark skeleton */}
                  <Route
                    path="/passkey-login"
                    element={
                      <Suspense fallback={<AuthPageSkeleton />}>
                        <PasskeyLogin />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/forgot-password"
                    element={
                      <Suspense fallback={<AuthPageSkeleton />}>
                        <ForgotPasswordPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/reset-password"
                    element={
                      <Suspense fallback={<AuthPageSkeleton />}>
                        <ResetPasswordPage />
                      </Suspense>
                    }
                  />

                  {/* ── Protected: Standard Users ──────────────── */}
                  <Route
                    path="/dashboard"
                    element={
                      <ProtectedRoute>
                        <Suspense fallback={<DashboardSkeleton />}>
                          <UserDashboard />
                        </Suspense>
                      </ProtectedRoute>
                    }
                  />

                  {/* ── Protected: Admins ─────────────────────── */}
                  <Route
                    path="/admin/*"
                    element={
                      <AdminGuard>
                        <Suspense fallback={<AdminFallback />}>
                          <AdminRoutes />
                        </Suspense>
                      </AdminGuard>
                    }
                  />

                  {/* ── Fallback routes ───────────────────────── */}
                  <Route
                    path="/error/:code"
                    element={
                      <Suspense fallback={null}>
                        <NotFound />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/403"
                    element={
                      <Suspense fallback={null}>
                        <NotFound errorCode={403} />
                      </Suspense>
                    }
                  />
                  <Route
                    path="*"
                    element={
                      <Suspense fallback={null}>
                        <NotFound />
                      </Suspense>
                    }
                  />

                </Routes>
              </AuthShell>
            </QueryClientProvider>
          </ErrorBoundary>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;