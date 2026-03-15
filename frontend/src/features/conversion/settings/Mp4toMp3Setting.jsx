//@/features/conversion/settings/Mp4toMp3Setting.jsx
import React, { useState, useEffect } from 'react';
import { Settings, X, RefreshCw } from 'lucide-react';

// Export the defaults so they can be imported by the page component.
export const defaultMp4toMp3Settings = {
  audioCodec: 'mp3',
  audioRateControl: 'vbr',
  bitrate: '192',
  audioSampleRate: 'auto',
  audioChannels: 'nochange',
  volume: 100,
  fadeIn: false,
  fadeOut: false,
  trimStart: '',
  trimEnd: ''
};

// This is the main component passed to ConverterPage.
// It is now much simpler.
const Mp4toMp3Setting = ({ isOpen, onClose, file, onSave }) => {
  return (
    <AudioSettingsModal 
        isOpen={isOpen}
        onClose={onClose}
        file={file}
        onSave={onSave}
    />
  );
};

// The Modal is now a private sub-component.
const AudioSettingsModal = ({ file, isOpen, onClose, onSave }) => {
  // Initialize state with the defaults.
  const [settings, setSettings] = useState(defaultMp4toMp3Settings);

  // When the modal opens for a specific file, update the state to match that file's settings.
  useEffect(() => {
    if (file && file.settings) {
      setSettings(file.settings);
    }
  }, [file]);

  if (!isOpen || !file) return null;

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newSettings = { ...settings, [name]: type === 'checkbox' ? checked : value };
    if (name === 'audioCodec' && value !== 'mp3') {
        newSettings.audioRateControl = 'vbr';
    }
    setSettings(newSettings);
  };
  
  const handleReset = () => {
    setSettings(defaultMp4toMp3Settings);
  };

  const handleApply = () => {
    onSave(file.id, settings);
    onClose();
  };

  const bitrateOptions = [64, 128, 192, 256, 320];
  const sampleRateOptions = [
    { value: 'auto', label: 'Auto (Recommended)' },
    { value: '8000', label: '8000 Hz' },
    { value: '11025', label: '11025 Hz' },
    { value: '22050', label: '22050 Hz' },
    { value: '32000', label: '32000 Hz' },
    { value: '44100', label: '44100 Hz (CD Quality)' },
    { value: '48000', label: '48000 Hz (DVD Quality)' },
    { value: '96000', label: '96000 Hz' },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 transition-opacity duration-300">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl transform transition-transform duration-300 scale-95 animate-modal-in">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <Settings className="w-6 h-6 text-gray-900 dark:text-white" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Advanced Options</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-6 h-6 text-gray-600 dark:text-gray-300" />
          </button>
        </div>
        
        <p className="px-6 pt-4 text-sm text-gray-600 dark:text-gray-400 truncate">File: <span className="font-medium">{file.name}</span></p>

        <div className="p-6 space-y-6 max-h-[65vh] overflow-y-auto">
          {/* Audio Codec */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <label htmlFor="audioCodec" className="font-medium text-gray-700 dark:text-gray-300">Audio Codec</label>
            <select id="audioCodec" name="audioCodec" value={settings.audioCodec} onChange={handleInputChange} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="copy">Copy (no re-encoding)</option>
              <option value="mp3">MP3</option>
              <option value="auto">Auto</option>
            </select>
          </div>

          {/* MP3 Specific Options */}
          {settings.audioCodec === 'mp3' && (
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-6 bg-gray-50 dark:bg-gray-700/50">
              <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 border-b border-gray-300 dark:border-gray-600 pb-2">MP3 Settings</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <label htmlFor="audioRateControl" className="font-medium text-gray-700 dark:text-gray-300">Audio Rate Control</label>
                <select id="audioRateControl" name="audioRateControl" value={settings.audioRateControl} onChange={handleInputChange} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="vbr">Variable Bitrate (VBR)</option>
                  <option value="cbr">Constant Bitrate (CBR)</option>
                </select>
              </div>
              {settings.audioRateControl === 'cbr' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                  <label htmlFor="bitrate" className="font-medium text-gray-700 dark:text-gray-300">Bitrate</label>
                  <select id="bitrate" name="bitrate" value={settings.bitrate} onChange={handleInputChange} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {bitrateOptions.map(rate => <option key={rate} value={rate}>{rate} kbps</option>)}
                  </select>
                </div>
              )}
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <label htmlFor="audioSampleRate" className="font-medium text-gray-700 dark:text-gray-300">Audio Sample Rate</label>
            <select id="audioSampleRate" name="audioSampleRate" value={settings.audioSampleRate} onChange={handleInputChange} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
              {sampleRateOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <label htmlFor="audioChannels" className="font-medium text-gray-700 dark:text-gray-300">Audio Channels</label>
            <select id="audioChannels" name="audioChannels" value={settings.audioChannels} onChange={handleInputChange} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="nochange">No Change</option>
              <option value="mono">Mono</option>
              <option value="stereo">Stereo</option>
            </select>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
             <label htmlFor="volume" className="font-medium text-gray-700 dark:text-gray-300">Adjust Volume</label>
            <div className="flex items-center space-x-3">
              <input id="volume" name="volume" type="range" min="0" max="200" value={settings.volume} onChange={handleInputChange} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-600" />
              <span className="font-semibold text-gray-900 dark:text-white w-12 text-center">{settings.volume}%</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="font-medium text-gray-700 dark:text-gray-300 mb-2 block">Effects</label>
              <div className="space-y-3">
                <div className="flex items-center">
                  <input id="fadeIn" name="fadeIn" type="checkbox" checked={settings.fadeIn} onChange={handleInputChange} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  <label htmlFor="fadeIn" className="ml-2 block text-sm text-gray-900 dark:text-gray-200">Fade In</label>
                </div>
                <div className="flex items-center">
                  <input id="fadeOut" name="fadeOut" type="checkbox" checked={settings.fadeOut} onChange={handleInputChange} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  <label htmlFor="fadeOut" className="ml-2 block text-sm text-gray-900 dark:text-gray-200">Fade Out</label>
                </div>
              </div>
            </div>
            <div>
                <label className="font-medium text-gray-700 dark:text-gray-300 mb-2 block">Trim Audio</label>
                <div className="flex items-center space-x-2">
                    <input type="text" name="trimStart" placeholder="Start (e.g., 00:30)" value={settings.trimStart} onChange={handleInputChange} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                    <span className="text-gray-500 dark:text-gray-400">-</span>
                    <input type="text" name="trimEnd" placeholder="End (e.g., 01:45)" value={settings.trimEnd} onChange={handleInputChange} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                </div>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center p-5 border-t border-gray-200 dark:border-gray-700">
          <button onClick={handleReset} className="flex items-center space-x-2 text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 font-medium px-4 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-200">
            <RefreshCw className="w-4 h-4"/>
            <span>Reset</span>
          </button>
          <button onClick={handleApply} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-2 rounded-lg font-semibold transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5">
            Apply Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default Mp4toMp3Setting;