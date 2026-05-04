// src/routes/AdminRoutes.jsx
import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Layout is always needed, keep eager
import AdminMainLayout from '@/features/adminpages/AdminMainLayout';

// Lazy-load each admin page
const AdminDashboard = lazy(() => import('@/features/adminpages/AdminDashboard'));
const JobMonitor = lazy(() => import('@/features/adminpages/JobMonitor'));
const UserManagement = lazy(() => import('@/features/adminpages/UserManagement'));
const SystemConfig = lazy(() => import('@/features/adminpages/SystemConfig'));
const LogsManager = lazy(() => import('@/features/adminpages/logs'));

// A light fallback for route transitions
const RouteFallback = () => (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
  </div>
);

const AdminRoutes = () => {
  return (
    <Routes>
      <Route element={<AdminMainLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route
          path="dashboard"
          element={
            <Suspense fallback={<RouteFallback />}>
              <AdminDashboard />
            </Suspense>
          }
        />
        <Route
          path="jobs"
          element={
            <Suspense fallback={<RouteFallback />}>
              <JobMonitor />
            </Suspense>
          }
        />
        <Route
          path="users"
          element={
            <Suspense fallback={<RouteFallback />}>
              <UserManagement />
            </Suspense>
          }
        />
        <Route
          path="audit-logs"
          element={
            <Suspense fallback={<RouteFallback />}>
              <LogsManager />
            </Suspense>
          }
        />
        <Route
          path="config"
          element={
            <Suspense fallback={<RouteFallback />}>
              <SystemConfig />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>
    </Routes>
  );
};

export default AdminRoutes;