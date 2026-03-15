//@/features/conversion/settings/MovtoMp4Setting.jsx
import React, { useState, useEffect } from 'react';
import { Settings, X, RefreshCw } from 'lucide-react';

// Define the default settings that will be used when a new video file is added.
export const defaultMovtoMp4Settings = {
  video_quality: 'medium', // 'high', 'medium', 'low'
  resolution: 'original', // 'original', '1920x1080', etc.
  removeAudio: false,     // A boolean for the checkbox
  trimStart: '',          // Empty strings for optional text inputs
  trimEnd: '',
};

// This is the main component that will be passed as a prop to ConverterPage.
// Its only job is to render the modal.
const MovtoMp4Setting = ({ isOpen, onClose, file, onSave }) => {
  return (
    <VideoSettingsModal 
        isOpen={isOpen}
        onClose={onClose}
        file={file}
        onSave={onSave}
    />
  );
};

// This is the private modal component that contains all the UI and logic.
const VideoSettingsModal = ({ file, isOpen, onClose, onSave }) => {
  const [settings, setSettings] = useState(defaultMovtoMp4Settings);

  // When the modal is opened for a specific file, load that file's current settings.
  useEffect(() => {
    if (file && file.settings) {
      setSettings(file.settings);
    }
  }, [file]);

  if (!isOpen || !file) return null;

  // A single handler for all types of form inputs.
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  // Resets the modal's state to the defaults.
  const handleReset = () => setSettings(defaultMovtoMp4Settings);

  // Saves the current settings to the file and closes the modal.
  const handleApply = () => { onSave(file.id, settings); onClose(); };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 transition-opacity duration-300">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl transform transition-transform duration-300 scale-95 animate-modal-in">
        
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <Settings className="w-6 h-6 text-gray-900 dark:text-white" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Advanced Video Options</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-6 h-6 text-gray-600 dark:text-gray-300" />
          </button>
        </div>
        
        <p className="px-6 pt-4 text-sm text-gray-600 dark:text-gray-400 truncate">File: <span className="font-medium">{file.name}</span></p>

        <div className="p-6 space-y-6 max-h-[65vh] overflow-y-auto">
          {/* 1. Video Quality */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <label htmlFor="video_quality" className="font-medium text-gray-700 dark:text-gray-300">Video Quality</label>
            <select id="video_quality" name="video_quality" value={settings.video_quality} onChange={handleInputChange} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="high">High (Best quality)</option>
              <option value="medium">Medium (Recommended)</option>
              <option value="low">Low (Smallest size)</option>
            </select>
          </div>

          {/* 2. Resolution */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <label htmlFor="resolution" className="font-medium text-gray-700 dark:text-gray-300">Resolution</label>
            <select id="resolution" name="resolution" value={settings.resolution} onChange={handleInputChange} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="original">Keep Original</option>
              <option value="1920x1080">1080p (Full HD)</option>
              <option value="1280x720">720p (HD)</option>
              <option value="854x480">480p (Standard Definition)</option>
            </select>
          </div>

          {/* 3. Trim Video */}
          <div>
            <label className="font-medium text-gray-700 dark:text-gray-300 mb-2 block">Trim Video (Optional)</label>
            <div className="flex items-center space-x-2">
              <input type="text" name="trimStart" placeholder="Start (e.g., 00:00:10)" value={settings.trimStart} onChange={handleInputChange} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              <span className="text-gray-500 dark:text-gray-400">-</span>
              <input type="text" name="trimEnd" placeholder="End (e.g., 00:01:30)" value={settings.trimEnd} onChange={handleInputChange} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>
          </div>

          {/* 4. Remove Audio */}
          <div className="flex items-center pt-4 border-t border-gray-200 dark:border-gray-700">
            <input id="removeAudio" name="removeAudio" type="checkbox" checked={settings.removeAudio} onChange={handleInputChange} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"/>
            <label htmlFor="removeAudio" className="ml-3 font-medium text-gray-700 dark:text-gray-300">Remove Audio (Create a silent video)</label>
          </div>
        </div>

        <div className="flex justify-between items-center p-5 border-t border-gray-200 dark:border-gray-700">
          <button onClick={handleReset} className="flex items-center space-x-2 text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 font-medium px-4 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-200">
            <RefreshCw className="w-4 h-4"/>
            <span>Reset to Defaults</span>
          </button>
          <button onClick={handleApply} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-2 rounded-lg font-semibold transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5">
            Apply Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default MovtoMp4Setting;