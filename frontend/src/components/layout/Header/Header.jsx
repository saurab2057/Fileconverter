// src/components/layout/Header/Header.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { X, LayoutDashboard } from 'lucide-react';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { useAuth } from '@/lib/AuthContext';
import DesktopNav from './DesktopNav';
import MobileMenu from './MobileMenu';

const Header = () => {
  const [isConvertDropdownOpen, setIsConvertDropdownOpen] = useState(false);
  const [isCompressDropdownOpen, setIsCompressDropdownOpen] = useState(false);
  const [isAIDropdownOpen, setIsAIDropdownOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const { isAuthenticated, logout, user } = useAuth();
  const navigate = useNavigate();

  const closeAllDropdowns = () => {
    setIsConvertDropdownOpen(false);
    setIsCompressDropdownOpen(false);
    setIsAIDropdownOpen(false);
    setIsProfileDropdownOpen(false);
  };

  const toggleConvertDropdown = () => {
    setIsProfileDropdownOpen(false);
    setIsCompressDropdownOpen(false);
    setIsAIDropdownOpen(false);
    setIsConvertDropdownOpen(prev => !prev);
  };

  const toggleCompressDropdown = () => {
    setIsProfileDropdownOpen(false);
    setIsConvertDropdownOpen(false);
    setIsAIDropdownOpen(false);
    setIsCompressDropdownOpen(prev => !prev);
  };

  const toggleAIDropdown = () => {
    setIsProfileDropdownOpen(false);
    setIsConvertDropdownOpen(false);
    setIsCompressDropdownOpen(false);
    setIsAIDropdownOpen(prev => !prev);
  };

  const toggleProfileDropdown = () => {
    setIsConvertDropdownOpen(false);
    setIsCompressDropdownOpen(false);
    setIsAIDropdownOpen(false);
    setIsProfileDropdownOpen(prev => !prev);
  };

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  const handleLogout = () => {
    logout();
    closeAllDropdowns();
    if (isMobileMenuOpen) toggleMobileMenu();
    navigate('/');
  };

  return (
    <header className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">

          {/* LEFT: Hamburger + Logo */}
          <div className="flex items-center space-x-4">
            <div className="md:hidden">
              <button
                className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white p-2 rounded-md"
                onClick={toggleMobileMenu}
                aria-label={isMobileMenuOpen ? "Close main menu" : "Open main menu"}
                aria-expanded={isMobileMenuOpen}
                aria-controls="mobile-menu"
              >
                {isMobileMenuOpen
                  ? <X className="w-6 h-6" />
                  : <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                }
              </button>
            </div>
            <Link to="/" className="flex items-center gap-1 text-2xl font-bold text-gray-900 dark:text-white">
              <img src="/FileTools.png" alt="FileTools Logo" className="w-7 h-7" />
              <span>FileTools</span>
            </Link>
          </div>

          {/* MIDDLE: Desktop Nav */}
          <DesktopNav
            isConvertDropdownOpen={isConvertDropdownOpen}
            toggleConvertDropdown={toggleConvertDropdown}
            isCompressDropdownOpen={isCompressDropdownOpen}
            toggleCompressDropdown={toggleCompressDropdown}
            isAIDropdownOpen={isAIDropdownOpen}
            toggleAIDropdown={toggleAIDropdown}
            closeAllDropdowns={closeAllDropdowns}
          />

          {/* RIGHT: Theme + Auth */}
          <div className="flex items-center md:space-x-0.5 sm:space-x-6">
            <ThemeToggle />
            {isAuthenticated && user ? (
              <>
                <Link to="/dashboard" className="hidden md:flex items-center space-x-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800">
                  <span>Dashboard</span>
                </Link>
                <Link to="/dashboard" className="md:hidden p-2 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Go to Dashboard">
                  <LayoutDashboard className="w-5 h-5" />
                </Link>
                <div className="relative">
                  <button
                    onClick={toggleProfileDropdown}
                    className="flex items-center space-x-2 p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
                    aria-label="Open user menu"
                    aria-haspopup="true"
                    aria-expanded={isProfileDropdownOpen}
                    aria-controls="profile-menu"
                  >
                    {user && user.profilePictureUrl ? (
                      <img
                        src={user.profilePictureUrl.replace('/upload/', '/upload/w_80,h_80,c_fill/')}
                        alt="Profile"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.target.onerror = null;
                          const initials = encodeURIComponent(user.name.charAt(0).toUpperCase());
                          e.target.src = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'><rect width='32' height='32' rx='16' fill='%230D8ABC'/><text x='16' y='22' text-anchor='middle' font-size='16' fill='white' font-family='Arial'>${initials}</text></svg>`;
                        }}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : user ? (
                      <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                    ) : null}
                  </button>
                  {isProfileDropdownOpen && (
                    <div id="profile-menu" className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-20">
                      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-600">
                        <p className="text-sm text-gray-600 dark:text-gray-400 truncate">Signed in as</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.email}</p>
                      </div>
                      <button onClick={handleLogout} className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                        <span>Logout</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="hidden md:flex items-center space-x-2">
                <Link to="/login" className="flex items-center space-x-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800">
                  <span>Login</span>
                </Link>
                <Link to="/signup" className="flex items-center space-x-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800">
                  <span>SignUp</span>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* MOBILE MENU PANEL */}
        {isMobileMenuOpen && (
          <MobileMenu
            isAuthenticated={isAuthenticated}
            toggleMobileMenu={toggleMobileMenu}
          />
        )}
      </div>
    </header>
  );
};

export default Header;