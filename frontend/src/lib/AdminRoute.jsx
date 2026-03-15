import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

const AdminRoute = ({ children }) => {
  const { user, isAuthenticated, authLoading } = useAuth();

  // 1. Show a loading state while we check for a session
  if (authLoading) {
    return <div>Loading session...</div>; // Or a spinner component
  }

  // 2. Redirect to homepage if user is not authenticated OR if their role is not 'admin'
  if (!isAuthenticated || user?.role !== 'admin') {
    return <Navigate to="/403" replace />;
  }

  // 3. If everything is fine, render the requested component (e.g., AdminMainLayout)
  return children ? children : <Outlet />;
};

export default AdminRoute;