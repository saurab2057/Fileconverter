//@/features/conversion/settings/PngtoSvgSetting.jsx
import React, { useState, useEffect } from 'react';
import { Settings, X, RefreshCw } from 'lucide-react';

export const defaultPngtoSvgSettings = {
  colorMode: 'color',       // CloudConvert potrace: 'color' | 'grey' | 'black'
  threshold: 128,           // 0–255, only used when colorMode === 'black'
  background: 'transparent',// 'transparent' | '#ffffff' | '#000000'
  detail: 'medium',         // maps to turdsize: high→2, medium→5, low→10
};

const PngtoSvgSetting = ({ isOpen, onClose, file, onSave }) => {
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
  const [settings, setSettings] = useState(defaultPngtoSvgSettings);

  useEffect(() => {
    if (file && file.settings) {
      setSettings(file.settings);
    }
  }, [file]);

  if (!isOpen || !file) return null;

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleReset = () => setSettings(defaultPngtoSvgSettings);
  const handleApply = () => { onSave(file.id, settings); onClose(); };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <Settings className="w-6 h-6 text-gray-900 dark:text-white" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              SVG Vectorization Options
            </h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-6 h-6 text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
            File: <span className="font-medium">{file.name}</span>
          </p>

          {/* Color Mode */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <label htmlFor="colorMode" className="font-medium text-gray-700 dark:text-gray-300">Color Mode</label>
            <select
              id="colorMode"
              name="colorMode"
              value={settings.colorMode}
              onChange={handleInputChange}
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2"
            >
              {/*
                BUG FIX: CloudConvert potrace engine uses British spelling.
                  "gray" → INVALID → was causing 422 Unprocessable Entity
                  "mono" → INVALID → same issue
                Correct values: "color", "grey", "black"
              */}
              <option value="color">Full Color</option>
              <option value="grey">Grayscale</option>
              <option value="black">Black &amp; White</option>
            </select>
          </div>

          {/* Threshold — only relevant for black/white mode */}
          {settings.colorMode === 'black' && (
            <div>
              <label htmlFor="threshold" className="font-medium text-gray-700 dark:text-gray-300 block mb-2">
                Threshold: {settings.threshold}
              </label>
              <input
                id="threshold"
                name="threshold"
                type="range"
                min="0"
                max="255"
                value={settings.threshold}
                onChange={handleInputChange}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-600"
              />
              <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mt-1">
                <span>Dark (0)</span>
                <span>Light (255)</span>
              </div>
            </div>
          )}

          {/* Background */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <label htmlFor="background" className="font-medium text-gray-700 dark:text-gray-300">Background</label>
            <select
              id="background"
              name="background"
              value={settings.background}
              onChange={handleInputChange}
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2"
            >
              <option value="transparent">Transparent</option>
              <option value="#ffffff">White</option>
              <option value="#000000">Black</option>
            </select>
          </div>

          {/* Detail Level */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <label htmlFor="detail" className="font-medium text-gray-700 dark:text-gray-300">Detail Level</label>
            <select
              id="detail"
              name="detail"
              value={settings.detail}
              onChange={handleInputChange}
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2"
            >
              {/* maps to turdsize in backend: high→2, medium→5, low→10 */}
              <option value="high">High (More Detail)</option>
              <option value="medium">Medium (Balanced)</option>
              <option value="low">Low (Smoother)</option>
            </select>
          </div>
        </div>

        <div className="flex justify-between items-center p-5 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleReset}
            className="flex items-center space-x-2 text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 font-medium px-4 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reset</span>
          </button>
          <button
            onClick={handleApply}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-2 rounded-lg font-semibold shadow-md"
          >
            Apply Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default PngtoSvgSetting;