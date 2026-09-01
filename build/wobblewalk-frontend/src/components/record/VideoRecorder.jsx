import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, RefreshCw, Square, Video } from 'lucide-react';

/**
 * Records the round straight from the participant's webcam, replacing the old
 * file-upload dropzone. The recorded blob is handed to the same
 * onRecordingComplete(File) callback the dropzone used, so the multipart shape
 * the backend receives is unchanged.
 *
 * CONTAINER / CODEC NOTE
 * ----------------------
 * backend/wobblewalk_backend/app.py gates uploads on the filename suffix
 * (VIDEO_EXTENSIONS = .mp4 / .mov / .avi) *before* the video is decoded, so a
 * default MediaRecorder WebM would be rejected with HTTP 400 even though the
 * OpenCV/MediaPipe pipeline in video_tracking.py would happily read it. We
 * therefore negotiate an MP4 profile up front (Chrome/Edge 126+, Safari) and
 * only detect WebM-only browsers in order to explain the problem — never to
 * upload something the endpoint will refuse.
 */
const MP4_CANDIDATES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4;codecs=avc1.42E01E',
  'video/mp4;codecs=h264',
  'video/mp4',
];

export const pickRecordingFormat = () => {
  if (typeof window === 'undefined' || typeof window.MediaRecorder === 'undefined') {
    return { supported: false, reason: 'This browser cannot record video in the page. Use Chrome or Edge.' };
  }
  const mimeType = MP4_CANDIDATES.find((type) => window.MediaRecorder.isTypeSupported(type));
  if (mimeType) return { supported: true, mimeType, extension: 'mp4' };
  return {
    supported: false,
    reason: 'This browser can only record WebM, which the analysis service does not accept. Open this station in Chrome or Edge.',
  };
};

const VideoRecorder = ({ onRecordingComplete, isLoading }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);

  const [phase, setPhase] = useState('starting'); // starting | ready | recording
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const openCamera = useCallback(async () => {
    setError('');
    setPhase('starting');
    const format = pickRecordingFormat();
    if (!format.supported) {
      setError(format.reason);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setPhase('ready');
    } catch (err) {
      setError(
        err && err.name === 'NotAllowedError'
          ? 'Camera access was denied. Allow the camera, then try again.'
          : 'Could not open the camera. Check that nothing else is using it.',
      );
    }
  }, []);

  useEffect(() => {
    openCamera();
    return stopStream;
  }, [openCamera, stopStream]);

  useEffect(() => {
    if (phase !== 'recording') return undefined;
    const started = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 250);
    return () => clearInterval(id);
  }, [phase]);

  const startRecording = () => {
    const format = pickRecordingFormat();
    if (!format.supported || !streamRef.current) {
      setError(format.reason || 'The camera is not ready yet.');
      return;
    }
    chunksRef.current = [];
    const recorder = new MediaRecorder(streamRef.current, { mimeType: format.mimeType });
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: format.mimeType });
      stopStream();
      // A File (not a bare Blob) so the existing FormData append keeps sending
      // a filename the backend's extension check accepts.
      const file = new File([blob], `wobblewalk-round-${Date.now()}.${format.extension}`, {
        type: format.mimeType,
      });
      onRecordingComplete(file);
    };
    recorder.onerror = () => setError('Recording failed. Reload the page and try again.');
    recorderRef.current = recorder;
    setElapsed(0);
    recorder.start(1000);
    setPhase('recording');
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    setPhase('starting');
  };

  const mmss = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;

  return (
    <div className="w-full max-w-2xl mx-auto glow-card rounded-lg">
      <div className={`relative flex flex-col items-center overflow-hidden rounded-lg border-[3px] border-ink-900 bg-cream text-ink-900 shadow-lift ${isLoading ? 'pointer-events-none opacity-50' : ''}`}>
        <div className="relative h-72 w-full border-b-[3px] border-ink-900 bg-void-900">
          <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
          {phase === 'recording' && (
            <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full border-[3px] border-ink-900 bg-punch px-3 py-1.5 shadow-soft">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full border-2 border-ink-900 bg-zap" />
              <span className="font-mono text-xs font-extrabold uppercase tracking-[0.12em] text-cream">REC {mmss}</span>
            </div>
          )}
        </div>

        <div className="flex w-full flex-col items-center gap-3 p-6 text-center">
          {phase === 'recording' ? (
            <>
              <p className="text-sm font-semibold text-ink-600">Three spins, then walk the straight line. Stop when you are done.</p>
              <button onClick={stopRecording} className="inline-flex items-center gap-2 rounded-full border-[3px] border-ink-900 bg-ink-900 px-7 py-3 font-display text-sm font-extrabold uppercase tracking-[0.12em] text-cream shadow-soft transition-transform duration-200 hover:-translate-y-0.5 hover:-rotate-2">
                <Square className="h-4 w-4" /> I&apos;m done
              </button>
            </>
          ) : (
            <>
              <p className="font-display text-lg font-extrabold text-ink-900">Record the round from this camera</p>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-500">Full body in frame — you control when it stops.</p>
              <button
                onClick={startRecording}
                disabled={phase !== 'ready'}
                className="inline-flex items-center gap-2 rounded-full border-[3px] border-ink-900 bg-punch px-7 py-3 font-display text-sm font-extrabold uppercase tracking-[0.12em] text-cream shadow-soft transition-transform duration-200 hover:-translate-y-0.5 hover:-rotate-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:rotate-0"
              >
                <Video className="h-4 w-4" /> Start recording
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-3 flex items-center justify-center gap-3 rounded-lg border-[3px] border-ink-900 bg-punch px-4 py-3 shadow-soft">
          <AlertTriangle className="h-5 w-5 shrink-0 text-cream" />
          <p className="text-sm font-bold text-cream">{error}</p>
          <button onClick={openCamera} className="inline-flex items-center gap-1.5 rounded-full border-[3px] border-ink-900 bg-zap px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.12em] text-ink-900 shadow-soft transition-transform duration-200 hover:-translate-y-0.5">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      )}
    </div>
  );
};

export default VideoRecorder;
