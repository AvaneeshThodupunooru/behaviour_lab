(function () {
  'use strict';

  var GAME_DEFS = [
    { key: 'timer', label: 'Gaze + Pressure Clock', path: '/games/gaze-timer/' },
    { key: 'deadpan', label: 'DEADPAN — Try Not to Laugh', path: '/games/deadpan/' },
    { key: 'wobblewalk', label: 'WobbleWalk — Walk the Line', path: '/games/wobblewalk/' }
  ];

  var state = {
    sessionId: null,
    sessionDoc: null,
    report: null,
    age: null,
    gender: null,
    category: null
  };

  // Same bracket rule as static/games/gaze/js/categories.js (age >= 25 ->
  // "above25"). Kept as a one-line duplicate here rather than a shared
  // include, since the shell and the gaze pages are separate static
  // mounts — this is the only bit of category logic the shell needs.
  function resolveCategory(age, gender) {
    var bracket = age >= 25 ? 'above25' : 'below25';
    return bracket + '-' + gender;
  }

  function detailsStorageKey(sessionId) {
    return 'behaviorLabDetails::' + sessionId;
  }

  function saveDetailsForSession(sessionId, age, gender, category) {
    try {
      sessionStorage.setItem(detailsStorageKey(sessionId), JSON.stringify({ age: age, gender: gender, category: category }));
    } catch (err) { /* sessionStorage unavailable — details just won't survive a refresh */ }
  }

  function restoreDetailsForSession(sessionId) {
    try {
      var raw = sessionStorage.getItem(detailsStorageKey(sessionId));
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  var el = {
    backendStatus: document.getElementById('backendStatus'),
    brandLogo: document.getElementById('brandLogo'),
    screens: {
      welcome: document.getElementById('screen-welcome'),
      participant: document.getElementById('screen-participant'),
      checklist: document.getElementById('screen-checklist'),
      processing: document.getElementById('screen-processing'),
      report: document.getElementById('screen-report')
    },
    btnStart: document.getElementById('btnStart'),
    participantForm: document.getElementById('participantForm'),
    participantId: document.getElementById('participantId'),
    participantName: document.getElementById('participantName'),
    participantAge: document.getElementById('participantAge'),
    participantGender: document.getElementById('participantGender'),
    participantError: document.getElementById('participantError'),
    btnBackToWelcome: document.getElementById('btnBackToWelcome'),
    btnCreateSession: document.getElementById('btnCreateSession'),
    sessionIdLabel: document.getElementById('sessionIdLabel'),
    participantLabel: document.getElementById('participantLabel'),
    gameList: document.getElementById('gameList'),
    btnRefreshStatus: document.getElementById('btnRefreshStatus'),
    btnContinue: document.getElementById('btnContinue'),
    btnFinishSession: document.getElementById('btnFinishSession'),
    btnStartNewParticipant: document.getElementById('btnStartNewParticipant'),
    reportBody: document.getElementById('reportBody'),
    reportActionNote: document.getElementById('reportActionNote'),
    btnDownloadReport: document.getElementById('btnDownloadReport'),
    btnBackToChecklist: document.getElementById('btnBackToChecklist'),
    btnNewParticipantFromReport: document.getElementById('btnNewParticipantFromReport')
  };

  function showScreen(name) {
    Object.keys(el.screens).forEach(function (key) {
      el.screens[key].hidden = key !== name;
    });
    // The report needs more width than the rest of the shell.
    document.body.classList.toggle('shell-report', name === 'report');
  }

  // ---------------------------------------------------------------------
  // Backend status pill
  // ---------------------------------------------------------------------
  function refreshBackendStatus() {
    EventClient.checkHealth('').then(function (health) {
      if (health.connected) {
        el.backendStatus.textContent = 'Backend connected';
        el.backendStatus.className = 'status-pill status-pill--ok';
      } else {
        el.backendStatus.textContent = 'Backend unavailable';
        el.backendStatus.className = 'status-pill status-pill--bad';
      }
    });
  }
  refreshBackendStatus();
  setInterval(refreshBackendStatus, 10000);

  // ---------------------------------------------------------------------
  // URL <-> session id
  // ---------------------------------------------------------------------
  function getSessionIdFromUrl() {
    return new URLSearchParams(window.location.search).get('session_id') || '';
  }

  function setSessionIdInUrl(sessionId) {
    var url = new URL(window.location.href);
    if (sessionId) url.searchParams.set('session_id', sessionId);
    else url.searchParams.delete('session_id');
    window.history.replaceState({}, '', url.toString());
  }

  // ---------------------------------------------------------------------
  // Screen: Welcome / Participant form
  // ---------------------------------------------------------------------
  function goToParticipantForm() {
    state.sessionId = null;
    state.sessionDoc = null;
    state.age = null;
    state.gender = null;
    state.category = null;
    setSessionIdInUrl('');
    el.participantId.value = '';
    el.participantName.value = '';
    el.participantAge.value = '';
    el.participantGender.value = '';
    el.participantError.hidden = true;
    showScreen('participant');
  }

  el.btnStart.addEventListener('click', goToParticipantForm);
  el.btnBackToWelcome.addEventListener('click', function () { showScreen('welcome'); });
  el.brandLogo.addEventListener('click', function () {
    if (state.sessionId) loadSessionAndShowChecklist(state.sessionId);
    else showScreen('welcome');
  });
  el.brandLogo.addEventListener('keydown', function (evt) {
    if (evt.key === 'Enter' || evt.key === ' ') {
      evt.preventDefault();
      if (state.sessionId) loadSessionAndShowChecklist(state.sessionId);
      else showScreen('welcome');
    }
  });
  el.btnStartNewParticipant.addEventListener('click', goToParticipantForm);
  el.btnNewParticipantFromReport.addEventListener('click', goToParticipantForm);

  el.participantForm.addEventListener('submit', async function (evt) {
    evt.preventDefault();
    var participantId = el.participantId.value.trim();
    if (!participantId) {
      el.participantError.textContent = 'Participant ID is required.';
      el.participantError.hidden = false;
      return;
    }
    var age = parseInt(el.participantAge.value, 10);
    if (!Number.isFinite(age) || age <= 0) {
      el.participantError.textContent = 'Please enter a valid age.';
      el.participantError.hidden = false;
      return;
    }
    var gender = el.participantGender.value;
    if (gender !== 'male' && gender !== 'female') {
      el.participantError.textContent = 'Please select a gender.';
      el.participantError.hidden = false;
      return;
    }
    el.btnCreateSession.disabled = true;
    el.participantError.hidden = true;
    try {
      var res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participant_id: participantId, name: el.participantName.value.trim() || null })
      });
      var data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Could not create a session.');
      state.sessionId = data.session_id;
      state.age = age;
      state.gender = gender;
      state.category = resolveCategory(age, gender);
      saveDetailsForSession(state.sessionId, age, gender, state.category);
      setSessionIdInUrl(state.sessionId);
      await loadSessionAndShowChecklist(state.sessionId);
    } catch (err) {
      el.participantError.textContent = err.message || 'Could not create a session.';
      el.participantError.hidden = false;
    } finally {
      el.btnCreateSession.disabled = false;
    }
  });

  // ---------------------------------------------------------------------
  // Screen: Checklist
  // ---------------------------------------------------------------------
  async function fetchSession(sessionId) {
    var res = await fetch('/api/sessions/' + encodeURIComponent(sessionId));
    var data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Session not found.');
    return data;
  }

  function isGameComplete(doc, key) {
    if (!doc || !doc.games) return false;
    if (key === 'timer') {
      var tStatus = doc.games.timer && doc.games.timer.status;
      var gStatus = doc.games.gaze && doc.games.gaze.status;
      return tStatus === 'completed' && gStatus === 'completed';
    }
    return doc.games[key] && doc.games[key].status === 'completed';
  }

  function firstIncompleteGame(doc) {
    for (var i = 0; i < GAME_DEFS.length; i++) {
      if (!isGameComplete(doc, GAME_DEFS[i].key)) return GAME_DEFS[i];
    }
    return null;
  }

  function renderChecklist(doc) {
    el.sessionIdLabel.textContent = doc.session_id;
    var participant = doc.participant || {};
    el.participantLabel.textContent = 'Participant: ' + participant.participant_id + (participant.name ? ' (' + participant.name + ')' : '');

    el.gameList.innerHTML = '';
    var next = firstIncompleteGame(doc);

    GAME_DEFS.forEach(function (game) {
      var isCompleted = isGameComplete(doc, game.key);
      var isCurrent = !isCompleted && next && next.key === game.key;

      var li = document.createElement('li');

      var nameWrap = document.createElement('span');
      nameWrap.className = 'g-name';
      var badge = document.createElement('span');
      badge.className = 'g-badge ' + (isCompleted ? 'g-badge--completed' : isCurrent ? 'g-badge--current' : 'g-badge--pending');
      badge.textContent = isCompleted ? '✓' : isCurrent ? '→' : '○';
      nameWrap.appendChild(badge);
      nameWrap.appendChild(document.createTextNode(game.label));
      li.appendChild(nameWrap);

      var actionBtn = document.createElement('button');
      actionBtn.className = 'btn btn--small';
      actionBtn.textContent = isCompleted ? 'Play again' : 'Play';
      actionBtn.addEventListener('click', function () { navigateToGame(game); });
      li.appendChild(actionBtn);

      el.gameList.appendChild(li);
    });

    if (next) {
      el.btnContinue.textContent = 'Continue — ' + next.label;
      el.btnContinue.onclick = function () { navigateToGame(next); };
    } else {
      el.btnContinue.textContent = 'View final report';
      el.btnContinue.onclick = function () { showReport({ processing: true }); };
    }

    showScreen('checklist');
  }

  function gameUrl(game) {
    var url = game.path + '?session_id=' + encodeURIComponent(state.sessionId) +
      '&return_url=' + encodeURIComponent('/');
    if (state.age !== null) url += '&age=' + encodeURIComponent(state.age);
    if (state.gender) url += '&gender=' + encodeURIComponent(state.gender);
    if (state.category) url += '&category=' + encodeURIComponent(state.category);
    return url;
  }

  function navigateToGame(game) {
    var url = gameUrl(game);
    var next = null;
    var startIndex = -1;
    for (var si = 0; si < GAME_DEFS.length; si++) {
      if (GAME_DEFS[si].key === game.key) { startIndex = si; break; }
    }
    if (state.sessionDoc && state.sessionDoc.games && startIndex !== -1) {
      for (var ni = startIndex + 1; ni < GAME_DEFS.length; ni++) {
        if (!isGameComplete(state.sessionDoc, GAME_DEFS[ni].key)) {
          next = GAME_DEFS[ni];
          break;
        }
      }
    }
    var nextUrl;
    var nextLabel;
    if (next) {
      nextUrl = gameUrl(next);
      nextLabel = next.label;
    } else {
      nextUrl = '/?session_id=' + encodeURIComponent(state.sessionId);
      nextLabel = 'the final report';
    }
    url += '&next_url=' + encodeURIComponent(nextUrl) +
      '&next_label=' + encodeURIComponent(nextLabel);
    window.location.href = url;
  }

  /**
   * @param {string} sessionId
   * @param {{stayOnChecklist?: boolean}} [options] when omitted, a session whose
   *   four stations are all done goes straight on to processing and the report —
   *   that is the smooth handoff from the final station (§15). Buttons that mean
   *   "show me the run sheet" pass stayOnChecklist so they are not bounced back.
   */
  async function loadSessionAndShowChecklist(sessionId, options) {
    try {
      var doc = await fetchSession(sessionId);
      state.sessionId = sessionId;
      state.sessionDoc = doc;
      if (state.age === null) {
        var restored = restoreDetailsForSession(sessionId);
        if (restored) {
          state.age = restored.age;
          state.gender = restored.gender;
          state.category = restored.category;
        }
      }
      if (!(options && options.stayOnChecklist) && allStationsComplete(doc)) {
        showReport({ processing: true });
        return;
      }
      renderChecklist(doc);
    } catch (err) {
      setSessionIdInUrl('');
      goToParticipantForm();
      el.participantError.textContent = 'Could not load that session (' + err.message + '). Start a new participant below.';
      el.participantError.hidden = false;
    }
  }

  el.btnRefreshStatus.addEventListener('click', function () {
    if (state.sessionId) loadSessionAndShowChecklist(state.sessionId, { stayOnChecklist: true });
  });

  el.btnFinishSession.addEventListener('click', async function () {
    if (!state.sessionId) return;
    el.btnFinishSession.disabled = true;
    try {
      await fetch('/api/sessions/' + encodeURIComponent(state.sessionId) + '/complete', { method: 'POST' });
    } catch (err) { /* best-effort; report screen still works without this */ }
    el.btnFinishSession.disabled = false;
    showReport({ processing: true });
  });

  // ---------------------------------------------------------------------
  // Screens: Result processing + Final report
  //
  // Rendering lives in static/shell/report/*. This file only decides when the
  // report may appear, hands the scored payload to Report.render, and wires the
  // download button to ReportPDF. Keeping the two apart is what lets one set of
  // components serve both the screen and the PDF.
  // ---------------------------------------------------------------------
  var PROCESSING_MIN_MS = 1400; // a deliberate beat, not a fake loading bar

  function delay(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function allStationsComplete(doc) {
    for (var i = 0; i < GAME_DEFS.length; i++) {
      if (!isGameComplete(doc, GAME_DEFS[i].key)) return false;
    }
    return true;
  }

  function setDownloadVisible(visible) {
    el.btnDownloadReport.hidden = !visible;
    el.reportActionNote.hidden = !visible;
  }

  /**
   * Whether the report opens at all is the server's call (report_ready, set
   * once all four stations have a score); this only chooses the route in.
   * @param {{processing?: boolean}} [options] play the processing beat first
   */
  async function showReport(options) {
    if (!state.sessionId) return;
    var withProcessing = !!(options && options.processing);
    var startedAt = Date.now();
    state.report = null;
    setDownloadVisible(false);
    if (withProcessing) showScreen('processing');
    try {
      // Marks the session finished so the scorer works on a closed session.
      await fetch('/api/sessions/' + encodeURIComponent(state.sessionId) + '/complete',
        { method: 'POST' }).catch(function () {});
      state.sessionDoc = await fetchSession(state.sessionId);
      var report = await ReportGenerator.load(state.sessionId, '');
      if (withProcessing) {
        var waited = Date.now() - startedAt;
        if (waited < PROCESSING_MIN_MS) await delay(PROCESSING_MIN_MS - waited);
      }
      state.report = report;
      setDownloadVisible(Report.render(el.reportBody, report));
    } catch (err) {
      Report.renderError(el.reportBody, err.message);
    }
    showScreen('report');
    window.scrollTo(0, 0);
  }

  el.btnDownloadReport.addEventListener('click', function () {
    if (!state.report) return;
    var btn = el.btnDownloadReport;
    var label = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Preparing…';
    // Posters, heat layers and fonts have to be painted before the print
    // dialog opens, so this resolves later than a plain window.print().
    ReportPDF.download(el.reportBody, state.report)
      .catch(function () { return false; })
      .then(function () {
        btn.disabled = false;
        btn.textContent = label;
      });
  });

  el.btnBackToChecklist.addEventListener('click', function () {
    if (state.sessionId) loadSessionAndShowChecklist(state.sessionId, { stayOnChecklist: true });
    else showScreen('welcome');
  });

  // ---------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------
  var urlSessionId = getSessionIdFromUrl();
  if (urlSessionId) {
    loadSessionAndShowChecklist(urlSessionId);
  } else {
    showScreen('welcome');
  }
})();
