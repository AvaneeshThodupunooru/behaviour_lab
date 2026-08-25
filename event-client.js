/**
 * event-client.js — shared helper loaded by every static game page
 * (Timer, Gaze, DEADPAN) to talk to the common backend.
 *
 * Deliberately framework-free (matches the "no build step" constraint of
 * the games that load it) and deliberately small: it only does session
 * plumbing + reliable submission, it does not know anything about any
 * individual game's metrics.
 *
 * Usage from a game page:
 *   const { sessionId, apiBase, returnUrl } = EventClient.getParams();
 *   await EventClient.submitResult(sessionId, 'timer', myResultObject);
 */
(function (root) {
  'use strict';

  var STORAGE_PREFIX = 'behaviorLabPending::';
  var MAX_ATTEMPTS = 3;
  var RETRY_DELAY_MS = 1200;

  /**
   * Reads session_id / api_base / return_url from the current page's URL
   * query string. api_base defaults to same-origin (empty string, i.e.
   * relative fetches) which is correct for the single-process deployment;
   * it's only ever non-empty if a game is being tested standalone against
   * a backend running on a different origin.
   */
  function getParams() {
    var params = new URLSearchParams(window.location.search);
    return {
      sessionId: params.get('session_id') || '',
      apiBase: (params.get('api_base') || '').replace(/\/$/, ''),
      returnUrl: params.get('return_url') || '/'
    };
  }

  function pendingKey(sessionId, gameName) {
    return STORAGE_PREFIX + sessionId + '::' + gameName;
  }

  function savePending(sessionId, gameName, resultObj) {
    try {
      localStorage.setItem(pendingKey(sessionId, gameName), JSON.stringify({
        result: resultObj,
        savedAt: new Date().toISOString()
      }));
    } catch (err) {
      // localStorage can throw if full/disabled - nothing more we can do,
      // the caller still has the in-memory result to show on screen.
      console.warn('EventClient: could not save pending result locally', err);
    }
  }

  function clearPending(sessionId, gameName) {
    try {
      localStorage.removeItem(pendingKey(sessionId, gameName));
    } catch (err) { /* ignore */ }
  }

  function getPending(sessionId, gameName) {
    try {
      var raw = localStorage.getItem(pendingKey(sessionId, gameName));
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  /**
   * POST a game result to /api/sessions/{sessionId}/games/{gameName}.
   * Retries a few times with a short delay (covers a flaky wifi blip
   * during the handoff between games), then falls back to localStorage
   * so a later retry (manual button, or next page load) can resend it.
   *
   * @returns {Promise<{ok:boolean, submitted:boolean, error?:string}>}
   */
  async function submitResult(sessionId, gameName, resultObj, options) {
    options = options || {};
    var apiBase = options.apiBase || '';
    var url = apiBase + '/api/sessions/' + encodeURIComponent(sessionId) + '/games/' + gameName;

    if (!sessionId) {
      savePending('unknown-session', gameName, resultObj);
      return { ok: false, submitted: false, error: 'No session id was present on this page.' };
    }

    var lastError = null;
    for (var attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        var res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(resultObj)
        });
        if (res.ok) {
          clearPending(sessionId, gameName);
          return { ok: true, submitted: true };
        }
        var body = await res.json().catch(function () { return {}; });
        lastError = body.detail || ('Server returned ' + res.status);
      } catch (err) {
        lastError = err && err.message ? err.message : 'Network error';
      }
      if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS * attempt);
    }

    savePending(sessionId, gameName, resultObj);
    return { ok: false, submitted: false, error: lastError };
  }

  /**
   * Call on page load: if a previous attempt for this session/game left a
   * result stranded in localStorage (network blip, tab closed mid-submit),
   * try once to flush it before the participant starts a fresh attempt.
   */
  async function flushPending(sessionId, gameName, options) {
    var pending = getPending(sessionId, gameName);
    if (!pending) return null;
    return submitResult(sessionId, gameName, pending.result, options);
  }

  /**
   * Lightweight backend connectivity check for a status indicator.
   */
  async function checkHealth(apiBase) {
    try {
      var res = await fetch((apiBase || '') + '/api/health');
      if (!res.ok) return { connected: false };
      var data = await res.json();
      return { connected: data.status === 'ok', mongo: data.mongo };
    } catch (err) {
      return { connected: false };
    }
  }

  root.EventClient = {
    getParams: getParams,
    submitResult: submitResult,
    flushPending: flushPending,
    getPending: getPending,
    checkHealth: checkHealth
  };
})(window);
