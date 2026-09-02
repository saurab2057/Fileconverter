// src/features/summarizer/pages/SummarizerPage.jsx
import React, { useState, useRef, useCallback } from 'react';
import { FileText, AlertCircle, XCircle, Download, Upload, Sparkles, Lock, UserPlus, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';

import { useAuth } from '@/lib/AuthContext';
import { fileProcessingService } from '@/services/fileProcessingService';

// ==========================================
// 1. CONFIGURATION & CONSTANTS
// ==========================================
const WORD_LIMIT = 500;

const markdownComponents = {
  p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-gray-900 dark:text-white">{children}</strong>,
  em: ({ children }) => <em className="italic text-gray-800 dark:text-gray-200">{children}</em>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 last:mb-0 space-y-1">{children}</ol>,
  ul: ({ children }) => <ul className="list-disc pl-5 mb-3 last:mb-0 space-y-1">{children}</ul>,
  li: ({ children }) => <li className="text-gray-800 dark:text-gray-200">{children}</li>,
  h1: ({ children }) => <h1 className="text-xl font-bold mb-2 mt-4 text-gray-900 dark:text-white">{children}</h1>,
  h2: ({ children }) => <h2 className="text-lg font-bold mb-2 mt-3 text-gray-900 dark:text-white">{children}</h2>,
  h3: ({ children }) => <h3 className="text-base font-semibold mb-2 mt-2 text-gray-900 dark:text-white">{children}</h3>,
};

// ==========================================
// 2. COMPONENT DEFINITION
// ==========================================
const SummarizerPage = () => {
  const timerRef = useRef(null);
  const { isAuthenticated } = useAuth();
  
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [summary, setSummary] = useState('');
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // --- Handlers ---
  const handleTextChange = (value) => {
    setFile(null);
    const words = value.trim().split(/\s+/).filter(w => w.length > 0);
    
    if (words.length > WORD_LIMIT) {
      setText(words.slice(0, WORD_LIMIT).join(' '));
    } else {
      setText(value);
    }
  };

  const handleFileUpload = (uploadedFile) => {
    if (uploadedFile?.type === 'application/pdf') {
      setFile({ name: uploadedFile.name, size: uploadedFile.size, file: uploadedFile });
      setText('');
    }
  };

  const clearInput = () => {
    setText('');
    setFile(null);
    setSummary('');
    setStatus('idle');
    setErrorMessage('');
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const formatFileSize = useCallback((bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  // --- Core Actions ---
  const summarize = async () => {
    if (status === 'processing' || (!text && !file)) return;

    setStatus('processing');
    setSummary('');
    setErrorMessage('');

    try {
      const response = await fileProcessingService.summarize({
        text: text || undefined,
        pdf: file?.file || undefined,
        max_pages: file ? '2' : undefined,
      });
      
      const fullText = response.data || response || '';
      
      // Typewriter effect
      setSummary('');
      if (timerRef.current) clearInterval(timerRef.current);

      let i = 0;
      timerRef.current = setInterval(() => {
        if (i < fullText.length) {
          setSummary(fullText.substring(0, i + 1));
          i++;
        } else {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }, 8);

      setStatus('completed');
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to generate summary.';
      setErrorMessage(msg);
      setStatus('error');
    }
  };

  const handleDownload = () => {
    const blob = new Blob([summary], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file
      ? `${file.name.replace(/\.pdf$/i, '')}_summary.txt`
      : 'summary.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Cleanup timer on unmount
  React.useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // --- Derived State ---
  const isProcessing = status === 'processing';
  const hasInput = text || file;
  const isDisabled = isProcessing || !hasInput;
  const wordCount = text.trim() ? text.trim().split(/\s+/).filter(w => w).length : 0;

  // ==========================================
  // 3. RENDER (JSX)
  // ==========================================
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header Section */}
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-3">
          Smart Summarizer
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          Paste text (up to {WORD_LIMIT} words) or upload a PDF (max 2 pages) for a concise AI summary.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <div className="flex flex-col h-[600px]">
          <div className="bg-white dark:bg-gray-800 rounded-t-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Input</h2>
            {hasInput && (
              <button onClick={clearInput} className="text-sm text-red-600 dark:text-red-400 hover:text-red-500 dark:hover:text-red-300 flex items-center gap-1">
                <XCircle className="w-4 h-4" /> Clear
              </button>
            )}
          </div>

          <div className="flex-1 bg-gray-50 dark:bg-gray-900/50 border-x border-gray-200 dark:border-gray-700 p-4">
            {file ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-center p-4">
                <div className="p-4 bg-blue-100 dark:bg-blue-900/30 rounded-xl mb-4">
                  <FileText className="w-12 h-12 text-blue-600 dark:text-blue-400" />
                </div>
                <p className="text-gray-900 dark:text-white font-medium truncate max-w-xs">{file.name}</p>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{formatFileSize(file.size)}</p>
              </div>
            ) : (
              <textarea
                value={text}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder="Paste your text here or upload a PDF document..."
                className="w-full h-full bg-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 resize-none focus:outline-none text-base leading-relaxed"
                disabled={isProcessing}
              />
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-b-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {file ? `${formatFileSize(file.size)} • 2-page limit` : `${wordCount}/${WORD_LIMIT} words`}
            </div>
            <div className="flex gap-3">
              <label className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg cursor-pointer transition-colors flex items-center gap-2">
                <Upload className="w-4 h-4" /> Upload PDF
                <input 
                  type="file" 
                  accept=".pdf" 
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} 
                  className="hidden" 
                  disabled={isProcessing} 
                />
              </label>
              <button
                onClick={isAuthenticated ? summarize : () => setShowAuthModal(true)}
                disabled={isAuthenticated ? isDisabled : false}
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20"
              >
                <Sparkles className="w-4 h-4" />
                {isProcessing ? 'Summarizing...' : 'Summarize'}
              </button>
            </div>
          </div>
        </div>

        {/* Summary Panel */}
        <div className="flex flex-col h-[600px]">
          <div className="bg-white dark:bg-gray-800 rounded-t-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Summary</h2>
            {summary && (
              <div className="flex gap-2">
                <button 
                  onClick={() => navigator.clipboard.writeText(summary)} 
                  className="px-3 py-1.5 text-sm bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg transition-colors"
                >
                  Copy
                </button>
                <button 
                  onClick={handleDownload} 
                  className="px-3 py-1.5 text-sm bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" /> Download
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 bg-gray-50 dark:bg-gray-900/50 border-x border-gray-200 dark:border-gray-700 p-4 overflow-y-auto">
            {status === 'error' ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <AlertCircle className="w-12 h-12 text-red-500 dark:text-red-400 mb-4" />
                <p className="text-red-600 dark:text-red-400">{errorMessage}</p>
              </div>
            ) : isProcessing ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-500 dark:text-gray-400">Generating summary...</p>
                </div>
              </div>
            ) : summary ? (
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                  {file ? 'Summary of your PDF:' : 'Summary of your text:'}
                </p>
                <div className="text-gray-900 dark:text-gray-200 text-base leading-relaxed">
                  <ReactMarkdown components={markdownComponents}>{summary}</ReactMarkdown>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400 text-center">
                <div>
                  <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-8 h-8 text-gray-500 dark:text-gray-400" />
                  </div>
                  <p>Your summary will appear here</p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-b-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {summary ? `${summary.split(' ').length} words` : 'Ready to summarize'}
            </div>
          </div>
        </div>
      </div>

      {/* Auth Modal */}
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
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Sign in to summarize</h2>
              <p className="text-gray-600 dark:text-gray-400">Your content is ready! Sign in to generate your summary.</p>
            </div>
            <div className="space-y-3">
              <Link to="/signup" className="block w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-3 rounded-xl font-semibold text-lg transition-all">
                <div className="flex items-center justify-center space-x-2">
                  <UserPlus className="w-5 h-5" />
                  <span>Create your Account</span>
                </div>
              </Link>
              <Link to="/login" className="block w-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-white py-3 rounded-xl font-medium transition-all">
                <div className="flex items-center justify-center space-x-2">
                  <span>Login</span>
                </div>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SummarizerPage;
