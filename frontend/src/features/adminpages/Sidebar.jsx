// src/features/adminpages/Sidebar.jsx
import React from 'react';
import { NavLink } from 'react-router-dom';
import { X, LogOut } from 'lucide-react';

const Sidebar = ({ navItems, isSidebarOpen, setSidebarOpen, handleLogout }) => {
  const handleNavClick = () => {
    if (window.innerWidth < 768) {
      setTimeout(() => setSidebarOpen(false), 150);
    }
  };

  return (
    <div
      className={`fixed left-0 top-0 h-full w-64 bg-white shadow-lg border-r border-gray-200 z-50 transform transition-transform duration-300 ease-in-out ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } md:hidden`}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <div className="text-xl font-bold text-gray-900">FileTools</div>
          <div className="text-xs text-gray-500">Admin Panel</div>
        </div>
        <button
          onClick={() => setSidebarOpen(false)}
          className="p-2 hover:bg-gray-100 rounded-lg"
          aria-label="Close sidebar"
        >
          <X size={24} className="text-gray-600" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="p-4 flex-1">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                onClick={handleNavClick}
                className={({ isActive }) =>
                  `w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 border-r-4 border-blue-600 font-medium'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`
                }
              >
                <item.icon className={`w-5 h-5`} />
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <button
          onClick={handleLogout}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors text-red-600 hover:bg-red-50 hover:text-red-800 font-medium"
        >
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;