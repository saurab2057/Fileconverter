// src/components/common/ConverterPage.jsx
import React, { useState } from 'react';
import { Settings, FileText, Loader, AlertCircle, XCircle, Download, Lock, UserPlus, X } from 'lucide-react';
import { useLocation, Link } from 'react-router-dom'; // ✅ FIXED: removed unused useNavigate
import { useAuth } from '@/lib/AuthContext';
import FileUploader from '@/components/common/FileUploader';
import { useFileBatch } from '@/hooks/useFileBatch';
import { fileProcessingService } from '@/services/fileProcessingService';
import { useToast } from '@/context/ToastContext';

const ConverterPage = ({ fromFormat, toFormat, title, description, settingsComponent: SettingsComponent, defaultSettings }) => {
  const location = useLocation();
  // ✅ FIXED: removed `const navigate = useNavigate()` — was imported but never used
  const { isAuthenticated } = useAuth();
  const toast = useToast();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [editingFileId, setEditingFileId] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingComplete, setProcessingComplete] = useState(false);

  const {
    files,
    uploadLimitExceeded,
    addFiles,
    removeFile,
    updateFileSettings,
    updateFileStatus,
    updateAllStatus,
    resetBatch,
    hasFiles,
    canProcess,
    maxAllowedFiles,
    formatFileSize,
  } = useFileBatch(defaultSettings);

  // ✅ FIXED: was [] (empty deps) — would silently fail if location.state
  // changed after mount. Now consistent with CompressorPage.
  React.useEffect(() => {
    if (location.state?.initialFiles && files.length === 0) {
      location.state.initialFiles.forEach(file => {
        addFiles([file.file]);
        if (file.settings) {
          updateFileSettings(file.id, file.settings);
        }
      });
    }
  }, []);

  const startConversion = async () => {
    setIsProcessing(true);
    const filesToProcess = files.filter(f => f.status === 'ready');
    updateAllStatus('ready', 'converting');

    try {
      const results = await fileProcessingService.batchConvert(filesToProcess, toFormat);

      filesToProcess.forEach((file, index) => {
        const result = results[index];
        if (result) {
          updateFileStatus(file.id, result.success ? 'completed' : 'error', {
            downloadUrl: result.downloadUrl || null,
            errorMessage: result.message || null,
          });
          // 🔔 Show toast for each failed file
          if (!result.success) {
            toast.error(`❌ ${file.name}: ${result.message}`, 6000);
          }
        } else {
          updateFileStatus(file.id, 'error', { errorMessage: 'No result from server.' });
          toast.error(`❌ ${file.name}: No result from server.`, 6000);
        }
      });
      setProcessingComplete(true);
    } catch (error) {
      // ✅ Backend returned 500/503 or network error
      // Handled by api.jsx interceptor which shows toast and updates file statuses to 'error'
      const errorMessage = error.response?.data?.message || 'Conversion failed.';
      filesToProcess.forEach(file => {
        updateFileStatus(file.id, 'error', { errorMessage });
      });
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartOver = () => {
    resetBatch();
    setProcessingComplete(false);
  };

  const fileToEdit = files.find(f => f.id === editingFileId);
  const totalFiles = files.length;
  const completedOrErrorFiles = files.filter(f => f.status === 'completed' || f.status === 'error').length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      {SettingsComponent && (
        <SettingsComponent
          isOpen={!!editingFileId}
          onClose={() => setEditingFileId(null)}
          file={fileToEdit}
          onSave={updateFileSettings}
        />
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">{title}</h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">{description}</p>
        </div>

        <FileUploader
          acceptedFormats={[fromFormat]}
          title=" Choose Files"
          subtitle={`Drop your ${fromFormat.toUpperCase()} files here`}
          maxFileSize="100MB"
          onFilesSelected={addFiles}
          className="mb-8"
        />

        {uploadLimitExceeded && (
          <p className="text-red-500 dark:text-red-400 text-center mb-4">
            You can only upload a maximum of {maxAllowedFiles} files.
          </p>
        )}

        {hasFiles && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 mb-8">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Files to Convert ({totalFiles})</h3>

              {isProcessing && (
                <p className="text-sm text-blue-600 dark:text-blue-400 mb-4">
                  Processing {completedOrErrorFiles} of {totalFiles} files...
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
                          <button onClick={() => setEditingFileId(file.id)} className="p-2 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/40">
                            <Settings className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                          </button>
                          <button onClick={() => removeFile(file.id)} className="text-red-600 dark:text-red-400 text-sm font-medium px-1 py-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20">
                            Remove
                          </button>
                        </>
                      )}
                      {file.status === 'converting' && (
                        <Loader className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
                      )}
                      {file.status === 'completed' && (
                        <div className="flex items-center space-x-2">
                          <a
                            href={file.downloadUrl}
                            download
                            className="bg-green-600 hover:bg-green-700 text-white p-2 sm:px-3 sm:py-2 rounded-lg text-sm font-medium flex items-center"
                          >
                            <Download className="w-5 h-5" />
                            <span className="hidden sm:inline ml-1">Download</span>
                          </a>
                          <button onClick={() => removeFile(file.id)} className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-white p-2 sm:px-3 sm:py-2 rounded-lg text-sm font-medium flex items-center">
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
                          <button onClick={() => removeFile(file.id)} className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center ml-2">
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

        {hasFiles && !processingComplete && (
          <div className="text-center mb-8">
            {isAuthenticated ? (
              <button
                onClick={startConversion}
                disabled={isProcessing || !canProcess}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-blue-400 disabled:to-indigo-400 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all flex items-center space-x-2 mx-auto shadow-lg hover:shadow-xl transform hover:-translate-y-1 disabled:transform-none"
              >
                {isProcessing ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    <span>Converting</span>
                  </>
                ) : (
                  <span>Convert {files.filter(f => f.status === 'ready').length} File{files.length > 1 ? 's' : ''}</span>
                )}
              </button>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1 flex items-center justify-center space-x-2 mx-auto"
              >
                <span>Convert</span>
              </button>
            )}
          </div>
        )}

        {processingComplete && (
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

export default ConverterPage;