// @/features/compression/settings/GifCompressorSetting.jsx
import React, { useState, useEffect } from 'react';
import { Settings, X, RefreshCw } from 'lucide-react';

export const defaultGifCompressorSettings = {
  colors: 128, // palette size: 2–256. Lower = smaller file, fewer colors
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
    setSettings({ ...settings, [name]: parseInt(value) });
  };

  const handleReset = () => setSettings(defaultGifCompressorSettings);
  const handleApply = () => { onSave(file.id, settings); onClose(); };

  // Human-readable quality label based on color count
  const colorLabel = (c) => {
    if (c >= 200) return 'High Quality';
    if (c >= 100) return 'Balanced';
    if (c >= 32)  return 'Small File';
    return 'Minimal';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 transition-opacity duration-300">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl">

        {/* Header */}
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
            <span className="text-xs text-blue-500 dark:text-blue-400">
              — optimized GIF palette reduction
            </span>
          </div>

          {/* Color Palette Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="colors" className="font-medium text-gray-700 dark:text-gray-300">
                Color Palette Size
              </label>
              <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                {settings.colors} colors — {colorLabel(settings.colors)}
              </span>
            </div>
            <input
              id="colors"
              name="colors"
              type="range"
              min="8"
              max="256"
              step="8"
              value={settings.colors}
              onChange={handleInputChange}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-600"
            />
            <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500">
              <span>Smallest File (8)</span>
              <span>Best Quality (256)</span>
            </div>
          </div>

          {/* Color preset buttons for quick selection */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Quick Presets</p>
            <div className="grid grid-cols-4 gap-2">
              {[{ label: 'Minimal', value: 16 }, { label: 'Small', value: 64 }, { label: 'Balanced', value: 128 }, { label: 'Quality', value: 256 }].map(preset => (
                <button
                  key={preset.value}
                  onClick={() => setSettings({ ...settings, colors: preset.value })}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors duration-150
                    ${settings.colors === preset.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'
                    }`}
                >
                  {preset.label}
                  <span className="block text-xs opacity-70">{preset.value}c</span>
                </button>
              ))}
            </div>
          </div>

          {/* Info note */}
          <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 rounded-lg px-4 py-3">
            GIFs are limited to 256 colors by design. Reducing the palette size
            shrinks the file but may cause color banding in complex images.
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

export default GifCompressorSetting;