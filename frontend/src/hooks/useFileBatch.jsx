// src/hooks/useFileBatch.js
import { useState, useCallback, useMemo } from 'react';

const MAX_ALLOWED_FILES = 5;

/**
 * Custom hook for batch file processing (conversion/compression).
 * @param {Object} defaultSettings - Default settings for new files.
 * @returns {Object} - File state and management functions.
 */
export const useFileBatch = (defaultSettings = {}) => {
  const [files, setFiles] = useState([]);
  const [uploadLimitExceeded, setUploadLimitExceeded] = useState(false);

  // Add new files to the batch
  const addFiles = useCallback((fileList) => {
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
  }, [files.length, defaultSettings]);

  // Remove a file by ID
  const removeFile = useCallback((id) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    setUploadLimitExceeded(false);
  }, []);

  // Update settings for a specific file
  const updateFileSettings = useCallback((fileId, newSettings) => {
    setFiles(prev =>
      prev.map(file =>
        file.id === fileId ? { ...file, settings: newSettings } : file
      )
    );
  }, []);

  // Update file status (used during processing)
  const updateFileStatus = useCallback((fileId, status, additionalProps = {}) => {
    setFiles(prev =>
      prev.map(file =>
        file.id === fileId
          ? { ...file, status, ...additionalProps }
          : file
      )
    );
  }, []);

  // Bulk update all files with a given status
  const updateAllStatus = useCallback((fromStatus, toStatus) => {
    setFiles(prev =>
      prev.map(file =>
        file.status === fromStatus
          ? { ...file, status: toStatus }
          : file
      )
    );
  }, []);

  // Reset the entire batch
  const resetBatch = useCallback(() => {
    setFiles([]);
    setUploadLimitExceeded(false);
  }, []);

  // Derived values
  const readyFiles = useMemo(
    () => files.filter(f => f.status === 'ready'),
    [files]
  );

  const processingFiles = useMemo(
    () => files.filter(f => f.status === 'converting'),
    [files]
  );

  const completedFiles = useMemo(
    () => files.filter(f => f.status === 'completed'),
    [files]
  );

  const errorFiles = useMemo(
    () => files.filter(f => f.status === 'error'),
    [files]
  );

  const hasFiles = files.length > 0;
  const canProcess = readyFiles.length > 0;
  const isProcessing = processingFiles.length > 0;
  const allDone = files.length > 0 && 
    (completedFiles.length + errorFiles.length) === files.length;

  // Format file size helper (memoized)
  const formatFileSize = useMemo(() => (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  return {
    // State
    files,
    uploadLimitExceeded,
    // Actions
    addFiles,
    removeFile,
    updateFileSettings,
    updateFileStatus,
    updateAllStatus,
    resetBatch,
    // Derived
    readyFiles,
    processingFiles,
    completedFiles,
    errorFiles,
    hasFiles,
    canProcess,
    isProcessing,
    allDone,
    // Constants & helpers
    maxAllowedFiles: MAX_ALLOWED_FILES,
    formatFileSize,
  };
};

export default useFileBatch;