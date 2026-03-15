// @/features/compression/settings/VideoCompressorSetting.jsx
import React, { useState, useEffect } from 'react';
import { Settings, X, RefreshCw } from 'lucide-react';

export const defaultVideoCompressorSettings = {
  quality: 'medium',     // 'high', 'medium', 'low' → maps to CRF 23, 28, 35
  resolution: 'original', // 'original', '1080p', '720p', '480p', '360p'
};

const VideoCompressorSetting = ({ isOpen, onClose, file, onSave }) => {
  return (
    <VideoCompressorModal
      isOpen={isOpen}
      onClose={onClose}
      file={file}
      onSave={onSave}
    />
  );
};

const VideoCompressorModal = ({ file, isOpen, onClose, onSave }) => {
  const [settings, setSettings] = useState(defaultVideoCompressorSettings);

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

  const handleReset = () => setSettings(defaultVideoCompressorSettings);
  const handleApply = () => { onSave(file.id, settings); onClose(); };

  // CRF info for user context
  const crfMap = { high: 23, medium: 28, low: 35 };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 transition-opacity duration-300">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <Settings className="w-6 h-6 text-gray-900 dark:text-white" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Video Compression Options</h3>
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
              Engine: <span className="font-semibold">ffmpeg (x264)</span>
            </span>
            <span className="text-xs text-blue-500 dark:text-blue-400">
              — output keeps the same format as input
            </span>
          </div>

          {/* Quality */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div>
              <label htmlFor="quality" className="font-medium text-gray-700 dark:text-gray-300 block">
                Compression Level
              </label>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                CRF {crfMap[settings.quality]} — higher CRF = smaller file
              </p>
            </div>
            <select
              id="quality"
              name="quality"
              value={settings.quality}
              onChange={handleInputChange}
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="high">High Quality (less compression)</option>
              <option value="medium">Balanced (recommended)</option>
              <option value="low">Small File (more compression)</option>
            </select>
          </div>

          {/* Resolution */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div>
              <label htmlFor="resolution" className="font-medium text-gray-700 dark:text-gray-300 block">
                Resolution
              </label>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Downscaling reduces file size significantly
              </p>
            </div>
            <select
              id="resolution"
              name="resolution"
              value={settings.resolution}
              onChange={handleInputChange}
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="original">Keep Original</option>
              <option value="1080p">1080p (Full HD)</option>
              <option value="720p">720p (HD)</option>
              <option value="480p">480p (Standard)</option>
              <option value="360p">360p (Small)</option>
            </select>
          </div>

          {/* Info note */}
          <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 rounded-lg px-4 py-3">
            Audio track is kept as-is (copied without re-encoding) to save processing time.
            Only the video stream is compressed.
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

export default VideoCompressorSetting;