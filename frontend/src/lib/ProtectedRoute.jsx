// src/lib/ProtectedRoute.jsx
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { user, isAuthenticated, authLoading } = useAuth();
  if (authLoading) {
    return <div>Loading session...</div>;
  }

  // Not authenticated → redirect to home
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