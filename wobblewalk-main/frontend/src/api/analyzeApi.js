// Base URL comes from .env (VITE_API_URL); falls back to local dev.
const API_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

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
