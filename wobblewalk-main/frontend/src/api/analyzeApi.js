// Use the mounted API when this build is served by the event backend. An
// absolute URL remains supported for standalone local development, but a
// Windows filesystem path must never become a fetch target.
const configuredApiUrl = (import.meta.env.VITE_API_URL || '').trim();
const API_URL = configuredApiUrl && !/^[A-Za-z]:[\\/]/.test(configuredApiUrl)
  ? configuredApiUrl.replace(/\/$/, '')
  : (window.location.protocol === 'http:' || window.location.protocol === 'https:')
    ? '/wobblewalk-api'
    : 'http://127.0.0.1:8000/wobblewalk-api';

export const analyzeRound = async (file, spinCount = 3) => {
  const formData = new FormData();
  formData.append('file', file);

  // Tell the FastAPI backend whether this is a CSV or a video.
  const isCSV = file.name.toLowerCase().endsWith('.csv');
  formData.append('file_type', isCSV ? 'csv' : 'video');

  formData.append('spin_count', String(Math.max(1, Math.min(Number(spinCount) || 3, 12))));

  try {
    const response = await fetch(`${API_URL}/api/analyze`, {
      method: 'POST',
      body: formData,
    });

    // Surface backend validation details directly in the round setup.
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Server error (${response.status}). Is the backend running?`);
    }

    const data = await response.json();
    if (data.status === 'success') return data;
    throw new Error(data.message || 'Analysis failed.');
  } catch (error) {
    console.error('API Fetch Error:', error);
    throw new Error(error.message || 'Cannot connect to the analysis backend.');
  }
};
