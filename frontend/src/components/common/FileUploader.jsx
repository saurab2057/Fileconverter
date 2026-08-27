import React, { useState, useEffect } from 'react';
import { FileText, ChevronDown, ChevronUp, Folder, Cloud, Link, HardDrive, Database } from 'lucide-react';

const DROPBOX_SCRIPT_ID = 'dropboxjs';
const DROPBOX_SCRIPT_SRC = 'https://www.dropbox.com/static/api/2/dropins.js';

const FileUploader = ({
  acceptedFormats = [],
  title = "Choose Files",
  subtitle = "Easily convert files from one format to another, online.",
  maxFileSize = "100MB",
  onFilesSelected,
  // Only the public "App key" from your Dropbox App Console — never your
  // app secret or a generated access token, which must stay server-side.
  dropboxAppKey = import.meta.env.VITE_DROPBOX_APP_KEY || 'oqnpgn4gsl6p7fh',
  className = ""
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const uploadSources = [
    { id: 'device', name: 'From Device', icon: Folder, color: 'text-white' },
    { id: 'dropbox', name: 'From Dropbox', icon: Database, color: 'text-white' },
    { id: 'googledrive', name: 'From Google Drive', icon: HardDrive, color: 'text-white' },
    { id: 'onedrive', name: 'From OneDrive', icon: Cloud, color: 'text-white' },
    { id: 'url', name: 'From URL', icon: Link, color: 'text-white' },
  ];

  // Load the Dropbox Chooser SDK once an app key is available.
  useEffect(() => {
    if (!dropboxAppKey || document.getElementById(DROPBOX_SCRIPT_ID)) return;
    const script = document.createElement('script');
    script.id = DROPBOX_SCRIPT_ID;
    script.type = 'text/javascript';
    script.src = DROPBOX_SCRIPT_SRC;
    script.setAttribute('data-app-key', dropboxAppKey);
    document.body.appendChild(script);
  }, [dropboxAppKey]);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      // BUG FIX: snapshot to plain Array immediately — dataTransfer.files
      // is only valid during the drop event and becomes empty afterward.
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      // BUG FIX: convert FileList → plain Array BEFORE resetting the input.
      // FileList is a live DOM object; e.target.value = null wipes it instantly,
      // so any parent holding a reference to the old FileList gets an empty list.
      const snapshotted = Array.from(e.target.files);
      e.target.value = null; // reset so the same file can be picked again
      handleFiles(snapshotted);
    }
  };

  // fileList is always a plain Array here (never a raw FileList)
  const handleFiles = (fileArray) => {
    if (onFilesSelected && fileArray.length > 0) {
      onFilesSelected(fileArray);
    }
  };

  // The Chooser returns metadata + a link, not File objects — fetch each
  // link and wrap it as a real File so onFilesSelected gets the same
  // shape it would from device upload or drag-and-drop.
  const filesFromDropboxSelection = async (dropboxFiles) => {
    return Promise.all(
      dropboxFiles.map(async (f) => {
        const response = await fetch(f.link);
        const blob = await response.blob();
        return new File([blob], f.name, { type: blob.type || 'application/octet-stream' });
      })
    );
  };

  const openDropboxChooser = () => {
    if (!dropboxAppKey || !window.Dropbox) {
      console.log('Dropbox is not ready yet — check dropboxAppKey and that dropins.js has loaded.');
      return;
    }
    window.Dropbox.choose({
      success: (files) => {
        filesFromDropboxSelection(files)
          .then((fileObjects) => handleFiles(fileObjects))
          .catch((err) => console.error('Error importing from Dropbox:', err));
      },
      cancel: () => {},
      linkType: 'direct', // expiring, directly-downloadable link (needed for fetch())
      multiselect: true,
      extensions: acceptedFormats.length > 0 ? acceptedFormats.map(f => `.${f}`) : undefined,
    });
  };

  const handleSourceSelect = (sourceId) => {
    setIsDropdownOpen(false);
    if (sourceId === 'device') {
      document.getElementById('file-upload-input').click();
    } else if (sourceId === 'dropbox') {
      openDropboxChooser();
    } else {
      console.log(`Selected source: ${sourceId}`);
    }
  };

  const acceptString = acceptedFormats.length > 0
    ? acceptedFormats.map(f => `.${f}`).join(',')
    : '*';

  return (
    <div className={`max-w-6xl mx-auto ${className}`}>
      {/* Subtitle */}
      <div className="text-center mb-8">
        <p className="text-xl text-gray-600 dark:text-gray-300 transition-colors duration-300">{subtitle}</p>
      </div>

      {/* Main Upload Area */}
      <div className="relative">
        <div
          className={`bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-2xl border-2 border-dashed transition-all duration-300 min-h-[400px] p-12 ${dragActive
            ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 scale-105'
            : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:scale-102'
            }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          {/* Hidden file input */}
          <input
            type="file"
            multiple
            accept={acceptString}
            onChange={handleFileInput}
            className="hidden"
            id="file-upload-input"
          />

          {/* Center Content */}
          <div className="h-full flex flex-col items-center justify-center text-center mt-8">

            {/* Dropdown Button */}
            <div className="relative mb-6">
              <button
                onClick={() => setIsDropdownOpen(prev => !prev)}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 dark:from-blue-500 dark:to-indigo-500 dark:hover:from-blue-600 dark:hover:to-indigo-600 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-200 flex items-center space-x-3 min-w-[200px] justify-center shadow-lg hover:shadow-xl transform hover:-translate-y-1"
              >
                <FileText className="w-5 h-5" />
                <span>{title}</span>
                {isDropdownOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>

              {isDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-gradient-to-br from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-500 rounded-xl shadow-xl z-50 overflow-hidden border border-blue-500">
                  {uploadSources.map((source, index) => (
                    <button
                      key={source.id}
                      onClick={() => handleSourceSelect(source.id)}
                      className={`w-full flex items-center space-x-3 px-6 py-4 text-left hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors duration-200 text-white ${index < uploadSources.length - 1 ? 'border-b border-blue-500 dark:border-blue-400' : ''
                        }`}
                    >
                      <source.icon className={`w-5 h-5 ${source.color}`} />
                      <span className="font-medium">{source.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Drag and Drop Text */}
            <div className="mb-6">
              <p className="text-gray-600 dark:text-gray-400 text-lg font-medium">
                or drag and drop files here
              </p>
            </div>

            {/* File size & terms */}
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Total size of single file or multiple files combined must be under{' '}
              <span className="text-blue-600 dark:text-blue-400 font-medium">100 MB</span>.
            </p>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Only <span className="text-blue-600 dark:text-blue-400 font-medium">5 files</span> are allowed at a time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileUploader;
