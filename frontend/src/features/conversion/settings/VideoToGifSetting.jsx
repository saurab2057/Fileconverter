// @/features/conversion/settings/VideoToGifSetting.jsx
import React, { useState, useEffect } from 'react';
import { Settings, X, RefreshCw } from 'lucide-react';

export const defaultVideoToGifSettings = {
  trimStart: '',
  trimEnd: '',
};

const VideoToGifSetting = ({ isOpen, onClose, file, onSave }) => {
  return (
    <VideoToGifModal
      isOpen={isOpen}
      onClose={onClose}
      file={file}
      onSave={onSave}
    />
  );
};

const VideoToGifModal = ({ file, isOpen, onClose, onSave }) => {
  const [settings, setSettings] = useState(defaultVideoToGifSettings);

  useEffect(() => {
    if (file && file.settings) {
      setSettings(file.settings);
    }
  }, [file]);

  if (!isOpen || !file) return null;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleReset = () => setSettings(defaultVideoToGifSettings);
  const handleApply = () => { onSave(file.id, settings); onClose(); };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 transition-opacity duration-300">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl transform transition-transform duration-300 scale-95 animate-modal-in">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <Settings className="w-6 h-6 text-gray-900 dark:text-white" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">GIF Options</h3>
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
              Engine: <span className="font-semibold">ffmpeg (gif codec)</span>
            </span>
          </div>

          {/* Trim */}
          <div>
            <label className="font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              Trim Video (Optional)
            </label>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
              Only convert a specific portion of the video to GIF
            </p>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                name="trimStart"
                placeholder="Start (e.g., 00:00:05)"
                value={settings.trimStart}
                onChange={handleInputChange}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-500 dark:text-gray-400 shrink-0">—</span>
              <input
                type="text"
                name="trimEnd"
                placeholder="End (e.g., 00:00:15)"
                value={settings.trimEnd}
                onChange={handleInputChange}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Info note */}
          <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 rounded-lg px-4 py-3">
            Tip: Keep GIFs short (under 10 seconds) for best file size. Long videos produce very large GIFs.
          </p>

        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-5 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleReset}
            className="flex items-center space-x-2 text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 font-medium px-4 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-200"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reset to Defaults</span>
          </button>
          <button
            onClick={handleApply}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-2 rounded-lg font-semibold shadow-md transition-all duration-200 hover:shadow-lg transform hover:-translate-y-0.5"
          >
            Apply Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoToGifSetting;