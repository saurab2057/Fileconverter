import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  RefreshCw, Archive, ChevronDown, ChevronRight, Video,
  Image, FileText, Calculator, X, LayoutDashboard
} from 'lucide-react';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { useAuth } from '@/lib/AuthContext';

const Header = () => {

  const [isConvertDropdownOpen, setIsConvertDropdownOpen] = useState(false);
  const [isCompressDropdownOpen, setIsCompressDropdownOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mobileConvertOpen, setMobileConvertOpen] = useState(false);
  const [mobileCompressOpen, setMobileCompressOpen] = useState(false);
  const [mobileVideoOpen, setMobileVideoOpen] = useState(false);
  const [mobileImageOpen, setMobileImageOpen] = useState(false);
  const [mobilePdfOpen, setMobilePdfOpen] = useState(false);
  const [mobileGifOpen, setMobileGifOpen] = useState(false);
  const [mobileOthersOpen, setMobileOthersOpen] = useState(false);
  const [mobileCompressVideoOpen, setMobileCompressVideoOpen] = useState(false);
  const [mobileCompressImageOpen, setMobileCompressImageOpen] = useState(false);
  const [mobileCompressGifOpen, setMobileCompressGifOpen] = useState(false);

  const { isAuthenticated, logout, user } = useAuth();
  const navigate = useNavigate();

  const toggleMobileConvert = () => { setMobileConvertOpen(!mobileConvertOpen); setMobileCompressOpen(false); };
  const toggleMobileCompress = () => { setMobileCompressOpen(!mobileCompressOpen); setMobileConvertOpen(false); };
  const closeAllDropdowns = () => { setIsConvertDropdownOpen(false); setIsCompressDropdownOpen(false); setIsProfileDropdownOpen(false); };
  const toggleConvertDropdown = () => { setIsProfileDropdownOpen(false); setIsCompressDropdownOpen(false); setIsConvertDropdownOpen(prev => !prev); };
  const toggleCompressDropdown = () => { setIsProfileDropdownOpen(false); setIsConvertDropdownOpen(false); setIsCompressDropdownOpen(prev => !prev); };
  const toggleProfileDropdown = () => { setIsConvertDropdownOpen(false); setIsCompressDropdownOpen(false); setIsProfileDropdownOpen(prev => !prev); };
  const toggleMobileMenu = () => { setIsMobileMenuOpen(!isMobileMenuOpen); };

  const handleLogout = () => {
    logout();
    closeAllDropdowns();
    if (isMobileMenuOpen) toggleMobileMenu();
    navigate('/');
  };

  // ── NAV DATA ─────────────────────────────────────────────────────────────
  // Convert paths: /convert/:from/:to
  // Compress paths: /compress/:type
  const convertCategories = [
    {
      id: "convert-video",
      icon: Video,
      title: "Video & Audio",
      color: "text-blue-400",
      items: [
        { name: "MP3 to WAV",    path: "/convert/mp3/wav"  },
        { name: "Video to MP3",  path: "/convert/mp4/mp3"  },
        { name: "Video to AAC",  path: "/convert/mp4/aac"  },
        { name: "MP4 to MP3",    path: "/convert/mp4/mp3"  },
        { name: "MOV to MP4",    path: "/convert/mov/mp4"  },
        { name: "MP4 to WebM",   path: "/convert/mp4/webm" },
        { name: "MKV to MP4",    path: "/convert/mkv/mp4"  },
      ]
    },
    {
      id: "convert-image",
      icon: Image,
      title: "Image",
      color: "text-purple-400",
      items: [
        { name: "WEBP to PNG", path: "/convert/webp/png" },
        { name: "JFIF to PNG", path: "/convert/jfif/png" },
        { name: "PNG to SVG",  path: "/convert/png/svg"  },
        { name: "WEBP to JPG", path: "/convert/webp/jpg" },
      ]
    },
    {
      id: "convert-pdf",
      icon: FileText,
      title: "PDF & Documents",
      color: "text-red-400",
      items: [
        { name: "PDF Converter",      path: "#" },
        { name: "Document Converter", path: "#" },
        { name: "PDF to Word",        path: "#" },
        { name: "PDF to JPG",         path: "/convert/pdf/jpg" },
        { name: "EPUB to PDF",        path: "#" },
        { name: "JPG to PDF",         path: "#" },
      ]
    },
    {
      id: "convert-gif",
      icon: Image,
      title: "GIF",
      color: "text-green-400",
      items: [
        { name: "Video to GIF", path: "/convert/mov/gif"  },
        { name: "MP4 to GIF",   path: "/convert/mp4/gif"  },
        { name: "WEBM to GIF",  path: "/convert/webm/gif" },
        { name: "GIF to MP4",   path: "/convert/gif/mp4"  },
        { name: "GIF to APNG",  path: "#" },
      ]
    },
    {
      id: "convert-others",
      icon: Calculator,
      title: "Others",
      color: "text-orange-400",
      items: [
        { name: "Time Converter", path: "#" },
        { name: "Summarizer",     path: "/pdf-to-summary" },
      ]
    }
  ];

  const compressCategories = [
    {
      id: "compress-video",
      icon: Video,
      title: "Video & Audio",
      color: "text-blue-400",
      items: [
        { name: "Video Compressor", path: "/compress/video" },
        { name: "MP3 Compressor",   path: "/compress/mp3"   },
        { name: "WAV Compressor",   path: "/compress/wav"   },
      ]
    },
    {
      id: "compress-image",
      icon: Image,
      title: "Image",
      color: "text-purple-400",
      items: [
        { name: "Image Compressor", path: "/compress/image" },
        { name: "JPEG Compressor",  path: "/compress/jpeg"  },
        { name: "PNG Compressor",   path: "/compress/png"   },
      ]
    },
    {
      id: "compress-gif",
      icon: Image,
      title: "GIF",
      color: "text-green-400",
      items: [
        { name: "GIF Compressor", path: "/compress/gif" },
      ]
    }
  ];

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
          <nav className="hidden md:flex items-center space-x-8">

            {/* Convert Dropdown */}
            <div className="relative">
              <button
                onClick={toggleConvertDropdown}
                className="flex items-center space-x-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 rounded-md text-sm font-medium"
                aria-haspopup="true"
                aria-expanded={isConvertDropdownOpen}
                aria-controls="convert-menu-desktop"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Convert</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isConvertDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {isConvertDropdownOpen && (
                <div
                  id="convert-menu-desktop"
                  className="absolute top-full mt-2 w-screen max-w-5xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50"
                  style={{ transform: 'translateX(-40%)' }}
                >
                  <div className="p-6 grid grid-cols-5 gap-6">
                    {convertCategories.map(cat => (
                      <div key={cat.title}>
                        <h3 className="flex items-center space-x-2 text-sm font-semibold text-gray-900 dark:text-white mb-3">
                          <cat.icon className={`w-4 h-4 ${cat.color}`} />
                          <span>{cat.title}</span>
                        </h3>
                        <ul className="space-y-2">
                          {cat.items.map(item => (
                            <li key={item.name}>
                              <Link to={item.path} className="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400" onClick={closeAllDropdowns}>
                                {item.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Compress Dropdown */}
            <div className="relative">
              <button
                onClick={toggleCompressDropdown}
                className="flex items-center space-x-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 rounded-md text-sm font-medium"
                aria-haspopup="true"
                aria-expanded={isCompressDropdownOpen}
                aria-controls="compress-menu-desktop"
              >
                <Archive className="w-4 h-4" />
                <span>Compress</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isCompressDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {isCompressDropdownOpen && (
                <div
                  id="compress-menu-desktop"
                  className="absolute top-full mt-2 w-screen max-w-3xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50"
                  style={{ transform: 'translateX(-50%)' }}
                >
                  <div className="p-6 grid grid-cols-3 gap-6">
                    {compressCategories.map(cat => (
                      <div key={cat.title}>
                        <h3 className="flex items-center space-x-2 text-sm font-semibold text-gray-900 dark:text-white mb-3">
                          <cat.icon className={`w-4 h-4 ${cat.color}`} />
                          <span>{cat.title}</span>
                        </h3>
                        <ul className="space-y-2">
                          {cat.items.map(item => (
                            <li key={item.name}>
                              <Link to={item.path} className="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400" onClick={closeAllDropdowns}>
                                {item.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </nav>

          {/* RIGHT: Theme + Auth */}
          <div className="flex items-center space-x-2 sm:space-x-4">
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
                        src={user.profilePictureUrl}
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
          <div id="mobile-menu" data-testid="mobile-menu" className="md:hidden border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 absolute left-0 right-0 top-full z-40 shadow-lg">
            <div className="px-4 py-4 space-y-2 max-h-[calc(100vh-4rem)] overflow-y-auto">

              {/* Convert (Mobile) */}
              <div>
                <button className="flex items-center justify-between w-full text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 hover:bg-gray-50 dark:hover:bg-gray-800" onClick={toggleMobileConvert} aria-expanded={mobileConvertOpen} aria-controls="convert-menu-mobile">
                  <div className="flex items-center space-x-2"><RefreshCw className="w-4 h-4" /><span>Convert</span></div>
                  <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${mobileConvertOpen ? 'rotate-90' : ''}`} />
                </button>
                {mobileConvertOpen && (
                  <div id="convert-menu-mobile" className="ml-6 mt-2 space-y-2">
                    {convertCategories.map((category) => (
                      <div key={category.title}>
                        <button
                          className="flex items-center justify-between w-full text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 rounded-md text-sm transition-colors duration-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                          onClick={() => {
                            if (category.title === "Video & Audio") setMobileVideoOpen(!mobileVideoOpen);
                            else if (category.title === "Image") setMobileImageOpen(!mobileImageOpen);
                            else if (category.title === "PDF & Documents") setMobilePdfOpen(!mobilePdfOpen);
                            else if (category.title === "GIF") setMobileGifOpen(!mobileGifOpen);
                            else if (category.title === "Others") setMobileOthersOpen(!mobileOthersOpen);
                            if (category.title !== "Video & Audio") setMobileVideoOpen(false);
                            if (category.title !== "Image") setMobileImageOpen(false);
                            if (category.title !== "PDF & Documents") setMobilePdfOpen(false);
                            if (category.title !== "GIF") setMobileGifOpen(false);
                            if (category.title !== "Others") setMobileOthersOpen(false);
                          }}
                          aria-expanded={(category.title === "Video & Audio" && mobileVideoOpen) || (category.title === "Image" && mobileImageOpen) || (category.title === "PDF & Documents" && mobilePdfOpen) || (category.title === "GIF" && mobileGifOpen) || (category.title === "Others" && mobileOthersOpen)}
                          aria-controls={`mobile-menu-${category.id}`}
                        >
                          <div className="flex items-center space-x-2">
                            <category.icon className={`w-4 h-4 ${category.color}`} />
                            <span>{category.title}</span>
                          </div>
                          <ChevronRight className={`w-3 h-3 transition-transform duration-200 ${((category.title === "Video & Audio" && mobileVideoOpen) || (category.title === "Image" && mobileImageOpen) || (category.title === "PDF & Documents" && mobilePdfOpen) || (category.title === "GIF" && mobileGifOpen) || (category.title === "Others" && mobileOthersOpen)) ? 'rotate-90' : ''}`} />
                        </button>
                        {((category.title === "Video & Audio" && mobileVideoOpen) || (category.title === "Image" && mobileImageOpen) || (category.title === "PDF & Documents" && mobilePdfOpen) || (category.title === "GIF" && mobileGifOpen) || (category.title === "Others" && mobileOthersOpen)) && (
                          <div id={`mobile-menu-${category.id}`} className="ml-6 mt-1 space-y-1">
                            {category.items.map((item) => (
                              <Link key={item.name} to={item.path} className="block text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-1 rounded transition-colors duration-200" onClick={toggleMobileMenu}>
                                {item.name}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Compress (Mobile) */}
              <div>
                <button className="flex items-center justify-between w-full text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 hover:bg-gray-50 dark:hover:bg-gray-800" onClick={toggleMobileCompress} aria-expanded={mobileCompressOpen} aria-controls="compress-menu-mobile">
                  <div className="flex items-center space-x-2"><Archive className="w-4 h-4" /><span>Compress</span></div>
                  <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${mobileCompressOpen ? 'rotate-90' : ''}`} />
                </button>
                {mobileCompressOpen && (
                  <div id="compress-menu-mobile" className="ml-6 mt-2 space-y-2">
                    {compressCategories.map((category) => (
                      <div key={category.title}>
                        <button
                          className="flex items-center justify-between w-full text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 rounded-md text-sm transition-colors duration-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                          onClick={() => {
                            if (category.title === "Video & Audio") setMobileCompressVideoOpen(!mobileCompressVideoOpen);
                            else if (category.title === "Image") setMobileCompressImageOpen(!mobileCompressImageOpen);
                            else if (category.title === "GIF") setMobileCompressGifOpen(!mobileCompressGifOpen);
                            if (category.title !== "Video & Audio") setMobileCompressVideoOpen(false);
                            if (category.title !== "Image") setMobileCompressImageOpen(false);
                            if (category.title !== "GIF") setMobileCompressGifOpen(false);
                          }}
                          aria-expanded={(category.title === "Video & Audio" && mobileCompressVideoOpen) || (category.title === "Image" && mobileCompressImageOpen) || (category.title === "GIF" && mobileCompressGifOpen)}
                          aria-controls={`mobile-menu-${category.id}`}
                        >
                          <div className="flex items-center space-x-2">
                            <category.icon className={`w-4 h-4 ${category.color}`} />
                            <span>{category.title}</span>
                          </div>
                          <ChevronRight className={`w-3 h-3 transition-transform duration-200 ${((category.title === "Video & Audio" && mobileCompressVideoOpen) || (category.title === "Image" && mobileCompressImageOpen) || (category.title === "GIF" && mobileCompressGifOpen)) ? 'rotate-90' : ''}`} />
                        </button>
                        {((category.title === "Video & Audio" && mobileCompressVideoOpen) || (category.title === "Image" && mobileCompressImageOpen) || (category.title === "GIF" && mobileCompressGifOpen)) && (
                          <div id={`mobile-menu-${category.id}`} className="ml-6 mt-1 space-y-1">
                            {category.items.map((item) => (
                              <Link key={item.name} to={item.path} className="block text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-1 rounded transition-colors duration-200" onClick={toggleMobileMenu}>
                                {item.name}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Auth (Mobile) */}
              {!isAuthenticated && (
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700 space-y-2">
                  <Link to="/login" onClick={toggleMobileMenu} className="flex items-center space-x-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 rounded-md text-base font-medium w-full hover:bg-gray-50 dark:hover:bg-gray-800">
                    <span>Login</span>
                  </Link>
                  <Link to="/signup" onClick={toggleMobileMenu} className="flex items-center space-x-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 rounded-md text-base font-medium w-full hover:bg-gray-50 dark:hover:bg-gray-800">
                    <span>SignUp</span>
                  </Link>
                </div>
              )}

            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;