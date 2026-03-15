import React from 'react';
import { BarChart3, Activity, Users, Settings, X, FileText, LogOut } from 'lucide-react'; // 🔒 ADDED FileText + LogOut icons

// --- UPDATED: Sidebar now accepts handleLogout prop ---
const Sidebar = ({ activeTab, setActiveTab, isSidebarOpen, setSidebarOpen, handleLogout }) => {
  // 🔒 UPDATED MENU ITEMS (Added Audit Logs)
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'jobs', label: 'Job Monitor', icon: Activity },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'audit-logs', label: 'Audit Logs', icon: FileText }, // 🔒 CRITICAL ADDITION
    { id: 'config', label: 'Configuration', icon: Settings }
  ];

  const handleMenuClick = (itemId) => {
    setActiveTab(itemId);
    // Auto-hide sidebar after selection on mobile
    if (window.innerWidth < 768) {
      setTimeout(() => {
        setSidebarOpen(false);
      }, 150);
    }
  };

  return (
    // 🔒 Root div: Hidden on desktop (md:hidden), mobile slide-in
    <div 
      className={`fixed left-0 top-0 h-full w-64 bg-white shadow-lg border-r border-gray-200 z-50 transform transition-transform duration-300 ease-in-out ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } md:hidden`}
    >
      {/* Header with close button */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <div className="text-xl font-bold text-gray-900">FileTools</div>
          <div className="text-xs text-gray-500">Admin Panel</div>
        </div>
        <button 
          onClick={() => setSidebarOpen(false)} 
          className="p-2 hover:bg-gray-100 rounded-lg md:hidden"
          aria-label="Close sidebar"
        >
          <X size={24} className="text-gray-600" />
        </button>
      </div>

      {/* Navigation menu */}
      <nav className="p-4 flex-1">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <button
                  onClick={() => handleMenuClick(item.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${
                    activeTab === item.id
                      ? 'bg-blue-50 text-blue-700 border-r-4 border-blue-600 font-medium'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${activeTab === item.id ? 'text-blue-600' : 'text-gray-500'}`} />
                  <span>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Logout button (mobile only) */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <button
          onClick={handleLogout}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors text-red-600 hover:bg-red-50 hover:text-red-800 font-medium"
        >
          <LogOut className="w-5 h-5" /> {/* 🔒 FIXED: Proper logout icon */}
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;