import React, { useState } from 'react';
import { FileVideo, UploadCloud, X } from 'lucide-react';

const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi'];
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/avi'];

const VideoDropzone = ({ onFileSelect, isLoading }) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError] = useState('');

  const handleDrag = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(event.type === 'dragenter' || event.type === 'dragover');
  };

  const validateAndSetFile = (file) => {
    setError('');
    if (!file) return;
    const fileName = file.name.toLowerCase();
    const valid = VIDEO_TYPES.includes(file.type) || VIDEO_EXTENSIONS.some((ext) => fileName.endsWith(ext));
    if (!valid) {
      setError('Please upload an MP4, MOV, or AVI video.');
      return;
    }
    setSelectedFile(file);
    onFileSelect(file);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    validateAndSetFile(event.dataTransfer.files?.[0]);
  };

  const clearFile = () => {
    setSelectedFile(null);
    setError('');
    onFileSelect(null);
  };

  return (
    <div className="w-full max-w-2xl mx-auto glow-card rounded-lg">
      <div
        className={`group relative flex h-72 w-full flex-col items-center justify-center overflow-hidden rounded-lg transition-all duration-300 ${
          dragActive ? 'bg-brand-50/70 ring-2 ring-brand-500/60 shadow-glow' : 'surface hover:-translate-y-0.5 hover:shadow-lift'
        } ${isLoading ? 'pointer-events-none opacity-50' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="pointer-events-none absolute inset-4 rounded-md border border-dashed border-ink-900/10" />
        {!selectedFile ? (
          <>
            <input
              type="file"
              className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
              onChange={(event) => validateAndSetFile(event.target.files?.[0])}
              accept=".mp4,.mov,.avi"
              disabled={isLoading}
              aria-label="Upload round video"
            />
            <div className={`relative mb-5 grid h-16 w-16 place-items-center rounded-lg text-white transition-transform duration-300 ${dragActive ? 'scale-110 bg-brand-600' : 'bg-ink-900 group-hover:scale-105'}`}>
              <UploadCloud className="h-7 w-7" />
            </div>
            <p className="text-base font-semibold text-ink-800">
              Drop the round video, or <span className="text-brand-600 underline decoration-brand-300 underline-offset-4">browse</span>
            </p>
            <p className="mt-2 text-xs font-medium text-ink-400">MP4 / MOV / AVI - full body visible</p>
          </>
        ) : (
          <div className="relative flex flex-col items-center p-6 text-center animate-scale-in">
            <div className="relative">
              <div className="mb-4 grid h-20 w-20 place-items-center rounded-lg bg-brand-50 text-brand-600"><FileVideo className="h-9 w-9" /></div>
              {!isLoading && (
                <button onClick={clearFile} className="absolute -right-2 -top-2 rounded-full border border-ink-900/10 bg-white p-1.5 shadow-soft transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-500" aria-label="Remove video">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <p className="max-w-[240px] truncate text-sm font-semibold text-ink-800">{selectedFile.name}</p>
            <p className="mt-1 font-mono text-xs text-ink-400">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB / ready</p>
          </div>
        )}
      </div>
      {error && <p className="mt-3 text-center text-sm font-medium text-red-500">{error}</p>}
    </div>
  );
};

export default VideoDropzone;
