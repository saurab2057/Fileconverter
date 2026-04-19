// src/components/layout/Header/DesktopNav.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Archive, ChevronDown, Sparkles } from 'lucide-react';
// Tool Registry imports for Convert & Compress (unchanged)
import {
  conversionTools,
  compressionTools,
  conversionCategories as convCats,
  compressionCategories as compCats
} from '@/lib/toolRegistry';

// Map category IDs to icons and colors
const categoryIconMap = {
  'video-audio': RefreshCw, // placeholder, will be overridden per category
  'image': RefreshCw,
  'gif': RefreshCw,
  'pdf': RefreshCw,
  'video': RefreshCw,
  'audio': RefreshCw,
};

const categoryColorMap = {
  'video-audio': 'text-blue-400',
  'image': 'text-purple-400',
  'pdf': 'text-red-400',
  'gif': 'text-green-400',
  'others': 'text-orange-400',
  'video': 'text-blue-400',
  'audio': 'text-purple-400',
};

// Build convert categories (same as before)
const convertCategories = convCats.map(cat => {
  const IconComp = categoryIconMap[cat.id] || RefreshCw;
  return {
    id: cat.id,
    icon: IconComp,
    title: cat.label,
    color: categoryColorMap[cat.id] || 'text-gray-400',
    items: conversionTools
      .filter(t => t.category === cat.id)
      .map(t => ({
        name: t.title,
        path: `/convert/${t.fromFormat}/${t.toFormat}`,
      })),
  };
});

const compressCategories = compCats.map(cat => {
  const IconComp = categoryIconMap[cat.id] || Archive;
  return {
    id: cat.id,
    icon: IconComp,
    title: cat.label,
    color: categoryColorMap[cat.id] || 'text-gray-400',
    items: compressionTools
      .filter(t => t.category === cat.id)
      .map(t => ({
        name: t.title,
        path: `/compress/${t.type}`,
      })),
  };
});

const DesktopNav = ({
  isConvertDropdownOpen,
  toggleConvertDropdown,
  isCompressDropdownOpen,
  toggleCompressDropdown,
  isAIDropdownOpen,
  toggleAIDropdown,
  closeAllDropdowns
}) => {
  return (
    <nav className="hidden md:flex items-center">
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
            style={{ transform: 'translateX(-25%)' }}
          >
            <div className="p-6 grid grid-cols-4">
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
            style={{ transform: 'translateX(-40%)' }}
          >
            <div className="p-6 grid grid-cols-3">
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

      {/* AI Tools Dropdown (NEW) */}
      <div className="relative">
        <button
          onClick={toggleAIDropdown}
          className="flex items-center space-x-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 rounded-md text-sm font-medium"
          aria-haspopup="true"
          aria-expanded={isAIDropdownOpen}
          aria-controls="ai-menu-desktop"
        >
          <Sparkles className="w-4 h-4" />
          <span>AI Tools</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${isAIDropdownOpen ? 'rotate-180' : ''}`} />
        </button>
        {isAIDropdownOpen && (
          <div
            id="ai-menu-desktop"
            className="absolute top-full mt-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50"
            style={{ transform: 'translateX(-25%)' }}
          >
            <div className="py-2">
              <Link
                to="/ai/summarizer"
                className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400"
                onClick={closeAllDropdowns}
              >
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-yellow-500" />
                  <span>Summarizer</span>
                </div>
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default DesktopNav;