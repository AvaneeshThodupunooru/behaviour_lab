// eventSession.js — thin wrapper connecting WobbleWalk to the common
// Behavior Lab event backend. Mirrors the browser-side contract of
// static/shared/event-client.js (session_id / api_base / return_url query
// params) without pulling any dependencies into the React bundle.
//
// Used by:
//   pages/HomePage.jsx  -> getEventParams(), submitWobbleWalkResult()
//   pages/ReportPage.jsx -> getEventParams(), eventShellUrl()

const ENV_API_BASE = (import.meta.env.VITE_EVENT_API_URL || '').replace(/\/$/, '');

/**
 * Reads the event session context from the current page URL:
 *   ?session_id=EVT-2026-00001&return_url=%2F&api_base=
 * api_base defaults to same-origin (relative fetches), which is correct
 * for the single-process deployment.
 */
export function getEventParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    sessionId: params.get('session_id') || '',
    apiBase: ((params.get('api_base') || '') || ENV_API_BASE).replace(/\/$/, ''),
    returnUrl: params.get('return_url') || '/',
  };
}

/**
 * Builds the shell URL to return to after the game, keeping the session id
 * in the query string so the event UI restores this participant's checklist.
 */
export function eventShellUrl(eventParams) {
  const base = eventParams.returnUrl || '/';
  if (!eventParams.sessionId) return base;
  const separator = base.indexOf('?') === -1 ? '?' : '&';
  return `${base}${separator}session_id=${encodeURIComponent(eventParams.sessionId)}`;
}

/**
 * POSTs the game_metrics object produced by the existing analysis pipeline
 * to the common backend. Best-effort by design: callers treat a failure as
 * non-blocking (the participant still sees their score on the report page).
 *
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function submitWobbleWalkResult(sessionId, gameMetrics, apiBase = '') {
  if (!sessionId) return { ok: false, error: 'No event session id was present on this page.' };
  try {
    const response = await fetch(
      `${apiBase}/api/sessions/${encodeURIComponent(sessionId)}/games/wobblewalk`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gameMetrics),
      }
    );
    if (response.ok) return { ok: true };
    const body = await response.json().catch(() => ({}));
    return { ok: false, error: body.detail || `Server returned ${response.status}` };
  } catch (error) {
    return { ok: false, error: (error && error.message) || 'Network error' };
  }
}
