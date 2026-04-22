//@/features/compression/settings/GifCompressorSetting.jsx
import React, { useState, useEffect } from 'react';
import { Settings, X, RefreshCw } from 'lucide-react';

// Backend reads for GIF compression (gifsicle):
//   colors → parseInt(fileSettings.colors, 10) || 128
//
// gifsicle reduces the color palette to compress the GIF.
// Valid range is 2–256 (powers of 2 produce best results).
export const defaultGifCompressorSettings = {
  colors: 128, // integer — number of colors in the palette (2–256)
};

const GifCompressorSetting = ({ isOpen, onClose, file, onSave }) => {
  return (
    <GifCompressorModal
      isOpen={isOpen}
      onClose={onClose}
      file={file}
      onSave={onSave}
    />
  );
};

const GifCompressorModal = ({ file, isOpen, onClose, onSave }) => {
  const [settings, setSettings] = useState(defaultGifCompressorSettings);

  useEffect(() => {
    if (file && file.settings) {
      setSettings(file.settings);
    }
  }, [file]);

  if (!isOpen || !file) return null;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    // parseInt — backend does parseInt(fileSettings.colors, 10)
    setSettings(prev => ({ ...prev, [name]: parseInt(value, 10) }));
  };

  const handleReset = () => setSettings(defaultGifCompressorSettings);
  const handleApply = () => { onSave(file.id, settings); onClose(); };

  // Human-readable palette size label
  const getColorLabel = (val) => {
    if (val <= 8)   return 'Minimum (smallest file)';
    if (val <= 32)  return 'Very low';
    if (val <= 64)  return 'Low';
    if (val <= 128) return 'Medium (recommended)';
    if (val <= 192) return 'High';
    return 'Maximum (best quality)';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 transition-opacity duration-300">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl">

        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <Settings className="w-6 h-6 text-gray-900 dark:text-white" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">GIF Compression Options</h3>
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
              Engine: <span className="font-semibold">gifsicle</span>
            </span>
            <span className="text-xs text-blue-500 dark:text-blue-400">— palette reduction</span>
          </div>

          {/* Color count slider */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label htmlFor="colors" className="font-medium text-gray-700 dark:text-gray-300">
                Color Palette
              </label>
              <div className="text-right">
                <span className="font-semibold text-gray-900 dark:text-white">{settings.colors} colors</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {getColorLabel(settings.colors)}
                </span>
              </div>
            </div>
            <input
              id="colors"
              name="colors"
              type="range"
              min="2"
              max="256"
              step="2"
              value={settings.colors}
              onChange={handleInputChange}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-600"
            />
            <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mt-1">
              <span>2 (smallest)</span>
              <span>256 (best quality)</span>
            </div>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 rounded-lg px-4 py-3">
            Fewer colors = smaller file size. GIFs with simple graphics compress well at 64–128 colors.
            Animations with many gradients may need 192+ colors to look good.
          </p>
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

export default GifCompressorSetting;