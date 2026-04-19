// src/features/adminpages/AdminMainLayout.jsx
import React, { useState } from 'react';
import { Outlet, useNavigate, NavLink } from 'react-router-dom';
import { Menu, BarChart3, Activity, Users, Settings, FileText, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import Sidebar from './Sidebar';

const AdminMainLayout = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
  };

  const navItems = [
    { path: '/admin/dashboard', label: 'Dashboard', icon: BarChart3 },
    { path: '/admin/jobs', label: 'Job Monitor', icon: Activity },
    { path: '/admin/users', label: 'User Management', icon: Users },
    { path: '/admin/audit-logs', label: 'Audit Logs', icon: FileText },
    { path: '/admin/config', label: 'System Config', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar (Mobile Only) */}
      <Sidebar
        navItems={navItems}
        isSidebarOpen={isSidebarOpen}
        setSidebarOpen={setSidebarOpen}
        handleLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between bg-white p-4 border-b h-16 shadow-sm">
          {/* Left: Hamburger (Mobile) / Logo (Desktop) */}
          <div className="flex items-center">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 md:hidden"
              aria-label="Open sidebar"
            >
              <Menu size={24} />
            </button>
            <div className="ml-4 hidden md:flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
                <Menu className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">FileTools</h1>
                <p className="text-sm text-gray-500">Admin Panel</p>
              </div>
            </div>
          </div>

          {/* Center: Mobile Title / Desktop Navigation */}
          <div className="flex-1 flex items-center justify-center">
            <h1 className="text-xl font-bold text-gray-900 md:hidden">Admin Panel</h1>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex space-x-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`
                  }
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* Right: Desktop Logout */}
          <div className="hidden md:block">
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-lg text-red-600 hover:bg-red-50 hover:text-red-800 transition-colors duration-200 font-medium"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminMainLayout;