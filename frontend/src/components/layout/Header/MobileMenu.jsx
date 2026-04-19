// src/components/layout/Header/MobileMenu.jsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Archive, ChevronRight, Sparkles } from 'lucide-react';
// Tool Registry imports (same as DesktopNav)
import {
  conversionTools,
  compressionTools,
  conversionCategories as convCats,
  compressionCategories as compCats
} from '@/lib/toolRegistry';

const categoryIconMap = {
  'video-audio': RefreshCw,
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

const MobileMenu = ({ isAuthenticated, toggleMobileMenu }) => {
  const [mobileConvertOpen, setMobileConvertOpen] = useState(false);
  const [mobileCompressOpen, setMobileCompressOpen] = useState(false);
  const [mobileAIOpen, setMobileAIOpen] = useState(false);

  // Subcategory states for Convert
  const [mobileVideoOpen, setMobileVideoOpen] = useState(false);
  const [mobileImageOpen, setMobileImageOpen] = useState(false);
  const [mobilePdfOpen, setMobilePdfOpen] = useState(false);
  const [mobileGifOpen, setMobileGifOpen] = useState(false);
  const [mobileOthersOpen, setMobileOthersOpen] = useState(false);

  // Subcategory states for Compress
  const [mobileCompressVideoOpen, setMobileCompressVideoOpen] = useState(false);
  const [mobileCompressImageOpen, setMobileCompressImageOpen] = useState(false);
  const [mobileCompressGifOpen, setMobileCompressGifOpen] = useState(false);

  const toggleMobileConvert = () => {
    setMobileConvertOpen(!mobileConvertOpen);
    setMobileCompressOpen(false);
    setMobileAIOpen(false);
  };
  const toggleMobileCompress = () => {
    setMobileCompressOpen(!mobileCompressOpen);
    setMobileConvertOpen(false);
    setMobileAIOpen(false);
  };
  const toggleMobileAI = () => {
    setMobileAIOpen(!mobileAIOpen);
    setMobileConvertOpen(false);
    setMobileCompressOpen(false);
  };

  const handleSubmenuToggle = (categoryTitle) => {
    if (categoryTitle === "Video & Audio") setMobileVideoOpen(!mobileVideoOpen);
    else if (categoryTitle === "Image") setMobileImageOpen(!mobileImageOpen);
    else if (categoryTitle === "PDF & Documents") setMobilePdfOpen(!mobilePdfOpen);
    else if (categoryTitle === "GIF") setMobileGifOpen(!mobileGifOpen);
    else if (categoryTitle === "Others") setMobileOthersOpen(!mobileOthersOpen);
  };

  const handleCompressSubmenuToggle = (categoryTitle) => {
    if (categoryTitle === "Video & Audio") setMobileCompressVideoOpen(!mobileCompressVideoOpen);
    else if (categoryTitle === "Image") setMobileCompressImageOpen(!mobileCompressImageOpen);
    else if (categoryTitle === "GIF") setMobileCompressGifOpen(!mobileCompressGifOpen);
  };

  const closeMobileMenu = () => {
    toggleMobileMenu();
  };

  return (
    <div id="mobile-menu" data-testid="mobile-menu" className="md:hidden border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 absolute left-0 right-0 top-full z-40 shadow-lg">
      <div className="px-4 py-4 space-y-2 max-h-[calc(100vh-4rem)] overflow-y-auto">

        {/* Convert (Mobile) */}
        <div>
          <button
            className="flex items-center justify-between w-full text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 hover:bg-gray-50 dark:hover:bg-gray-800"
            onClick={toggleMobileConvert}
            aria-expanded={mobileConvertOpen}
            aria-controls="convert-menu-mobile"
          >
            <div className="flex items-center space-x-2"><RefreshCw className="w-4 h-4" /><span>Convert</span></div>
            <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${mobileConvertOpen ? 'rotate-90' : ''}`} />
          </button>
          {mobileConvertOpen && (
            <div id="convert-menu-mobile" className="ml-6 mt-2 space-y-2">
              {convertCategories.map((category) => (
                <div key={category.title}>
                  <button
                    className="flex items-center justify-between w-full text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 rounded-md text-sm transition-colors duration-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                    onClick={() => handleSubmenuToggle(category.title)}
                    aria-expanded={
                      (category.title === "Video & Audio" && mobileVideoOpen) ||
                      (category.title === "Image" && mobileImageOpen) ||
                      (category.title === "PDF & Documents" && mobilePdfOpen) ||
                      (category.title === "GIF" && mobileGifOpen) ||
                      (category.title === "Others" && mobileOthersOpen)
                    }
                    aria-controls={`mobile-menu-${category.id}`}
                  >
                    <div className="flex items-center space-x-2">
                      <category.icon className={`w-4 h-4 ${category.color}`} />
                      <span>{category.title}</span>
                    </div>
                    <ChevronRight className={`w-3 h-3 transition-transform duration-200 ${
                      ((category.title === "Video & Audio" && mobileVideoOpen) ||
                       (category.title === "Image" && mobileImageOpen) ||
                       (category.title === "PDF & Documents" && mobilePdfOpen) ||
                       (category.title === "GIF" && mobileGifOpen) ||
                       (category.title === "Others" && mobileOthersOpen)) ? 'rotate-90' : ''
                    }`} />
                  </button>
                  {((category.title === "Video & Audio" && mobileVideoOpen) ||
                    (category.title === "Image" && mobileImageOpen) ||
                    (category.title === "PDF & Documents" && mobilePdfOpen) ||
                    (category.title === "GIF" && mobileGifOpen) ||
                    (category.title === "Others" && mobileOthersOpen)) && (
                    <div id={`mobile-menu-${category.id}`} className="ml-6 mt-1 space-y-1">
                      {category.items.map((item) => (
                        <Link key={item.name} to={item.path} className="block text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-1 rounded transition-colors duration-200" onClick={closeMobileMenu}>
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
          <button
            className="flex items-center justify-between w-full text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 hover:bg-gray-50 dark:hover:bg-gray-800"
            onClick={toggleMobileCompress}
            aria-expanded={mobileCompressOpen}
            aria-controls="compress-menu-mobile"
          >
            <div className="flex items-center space-x-2"><Archive className="w-4 h-4" /><span>Compress</span></div>
            <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${mobileCompressOpen ? 'rotate-90' : ''}`} />
          </button>
          {mobileCompressOpen && (
            <div id="compress-menu-mobile" className="ml-6 mt-2 space-y-2">
              {compressCategories.map((category) => (
                <div key={category.title}>
                  <button
                    className="flex items-center justify-between w-full text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 rounded-md text-sm transition-colors duration-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                    onClick={() => handleCompressSubmenuToggle(category.title)}
                    aria-expanded={
                      (category.title === "Video & Audio" && mobileCompressVideoOpen) ||
                      (category.title === "Image" && mobileCompressImageOpen) ||
                      (category.title === "GIF" && mobileCompressGifOpen)
                    }
                    aria-controls={`mobile-menu-${category.id}`}
                  >
                    <div className="flex items-center space-x-2">
                      <category.icon className={`w-4 h-4 ${category.color}`} />
                      <span>{category.title}</span>
                    </div>
                    <ChevronRight className={`w-3 h-3 transition-transform duration-200 ${
                      ((category.title === "Video & Audio" && mobileCompressVideoOpen) ||
                       (category.title === "Image" && mobileCompressImageOpen) ||
                       (category.title === "GIF" && mobileCompressGifOpen)) ? 'rotate-90' : ''
                    }`} />
                  </button>
                  {((category.title === "Video & Audio" && mobileCompressVideoOpen) ||
                    (category.title === "Image" && mobileCompressImageOpen) ||
                    (category.title === "GIF" && mobileCompressGifOpen)) && (
                    <div id={`mobile-menu-${category.id}`} className="ml-6 mt-1 space-y-1">
                      {category.items.map((item) => (
                        <Link key={item.name} to={item.path} className="block text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-1 rounded transition-colors duration-200" onClick={closeMobileMenu}>
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

        {/* AI Tools (Mobile) NEW */}
        <div>
          <button
            className="flex items-center justify-between w-full text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 hover:bg-gray-50 dark:hover:bg-gray-800"
            onClick={toggleMobileAI}
            aria-expanded={mobileAIOpen}
            aria-controls="ai-menu-mobile"
          >
            <div className="flex items-center space-x-2"><Sparkles className="w-4 h-4" /><span>AI Tools</span></div>
            <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${mobileAIOpen ? 'rotate-90' : ''}`} />
          </button>
          {mobileAIOpen && (
            <div id="ai-menu-mobile" className="ml-6 mt-2 space-y-1">
              <Link
                to="/ai/summarizer"
                className="block text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-1 rounded transition-colors duration-200"
                onClick={closeMobileMenu}
              >
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-yellow-500" />
                  <span>Summarizer</span>
                </div>
              </Link>
            </div>
          )}
        </div>

        {/* Auth (Mobile) */}
        {!isAuthenticated && (
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700 space-y-2">
            <Link to="/login" onClick={closeMobileMenu} className="flex items-center space-x-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 rounded-md text-base font-medium w-full hover:bg-gray-50 dark:hover:bg-gray-800">
              <span>Login</span>
            </Link>
            <Link to="/signup" onClick={closeMobileMenu} className="flex items-center space-x-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 rounded-md text-base font-medium w-full hover:bg-gray-50 dark:hover:bg-gray-800">
              <span>SignUp</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileMenu;