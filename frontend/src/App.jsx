// src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@/context/ThemeContext';

// Layouts & pages
import MainLayout from '@/components/layout/MainLayout';
import HomePage from '@/components/layout/Home';
import Dashboard from '@/components/layout/Dashboard/UserDashboard';

// Auth & guards
import { AuthProvider } from '@/lib/AuthContext';
import ProtectedRoute from '@/lib/ProtectedRoute';
import AdminRoute from '@/lib/AdminRoute';

// Admin
import AdminMainLayout from '@/features/Adminpages/AdminMainLayout';

// Auth pages
import SignUpForm from '@/features/authpages/Signup';
import LoginForm from '@/features/authpages/Login';
import ResetPasswordPage from '@/features/authpages/Resetpassword';
import ForgotPasswordPage from '@/features/authpages/Forgetpassword';

// ── Dynamic pages (replaces all individual converter/compressor pages) ───────
import DynamicConverterPage from '@/features/conversion/pages/DynamicConverterPage';
import DynamicCompressorPage from '@/features/compression/pages/DynamicCompressorPage';

// ── Special pages (not covered by dynamic routing) ───────────────────────────
import PdfToSummary from '@/features/conversion/pages/PdfToSummary';

// Fallback
import NotFound from '@/components/common/NotFound';

// React Query & Google OAuth
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GoogleOAuthProvider } from '@react-oauth/google';

const GOOGLE_CLIENT_ID = '720705456854-qetqatdv8oqjvn8jc1hnfov97eu0d3sg.apps.googleusercontent.com';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      cacheTime: 1000 * 60 * 30,
      refetchOnWindowFocus: false,
      refetchOnMount: true,
    },
  },
});

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
            <AuthProvider>
              <Routes>

                {/* --- Public Routes --- */}
                <Route element={<MainLayout />}>
                  <Route path="/" element={<HomePage />} />

                  {/* Dynamic converter — covers all from/to combinations */}
                  <Route path="/convert/:from/:to" element={<DynamicConverterPage />} />

                  {/* Dynamic compressor — covers all format types */}
                  <Route path="/compress/:type" element={<DynamicCompressorPage />} />

                  {/* Standalone — not covered by dynamic routing */}
                  <Route path="/pdf-to-summary" element={<PdfToSummary />} />
                </Route>

                {/* --- Auth Routes --- */}
                <Route path="/login"           element={<LoginForm />} />
                <Route path="/signup"          element={<SignUpForm />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password"  element={<ResetPasswordPage />} />

                {/* --- Protected: Standard Users --- */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />

                {/* --- Protected: Admins --- */}
                <Route
                  path="/admin/*"
                  element={
                    <AdminRoute>
                      <AdminMainLayout />
                    </AdminRoute>
                  }
                />

                {/* --- Fallback Routes --- */}
                <Route path="/error/:code" element={<NotFound />} />
                <Route path="/403"         element={<NotFound errorCode={403} />} />
                <Route path="*"            element={<NotFound />} />

              </Routes>
            </AuthProvider>
          </GoogleOAuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;