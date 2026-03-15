import React, { useState, useEffect } from 'react';
import { Settings, X, RefreshCw } from 'lucide-react';

export const defaultImageCompressorSettings = {
  quality: 80, // number — mozjpeg/pngquant/imagemagick quality (0–100)
};

const ImageCompressorSetting = ({ isOpen, onClose, file, onSave }) => {
  return (
    <ImageCompressorModal
      isOpen={isOpen}
      onClose={onClose}
      file={file}
      onSave={onSave}
    />
  );
};

const ImageCompressorModal = ({ file, isOpen, onClose, onSave }) => {
  const [settings, setSettings] = useState(defaultImageCompressorSettings);

  useEffect(() => {
    if (file && file.settings) {
      setSettings(file.settings);
    }
  }, [file]);

  if (!isOpen || !file) return null;

  const ext = file?.name?.split('.').pop()?.toLowerCase();
  const engineLabel = {
    jpg: 'mozjpeg', jpeg: 'mozjpeg',
    png: 'pngquant',
    webp: 'imagemagick',
  }[ext] || 'auto';

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    // BUG FIX: range input always returns a string — must parseInt so CloudConvert
    // receives a number (e.g. 80) not a string (e.g. "80").
    setSettings(prev => ({ ...prev, [name]: parseInt(value, 10) }));
  };

  const handleReset = () => setSettings(defaultImageCompressorSettings);
  const handleApply = () => { onSave(file.id, settings); onClose(); };

  const qualityLabel = (q) => {
    if (q >= 80) return 'High Quality';
    if (q >= 50) return 'Balanced';
    return 'Small Size';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 transition-opacity duration-300">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <Settings className="w-6 h-6 text-gray-900 dark:text-white" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Compression Options</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-6 h-6 text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        <p className="px-6 pt-4 text-sm text-gray-600 dark:text-gray-400 truncate">
          File: <span className="font-medium">{file.name}</span>
        </p>

        <div className="p-6 space-y-6 max-h-[65vh] overflow-y-auto">

          {/* Engine Info Badge */}
          <div className="flex items-center space-x-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-2">
            <span className="text-sm text-blue-700 dark:text-blue-300">
              Engine: <span className="font-semibold">{engineLabel}</span>
            </span>
            <span className="text-xs text-blue-500 dark:text-blue-400">
              — optimized for <span className="uppercase font-medium">.{ext}</span>
            </span>
          </div>

          {/* Quality Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="quality" className="font-medium text-gray-700 dark:text-gray-300">
                Compression Quality
              </label>
              <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                {settings.quality}% — {qualityLabel(settings.quality)}
              </span>
            </div>
            <input
              id="quality"
              name="quality"
              type="range"
              min="10"
              max="100"
              step="5"
              value={settings.quality}
              onChange={handleInputChange}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-600"
            />
            <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500">
              <span>Smallest File</span>
              <span>Best Quality</span>
            </div>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 rounded-lg px-4 py-3">
            The output file will keep the same format as the input. Lower quality = smaller file size.
          </p>
        </div>

        {/* Footer */}
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

export default ImageCompressorSetting;