// src/routes/AdminRoutes.jsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Admin pages
import AdminDashboard from '@/features/adminpages/AdminDashboard';
import JobMonitor from '@/features/adminpages/JobMonitor';
import UserManagement from '@/features/adminpages/UserManagement';
import SystemConfig from '@/features/adminpages/SystemConfig';
import LogsManager from '@/features/adminpages/logs';

// Layout
import AdminMainLayout from '@/features/adminpages/AdminMainLayout';

const AdminRoutes = () => {
  return (
    <Routes>
      <Route element={<AdminMainLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="jobs" element={<JobMonitor />} />
        <Route path="users" element={<UserManagement />} />
        <Route path="audit-logs" element={<LogsManager />} />
        <Route path="config" element={<SystemConfig />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>
    </Routes>
  );
};

export default AdminRoutes;