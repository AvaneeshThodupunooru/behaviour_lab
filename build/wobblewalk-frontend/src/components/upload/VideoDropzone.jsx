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
        className={`group relative flex h-72 w-full flex-col items-center justify-center overflow-hidden rounded-lg border-[3px] border-ink-900 transition-all duration-300 ${
          dragActive ? 'bg-zap shadow-glow' : 'bg-cream text-ink-900 shadow-lift'
        } ${isLoading ? 'pointer-events-none opacity-50' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="pointer-events-none absolute inset-4 rounded-md border-[3px] border-dashed border-ink-900/25" />
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
            <div className={`relative mb-5 grid h-16 w-16 place-items-center rounded-md border-[3px] border-ink-900 text-cream shadow-soft transition-transform duration-300 ${dragActive ? 'scale-110 rotate-6 bg-brand-600' : 'bg-punch group-hover:scale-105 group-hover:-rotate-6'}`}>
              <UploadCloud className="h-7 w-7" />
            </div>
            <p className="text-base font-extrabold text-ink-900">
              Drop the round video, or <span className="text-brand-600 underline decoration-brand-400 decoration-[3px] underline-offset-4">browse</span>
            </p>
            <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-500">MP4 / MOV / AVI - full body visible</p>
          </>
        ) : (
          <div className="relative flex flex-col items-center p-6 text-center animate-scale-in">
            <div className="relative">
              <div className="mb-4 grid h-20 w-20 place-items-center rounded-md border-[3px] border-ink-900 bg-sky text-ink-900 shadow-soft"><FileVideo className="h-9 w-9" /></div>
              {!isLoading && (
                <button onClick={clearFile} className="absolute -right-2 -top-2 rounded-full border-[3px] border-ink-900 bg-cream p-1.5 text-ink-900 shadow-soft transition-colors hover:bg-punch hover:text-cream" aria-label="Remove video">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <p className="max-w-[240px] truncate text-sm font-extrabold text-ink-900">{selectedFile.name}</p>
            <p className="mt-1 font-mono text-xs text-ink-500">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB / ready</p>
          </div>
        )}
      </div>
      {error && <p className="mt-3 text-center text-sm font-bold text-punch">{error}</p>}
    </div>
  );
};

export default VideoDropzone;
