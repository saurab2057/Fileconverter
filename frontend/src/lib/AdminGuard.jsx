// src/lib/AdminRoute.jsx
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import LoadingAnimation from '@/components/ui/LoadingAnimation';

const AdminGuard = ({ children }) => {
  const { user, isAuthenticated, authLoading, isLoggingOut } = useAuth();

  // Show loading state while checking auth
  if (authLoading) {
    console.log('AdminRoute: Checking authentication status...');
    return <LoadingAnimation />;
  }

  // ⚠️ CRITICAL: Skip redirect if we're intentionally logging out
  // This prevents the /403 redirect when user state becomes null during logout
  if (isLoggingOut) {
    console.log('AdminRoute: Currently logging out, skipping auth checks to prevent redirect loop.');
    return <LoadingAnimation />; // or <LoadingAnimation /> to prevent flash of unstyled content
  }

  // Not authenticated OR not an admin → redirect to 403
  if (!isAuthenticated || user?.role !== 'admin') {
    return <Navigate to="/403" replace />;
  }

  // Authenticated admin → allow access
  return children ? children : <Outlet />;
};

export default AdminGuard;