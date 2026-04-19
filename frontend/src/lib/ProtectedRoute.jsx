// src/lib/ProtectedRoute.jsx
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import LoadingAnimation from '@/components/ui/LoadingAnimation';

const ProtectedRoute = ({ children }) => {
  // 🔧 CHANGE 1: Destructure isLoggingOut from useAuth
  const { user, isAuthenticated, authLoading, isLoggingOut } = useAuth();

  // Show loading state while checking auth
  if (authLoading) {
    return <LoadingAnimation />;
  }

  // 🔧 CHANGE 2: Skip redirect if intentionally logging out (prevents /403 or wrong redirects)
  if (isLoggingOut) {
    return <LoadingAnimation />; // or <LoadingAnimation /> to prevent flash of unstyled content
  }

  // Not authenticated → redirect to home as unauthenticated
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // Authenticated but user is an admin → redirect to admin dashboard
  if (user?.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  // Authenticated and role is 'user' → allow access
  return children ? children : <Outlet />;
};

export default ProtectedRoute;