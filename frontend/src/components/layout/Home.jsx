// src/components/layout/Home.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, UserPlus, X, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

import FileUploader from '@/components/common/FileUploader';
import { AnimatedStats } from '@/components/common/AnimatedStats';
import { AnimatedTestimonials } from '@/components/common/AnimatedReview';
import { useToast } from '@/context/ToastContext';

// Tool Registry imports
import { getFormatActions } from '@/lib/toolRegistry';

// Color variants per category (simplified; in real usage we'd map from registry)
const colorMap = {
  blue:   { bg: 'bg-blue-50 dark:bg-blue-900/20',    border: 'border-blue-200 dark:border-blue-700',    text: 'text-blue-700 dark:text-blue-300',    badge: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' },
  purple: { bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-200 dark:border-purple-700', text: 'text-purple-700 dark:text-purple-300', badge: 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300' },
  green:  { bg: 'bg-green-50 dark:bg-green-900/20',   border: 'border-green-200 dark:border-green-700',   text: 'text-green-700 dark:text-green-300',   badge: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' },
  orange: { bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-700', text: 'text-orange-700 dark:text-orange-300', badge: 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300' },
  red:    { bg: 'bg-red-50 dark:bg-red-900/20',       border: 'border-red-200 dark:border-red-700',       text: 'text-red-700 dark:text-red-300',       badge: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300' },
};

const HomePage = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const toast = useToast();
  const [showAuthModal,   setShowAuthModal]   = useState(false);
  const [showFormatModal, setShowFormatModal] = useState(false);
  const [detectedFormat,  setDetectedFormat]  = useState(null);

  const testimonials = [
    { name: "Sarah Johnson", role: "Graphic Designer",  content: "FileTools has been a game-changer for my workflow. Converting between different image formats is now effortless and fast.", rating: 5 },
    { name: "Mike Chen",     role: "Video Editor",      content: "The video conversion quality is outstanding. I use it daily for converting client files to different formats.", rating: 5 },
    { name: "Emily Davis",   role: "Marketing Manager", content: "Perfect for our team's document conversion needs. The batch processing feature saves us hours every week.", rating: 5 },
  ];

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleFilesSelected = (files) => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }
    if (!files || files.length === 0) return;

    const ext = files[0].name.split('.').pop().toLowerCase();
    const actions = getFormatActions(ext);

    if (actions.length === 0) {
      toast.error("We don't support this file type.");
      return;
    }

    // For modal display, we also need a label and color; we'll use the extension's typical category.
    // For simplicity, we'll set a default color (blue) and label based on extension.
    const labelMap = {
      mp4: 'Video', mov: 'Video', mkv: 'Video', avi: 'Video', webm: 'Video',
      mp3: 'Audio', wav: 'Audio', aac: 'Audio', flac: 'Audio',
      png: 'Image', jpg: 'Image', jpeg: 'Image', webp: 'Image', jfif: 'Image',
      gif: 'GIF',
      pdf: 'Document',
    };
    const colorMapByExt = {
      mp4: 'blue', mov: 'blue', mkv: 'blue', avi: 'blue', webm: 'blue',
      mp3: 'purple', wav: 'purple', aac: 'purple', flac: 'purple',
      png: 'green', jpg: 'green', jpeg: 'green', webp: 'green', jfif: 'green',
      gif: 'orange',
      pdf: 'red',
    };

    setDetectedFormat({
      ext,
      files,
      actions,
      label: labelMap[ext] || 'File',
      color: colorMapByExt[ext] || 'blue',
    });
    setShowFormatModal(true);
  };

  const handleOptionSelect = (option) => {
    const fileObjects = Array.from(detectedFormat.files).map((file, index) => ({
      id: Date.now() + index,
      file,
      name: file.name,
      size: file.size,
      status: 'ready',
      settings: { ...option.settings },
    }));

    setShowFormatModal(false);
    setDetectedFormat(null);
    navigate(option.route, { state: { initialFiles: fileObjects } });
  };

  const scrollToConverter = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const colors = detectedFormat ? colorMap[detectedFormat.color] : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section id="converter" className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-800 dark:via-gray-900 dark:to-gray-900 py-20 lg:py-24 transition-colors duration-300 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%23ddd6fe%22 fill-opacity=%220.4%22%3E%3Ccircle cx=%2230%22 cy=%2230%22 r=%221%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-40"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
          <h1 className="text-5xl md:text-7xl font-bold text-gray-900 dark:text-white mb-6 transition-colors duration-300">
            File <span className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">Tools</span>
          </h1>
          <FileUploader
            title="Choose Files"
            subtitle="Drop any file here and we'll show you what you can do with it."
            maxFileSize="100MB"
            onFilesSelected={handleFilesSelected}
          />
        </div>
      </section>

      <AnimatedStats />
      <AnimatedTestimonials testimonials={testimonials} />

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section className="py-20 bg-gray-50 dark:bg-slate-900 transition-colors duration-300 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">Ready to Convert Your Files?</h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto transition-colors duration-300">
            Join millions of users who trust FileTools for their file conversion needs.
          </p>
          <button
            onClick={scrollToConverter}
            className="bg-blue-600 text-white hover:bg-blue-700 dark:bg-white dark:text-blue-700 dark:hover:bg-gray-200 px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
          >
            Convert Now
          </button>
        </div>
      </section>

      {/* ── FORMAT PICKER MODAL ───────────────────────────────────────────── */}
      {showFormatModal && detectedFormat && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={() => setShowFormatModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 relative" onClick={(e) => e.stopPropagation()}>

            <button onClick={() => setShowFormatModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" aria-label="Close">
              <X className="w-5 h-5" />
            </button>

            {/* Title */}
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors.badge}`}>
                  .{detectedFormat.ext.toUpperCase()}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-xs">
                  {detectedFormat.files[0].name}
                </span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                What do you want to do with this {detectedFormat.label}?
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Pick an action and we'll take you straight there with your file already loaded.
              </p>
            </div>

            {/* Options */}
            <div className="space-y-2">
              {detectedFormat.actions.map((option) => (
                <button
                  key={option.route + option.label}
                  onClick={() => handleOptionSelect(option)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border ${colors.bg} ${colors.border} hover:opacity-80 transition-all group`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{option.icon}</span>
                    <span className={`font-medium text-sm ${colors.text}`}>{option.label}</span>
                  </div>
                  <ArrowRight className={`w-4 h-4 ${colors.text} opacity-0 group-hover:opacity-100 transition-opacity`} />
                </button>
              ))}
            </div>

            <p className="text-xs text-center text-gray-400 dark:text-gray-500 mt-4">
              Your file will be loaded automatically on the next page.
            </p>
          </div>
        </div>
      )}

      {/* ── AUTH MODAL ────────────────────────────────────────────────────── */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowAuthModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-8 relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowAuthModal(false)} className="absolute top-4 right-4 text-gray-500 hover:text-gray-700" aria-label="Close">
              <X className="w-6 h-6" />
            </button>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Sign in to convert files</h2>
              <p className="text-gray-600 dark:text-gray-400">Create a free account to unlock unlimited conversions.</p>
            </div>
            <div className="space-y-3">
              <Link to="/signup" onClick={() => setShowAuthModal(false)} className="block w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-3 rounded-xl font-semibold text-lg transition-all">
                <div className="flex items-center justify-center space-x-2">
                  <UserPlus className="w-5 h-5" />
                  <span>Create your account</span>
                </div>
              </Link>
              <Link to="/login" onClick={() => setShowAuthModal(false)} className="block w-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-white py-3 rounded-xl font-medium transition-all">
                <div className="flex items-center justify-center space-x-2">
                  <span>Log In</span>
                </div>
              </Link>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default HomePage;