import React, { useState, useEffect } from 'react';
import { Settings, X, RefreshCw } from 'lucide-react';

// Only settings the backend (imagemagick) actually uses.
// colorSpace and preserveTransparency were silently ignored by the backend.
export const defaultWebpToPngSettings = {
  quality: 100, // number — ImageMagick quality (0–100)
};

const WebpToPngSetting = ({ isOpen, onClose, file, onSave }) => {
  return (
    <ImageSettingsModal
      isOpen={isOpen}
      onClose={onClose}
      file={file}
      onSave={onSave}
    />
  );
};

const ImageSettingsModal = ({ file, isOpen, onClose, onSave }) => {
  const [settings, setSettings] = useState(defaultWebpToPngSettings);

  useEffect(() => {
    if (file && file.settings) {
      setSettings(file.settings);
    }
  }, [file]);

  if (!isOpen || !file) return null;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    // BUG FIX: range input returns string — parseInt so CloudConvert gets a number
    setSettings(prev => ({ ...prev, [name]: parseInt(value, 10) }));
  };

  const handleReset = () => setSettings(defaultWebpToPngSettings);
  const handleApply = () => { onSave(file.id, settings); onClose(); };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 transition-opacity duration-300">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl">

        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <Settings className="w-6 h-6 text-gray-900 dark:text-white" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Image Options</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-6 h-6 text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        <p className="px-6 pt-4 text-sm text-gray-600 dark:text-gray-400 truncate">
          File: <span className="font-medium">{file.name}</span>
        </p>

        <div className="p-6 space-y-6 max-h-[65vh] overflow-y-auto">

          {/* Engine badge */}
          <div className="flex items-center space-x-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-2">
            <span className="text-sm text-blue-700 dark:text-blue-300">
              Engine: <span className="font-semibold">imagemagick</span>
            </span>
            <span className="text-xs text-blue-500 dark:text-blue-400">— PNG preserves transparency automatically</span>
          </div>

          {/* Quality Slider */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <label htmlFor="quality" className="font-medium text-gray-700 dark:text-gray-300">Output Quality</label>
            <div className="flex items-center space-x-3">
              <input
                id="quality"
                name="quality"
                type="range"
                min="1"
                max="100"
                value={settings.quality}
                onChange={handleInputChange}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-600"
              />
              <span className="font-semibold text-gray-900 dark:text-white w-12 text-center">{settings.quality}%</span>
            </div>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 rounded-lg px-4 py-3">
            PNG is lossless. Transparency (alpha channel) is always preserved.
          </p>
        </div>

        <div className="flex justify-between items-center p-5 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleReset}
            className="flex items-center space-x-2 text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 font-medium px-4 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-200"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reset</span>
          </button>
          <button
            onClick={handleApply}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-2 rounded-lg font-semibold transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
          >
            Apply Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default WebpToPngSetting;