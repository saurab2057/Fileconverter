import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import AdminDashboard from '@/features/adminpages/AdminDashboard';
import JobMonitor from '@/features/adminpages/JobMonitor';
import UserManagement from '@/features/adminpages/UserManagement/index';
import SystemConfig from '@/features/adminpages/SystemConfig';
import LogsManager from '@/features/adminpages/logs/index'; // 🔒 CRITICAL ADDITION
import Sidebar from '@/features/adminpages/Sidebar';

const AdminMainLayout = () => {
  // Initialize activeTab from localStorage (includes 'audit-logs' support)
  const [activeTab, setActiveTab] = useState(() => {
    const savedTab = localStorage.getItem('adminActiveTab');
    return savedTab || 'dashboard';
  });

  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const { user, authLoading, logout } = useAuth();
  const navigate = useNavigate();

  // Save activeTab to localStorage on change
  useEffect(() => {
    localStorage.setItem('adminActiveTab', activeTab);
  }, [activeTab]);

  const handleLogout = () => {
    localStorage.removeItem('adminActiveTab');
    logout();
  };

  // 🔒 RENDER CONTENT BASED ON ACTIVE TAB (ADDED audit-logs CASE)
  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <AdminDashboard />;
      case 'jobs': return <JobMonitor />;
      case 'users': return <UserManagement />;
      case 'audit-logs': return <LogsManager />; // 🔒 CRITICAL ADDITION
      case 'config': return <SystemConfig />;
      default: return <AdminDashboard />; // Fallback
    }
  };

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
        activeTab={activeTab}
        setActiveTab={setActiveTab}
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
            
            {/* 🔒 DESKTOP NAVIGATION (FIXED TYPOS + ADDED AUDIT LOGS) */}
            <nav className="hidden md:flex space-x-4 text-sm font-medium">
              {[
                { id: 'dashboard', label: 'Dashboard' },
                { id: 'jobs', label: 'Job Monitor' },
                { id: 'users', label: 'User Management' },
                { id: 'audit-logs', label: 'Audit Logs' }, // 🔒 CRITICAL ADDITION
                { id: 'config', label: 'System Config' }
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`px-3 py-2 rounded-lg transition-colors duration-200 ${
                    activeTab === item.id 
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600' 
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  {item.label}
                </button>
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
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default AdminMainLayout;