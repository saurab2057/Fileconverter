import React, { useState, useMemo } from 'react';
import { Settings, FileText, Loader, AlertCircle, XCircle, Download, Lock, UserPlus, X } from 'lucide-react';
import { useLocation, Link, useNavigate } from 'react-router-dom';

import apiClient from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import FileUploader from '@/components/common/FileUploader';

const MAX_ALLOWED_FILES = 5;

const ConverterPage = ({ fromFormat, toFormat, title, description, settingsComponent: SettingsComponent, defaultSettings }) => {

  const location = useLocation();
  const navigate = useNavigate();
  const { authLoading, isAuthenticated } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [files, setFiles] = useState(location.state?.initialFiles || []);
  const [isConverting, setIsConverting] = useState(false);
  const [conversionComplete, setConversionComplete] = useState(false);
  const [editingFileId, setEditingFileId] = useState(null);
  const [uploadLimitExceeded, setUploadLimitExceeded] = useState(false);

  const startConversion = async () => {
    setIsConverting(true);
    setFiles(prev => prev.map(f => (f.status === 'ready' ? { ...f, status: 'converting' } : f)));

    const filesToProcess = files.filter(f => f.status === 'ready');
    if (filesToProcess.length === 0) {
      setIsConverting(false);
      return;
    }

    try {
      const formData = new FormData();

      const settingsPayload = filesToProcess.map(file => ({
        originalName: file.name,
        settings: file.settings,
      }));

      filesToProcess.forEach(file => {
        formData.append('files', file.file, file.name);
      });

      formData.append('settings', JSON.stringify(settingsPayload));
      formData.append('toFormat', toFormat);

      const response = await apiClient.post('/api/convert/batch', formData);
      const results = response.data;

      setFiles(prevFiles => {
        const processedFiles = [...prevFiles];
        let resultIndex = 0;

        processedFiles.forEach((file, index) => {
          if (file.status === 'converting') {
            const result = results[resultIndex];
            if (result) {
              processedFiles[index] = {
                ...file,
                status: result.success ? 'completed' : 'error',
                downloadUrl: result.downloadUrl || null,
                errorMessage: result.message || null,
              };
            } else {
              processedFiles[index] = { ...file, status: 'error', errorMessage: 'No result from server for this file.' };
            }
            resultIndex++;
          }
        });
        return processedFiles;
      });

    } catch (error) {
      console.error('An error occurred during the batch conversion request:', error);

      const status = error.response?.status;
      if (status === 500 || status === 503) {
        navigate(`/error/${status}`);
        return;
      }

      let errorMessage = 'An unknown server error occurred.';
      if (error.response) {
        if (error.response.data?.message) {
          errorMessage = error.response.data.message;
        } else {
          errorMessage = `Server responded with status: ${error.response.status}`;
        }
      } else if (error.request) {
        errorMessage = 'No response received from server. Please check your network connection.';
      } else {
        errorMessage = error.message || 'An unexpected error occurred.';
      }

      setFiles(prev => prev.map(f => (f.status === 'converting' ? { ...f, status: 'error', errorMessage } : f)));
    }

    setIsConverting(false);
    setConversionComplete(true);
  };

  const handleStartOver = () => {
    setFiles([]);
    setConversionComplete(false);
    setIsConverting(false);
    setUploadLimitExceeded(false);
  };

  const handleSaveSettings = (fileId, newSettings) => {
    setFiles(prevFiles =>
      prevFiles.map(file =>
        file.id === fileId ? { ...file, settings: newSettings } : file
      )
    );
  };

  // BUG FIX: FileUploader now passes a plain Array, so no Array.from() needed —
  // but Array.from(array) is harmless and kept for safety.
  const handleFilesSelected = (fileList) => {
    const filesToAdd = Array.from(fileList);
    const availableSlots = MAX_ALLOWED_FILES - files.length;

    if (filesToAdd.length > availableSlots) {
      setUploadLimitExceeded(true);
      const limited = filesToAdd.slice(0, availableSlots);
      const newFiles = limited.map(file => ({
        id: crypto.randomUUID(),
        file,
        name: file.name,
        size: file.size,
        status: 'ready',
        settings: { ...defaultSettings },
      }));
      setFiles(prev => [...prev, ...newFiles]);
    } else {
      setUploadLimitExceeded(false);
      const newFiles = filesToAdd.map(file => ({
        id: crypto.randomUUID(),
        file,
        name: file.name,
        size: file.size,
        status: 'ready',
        settings: { ...defaultSettings },
      }));
      setFiles(prev => [...prev, ...newFiles]);
    }

    setConversionComplete(false);
  };

  const removeFile = (id) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    setUploadLimitExceeded(false);
  };

  const formatFileSize = useMemo(() => (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  const fileToEdit = files.find(f => f.id === editingFileId);
  const totalFilesToConvert = files.length;
  // BUG FIX: removed unused `convertingFiles` variable that caused a lint warning
  const completedOrErrorFiles = files.filter(f => f.status === 'completed' || f.status === 'error').length;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader className="w-12 h-12 text-blue-600 animate-spin" />
        <p className="ml-4 text-xl text-gray-700 dark:text-gray-300">Verifying session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">

      {SettingsComponent && (
        <SettingsComponent
          isOpen={!!editingFileId}
          onClose={() => setEditingFileId(null)}
          file={fileToEdit}
          onSave={handleSaveSettings}
        />
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">{title}</h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">{description}</p>
        </div>

        <FileUploader
          acceptedFormats={[fromFormat]}
          title="Add More Files"
          subtitle={`Drop your ${fromFormat.toUpperCase()} files here or click to browse (Max ${MAX_ALLOWED_FILES} files)`}
          maxFileSize="100MB"
          onFilesSelected={handleFilesSelected}
          className="mb-8"
        />

        {uploadLimitExceeded && (
          <p className="text-red-500 dark:text-red-400 text-center mb-4">
            You can only upload a maximum of {MAX_ALLOWED_FILES} files.
          </p>
        )}

        {files.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 mb-8">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Files to Convert ({files.length})</h3>

              {isConverting && (
                <p className="text-sm text-blue-600 dark:text-blue-400 mb-4">
                  Processing {completedOrErrorFiles} of {totalFilesToConvert} files...
                </p>
              )}

              <div className="space-y-3">
                {files.map((file) => (
                  <div key={file.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg shrink-0">
                        <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="truncate">
                        <p className="font-medium text-gray-900 dark:text-white truncate">{file.name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{formatFileSize(file.size)}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1 shrink-0">
                      {file.status === 'ready' && (
                        <>
                          <button onClick={() => setEditingFileId(file.id)} className="p-2 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/40" aria-label="Settings">
                            <Settings className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                          </button>
                          <button onClick={() => removeFile(file.id)} className="text-red-600 dark:text-red-400 text-sm font-medium px-1 py-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20">
                            Remove
                          </button>
                        </>
                      )}
                      {file.status === 'converting' && (
                        <div className="flex items-center space-x-2">
                          <Loader className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
                        </div>
                      )}
                      {file.status === 'completed' && (
                        <div className="flex items-center space-x-2">
                          <a
                            href={file.downloadUrl?.startsWith('https://') ? file.downloadUrl : '#'}
                            download
                            aria-label="Download"
                            className="bg-green-600 hover:bg-green-700 text-white p-2 sm:px-3 sm:py-2 rounded-lg text-sm font-medium flex items-center transition-all"
                          >
                            <Download className="w-5 h-5" />
                            <span className="hidden sm:inline ml-1">Download</span>
                          </a>
                          <button
                            onClick={() => removeFile(file.id)}
                            aria-label="Clear"
                            className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-white p-2 sm:px-3 sm:py-2 rounded-lg text-sm font-medium flex items-center transition-all"
                          >
                            <XCircle className="w-5 h-5" />
                            <span className="hidden sm:inline ml-1">Clear</span>
                          </button>
                        </div>
                      )}
                      {file.status === 'error' && (
                        <>
                          <div className="flex items-center space-x-2 text-red-500" title={file.errorMessage}>
                            <AlertCircle className="w-5 h-5" />
                            <span>Error</span>
                          </div>
                          <button
                            onClick={() => removeFile(file.id)}
                            aria-label="Clear"
                            className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-1 ml-2"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {files.length > 0 && !conversionComplete && (
          <div className="text-center mb-8">
            {isAuthenticated ? (
              <button
                onClick={startConversion}
                disabled={isConverting}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-blue-400 disabled:to-indigo-400 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-200 flex items-center space-x-2 mx-auto shadow-lg hover:shadow-xl transform hover:-translate-y-1 disabled:transform-none"
              >
                {isConverting ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    <span>Converting</span>
                  </>
                ) : (
                  <span>Convert {files.length} File{files.length > 1 ? 's' : ''}</span>
                )}
              </button>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1 flex items-center justify-center space-x-2 mx-auto"
              >
                <span>Convert</span>
              </button>
            )}
          </div>
        )}

        {/* BUG FIX: show "Convert More" if complete, regardless of error/success mix */}
        {conversionComplete && (
          <div className="text-center mb-8">
            <button
              onClick={handleStartOver}
              className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all"
            >
              Convert More Files
            </button>
          </div>
        )}
      </div>

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
              <p className="text-gray-600 dark:text-gray-400">Your files are ready! Sign in to unlock conversion.</p>
            </div>
            <div className="space-y-3">
              <Link to="/signup" onClick={() => setShowAuthModal(false)} className="block w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-3 rounded-xl font-semibold text-lg transition-all">
                <div className="flex items-center justify-center space-x-2">
                  <UserPlus className="w-5 h-5" /><span>Create your Account</span>
                </div>
              </Link>
              <Link to="/login" onClick={() => setShowAuthModal(false)} className="block w-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-white py-3 rounded-xl font-medium transition-all">
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

export default ConverterPage;