// ThemeToggle.jsx
import React from 'react';
import { Sun, Moon } from 'lucide-react';
import useTheme from '@/hooks/useTheme';

const ThemeToggle = () => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="relative p-2 rounded-lg dark:bg-gray-900 transition-all duration-400 group"
      aria-label="Toggle theme"
    >
      <div className="relative w-6 h-6">
        <Sun
          className={`absolute inset-0 w-6 h-6 text-yellow-500 transition-all duration-500 transform ${
            isDark ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'
          }`}
        />
        <Moon
          className={`absolute inset-0 w-6 h-6 text-blue-400 transition-all duration-500 transform ${
            isDark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'
          }`}
        />
      </div>

      {/* Tooltip - Fixed to prevent overflow */}
      <div className="absolute -bottom-10 left-1/2 transform -translate-x-1/2 
                      bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 
                      text-xs px-2 py-1 rounded 
                      opacity-0 group-hover:opacity-100 transition-opacity duration-200 
                      pointer-events-none 
                      whitespace-normal break-words max-w-[140px] text-center">
        {isDark ? 'Light' : 'Dark'}
      </div>
    </button>
  );
};

export default ThemeToggle;
