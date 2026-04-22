//@/features/compression/settings/VideoCompressorSetting.jsx
import React, { useState, useEffect } from 'react';
import { Settings, X, RefreshCw } from 'lucide-react';

// Backend reads for VIDEO compression (ffmpeg/x264):
//   quality → qualityMap[fileSettings.quality] → high:23, medium:28, low:35 (CRF)
//   resolution → resolutionMap[fileSettings.resolution] → '1080p'/'720p'/'480p'/'360p'
//
// Backend reads for AUDIO compression (ffmpeg):
//   quality → bitrateMap[fileSettings.quality] → high:192, medium:128, low:96 (kbps)
//   (resolution is not read for audio formats — safely ignored)
//
// IMPORTANT: resolution keys must match backend's resolutionMap exactly:
//   '1080p', '720p', '480p', '360p'  ← NOT '1920x1080' (that's the conversion controller format)
export const defaultVideoCompressorSettings = {
  quality:    'medium',  // 'high' | 'medium' | 'low'
  resolution: 'original', // 'original' | '1080p' | '720p' | '480p' | '360p'
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

  const ext = file.name?.split('.').pop().toLowerCase();
  const isAudio = ['mp3', 'wav', 'aac', 'flac'].includes(ext);

  // Quality descriptions differ between video (CRF) and audio (bitrate)
  const qualityLabels = isAudio
    ? { high: 'High (192 kbps)', medium: 'Medium (128 kbps)', low: 'Low (96 kbps)' }
    : { high: 'High (Best quality)', medium: 'Medium (Recommended)', low: 'Low (Smallest size)' };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 transition-opacity duration-300">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl transform transition-transform duration-300 scale-95 animate-modal-in">

        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <Settings className="w-6 h-6 text-gray-900 dark:text-white" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              {isAudio ? 'Audio' : 'Video'} Compression Options
            </h3>
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
              Engine: <span className="font-semibold">ffmpeg</span>
            </span>
            {!isAudio && (
              <span className="text-xs text-blue-500 dark:text-blue-400">— x264 video codec</span>
            )}
          </div>

          {/* Quality */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <label htmlFor="quality" className="font-medium text-gray-700 dark:text-gray-300">
              {isAudio ? 'Audio Quality' : 'Video Quality'}
            </label>
            <select
              id="quality"
              name="quality"
              value={settings.quality}
              onChange={handleInputChange}
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="high">{qualityLabels.high}</option>
              <option value="medium">{qualityLabels.medium}</option>
              <option value="low">{qualityLabels.low}</option>
            </select>
          </div>

          {/* Resolution — only shown for video files */}
          {!isAudio && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <label htmlFor="resolution" className="font-medium text-gray-700 dark:text-gray-300">
                Max Resolution
              </label>
              {/*
                Values MUST match backend resolutionMap keys:
                  '1080p', '720p', '480p', '360p'
                'original' means the resolution key is absent — backend skips downscaling.
              */}
              <select
                id="resolution"
                name="resolution"
                value={settings.resolution}
                onChange={handleInputChange}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="original">Keep Original</option>
                <option value="1080p">1080p (1920×1080)</option>
                <option value="720p">720p (1280×720)</option>
                <option value="480p">480p (854×480)</option>
                <option value="360p">360p (640×360)</option>
              </select>
            </div>
          )}

          <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 rounded-lg px-4 py-3">
            {isAudio
              ? 'Lower bitrate reduces file size but may affect audio clarity.'
              : 'Lower quality and smaller resolution produce smaller files. Medium is recommended for most use cases.'}
          </p>
        </div>

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
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-2 rounded-lg font-semibold transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
          >
            Apply Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoCompressorSetting;