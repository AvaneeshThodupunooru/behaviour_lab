// Base URL comes from .env (VITE_API_URL); falls back to local dev.
const API_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

// A rejected fetch() is a transport failure: the request never got an HTTP
// response, so the browser hands us a bare TypeError whose message is the
// famously unhelpful "Failed to fetch". That single string covers a backend
// that is not listening, an upload blocked by an extension or antivirus, and a
// connection dropped mid-body - three problems with three different fixes.
// Rather than show it to the participant, retry once (blips are common when the
// backend has just restarted) and then probe /health to say which one it was.
const NETWORK_RETRY_DELAY_MS = 700;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const buildForm = (file, spinCount) => {
  const formData = new FormData();
  formData.append('file', file);

  // Tell the FastAPI backend whether this is a CSV or a video.
  const isCSV = (file.name || '').toLowerCase().endsWith('.csv');
  formData.append('file_type', isCSV ? 'csv' : 'video');

  formData.append('spin_count', String(Math.max(1, Math.min(Number(spinCount) || 3, 12))));
  return formData;
};

/**
 * One upload attempt. Errors carrying a `status` came back from the server, so
 * their message is already the backend's own explanation and must not be
 * replaced by a transport diagnosis.
 */
const postVideo = async (file, spinCount) => {
  const response = await fetch(`${API_URL}/api/analyze`, {
    method: 'POST',
    body: buildForm(file, spinCount),
  });

  // Surface backend validation details directly in the round setup.
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const failure = new Error(errorData.detail || `Server error (${response.status}). Is the backend running?`);
    failure.status = response.status;
    throw failure;
  }

  const data = await response.json();
  if (data.status === 'success') return data;
  throw new Error(data.message || 'Analysis failed.');
};

/** Turn a transport failure into something the person running the station can act on. */
const describeTransportFailure = async () => {
  try {
    const probe = await fetch(`${API_URL}/health`, { cache: 'no-store' });
    if (probe.ok) {
      return 'The analysis service is running but the video upload never reached it. '
        + 'A browser extension, antivirus, or proxy is most likely blocking it - '
        + 'try this station in a private window with extensions off.';
    }
    return `The analysis service answered a health check with ${probe.status}. Restart the backend and try again.`;
  } catch {
    return 'The analysis service is not reachable. Check that the backend is still running, then try again.';
  }
};

export const analyzeRound = async (file, spinCount = 3) => {
  // An empty recording would come back as an opaque HTTP 400 from the server;
  // catching it here names the actual problem (nothing was captured).
  if (!file || file.size === 0) {
    throw new Error('The recording came back empty - nothing was captured. Record the round again.');
  }

  try {
    return await postVideo(file, spinCount);
  } catch (error) {
    if (error.status) throw error;
    console.error('WobbleWalk upload: no HTTP response, retrying once.', error);
    await sleep(NETWORK_RETRY_DELAY_MS);
    try {
      return await postVideo(file, spinCount);
    } catch (retryError) {
      if (retryError.status) throw retryError;
      console.error('WobbleWalk upload: no HTTP response on retry either.', retryError);
      throw new Error(await describeTransportFailure());
    }
  }
};
