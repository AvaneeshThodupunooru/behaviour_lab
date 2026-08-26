(function () {
  'use strict';

  var GAME_DEFS = [
    { key: 'timer', label: 'Pressure Clock (Timer)', path: '/games/gaze-timer/' },
    { key: 'gaze', label: 'Gaze Experiment', path: '/games/gaze-timer/' },
    { key: 'wobblewalk', label: 'WobbleWalk', path: '/games/wobblewalk/' },
    { key: 'deadpan', label: 'DEADPAN (Try Not to Laugh)', path: '/games/deadpan/' }
  ];

  var state = {
    sessionId: null,
    sessionDoc: null
  };

  var el = {
    backendStatus: document.getElementById('backendStatus'),
    screens: {
      welcome: document.getElementById('screen-welcome'),
      participant: document.getElementById('screen-participant'),
      checklist: document.getElementById('screen-checklist'),
      report: document.getElementById('screen-report')
    },
    btnStart: document.getElementById('btnStart'),
    participantForm: document.getElementById('participantForm'),
    participantId: document.getElementById('participantId'),
    participantName: document.getElementById('participantName'),
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
    reportMeta: document.getElementById('reportMeta'),
    reportDisclaimer: document.getElementById('reportDisclaimer'),
    reportBody: document.getElementById('reportBody'),
    btnBackToChecklist: document.getElementById('btnBackToChecklist'),
    btnNewParticipantFromReport: document.getElementById('btnNewParticipantFromReport')
  };

  function showScreen(name) {
    Object.keys(el.screens).forEach(function (key) {
      el.screens[key].hidden = key !== name;
    });
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
    setSessionIdInUrl('');
    el.participantId.value = '';
    el.participantName.value = '';
    el.participantError.hidden = true;
    showScreen('participant');
  }

  el.btnStart.addEventListener('click', goToParticipantForm);
  el.btnBackToWelcome.addEventListener('click', function () { showScreen('welcome'); });
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

  function firstIncompleteGame(doc) {
    for (var i = 0; i < GAME_DEFS.length; i++) {
      var status = doc.games && doc.games[GAME_DEFS[i].key] && doc.games[GAME_DEFS[i].key].status;
      if (status !== 'completed') return GAME_DEFS[i];
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
      var gameState = (doc.games && doc.games[game.key]) || { status: 'pending' };
      var isCompleted = gameState.status === 'completed';
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
      el.btnContinue.onclick = showReport;
    }

    showScreen('checklist');
  }

  function gameUrl(game) {
    return game.path + '?session_id=' + encodeURIComponent(state.sessionId) +
      '&return_url=' + encodeURIComponent('/');
  }

  function navigateToGame(game) {
    var url = gameUrl(game);

    // Shell-driven handoff: decide which station comes next (first incomplete
    // game after this one in the event order; the report/checklist when none
    // remain) and pass it to the game so its completion screen can offer a
    // direct "Continue" jump. Games themselves never hardcode game order.
    var next = null;
    var startIndex = -1;
    for (var si = 0; si < GAME_DEFS.length; si++) {
      if (GAME_DEFS[si].key === game.key) { startIndex = si; break; }
    }
    if (game.path === '/games/gaze-timer/') {
      // The two checklist rows are completed by one station. Its explicit
      // continuation is Deadpan, never the duplicate station URL.
      for (var di = 0; di < GAME_DEFS.length; di++) {
        if (GAME_DEFS[di].key === 'deadpan') {
          next = GAME_DEFS[di];
          break;
        }
      }
    } else if (state.sessionDoc && state.sessionDoc.games && startIndex !== -1) {
      for (var ni = startIndex + 1; ni < GAME_DEFS.length; ni++) {
        var st = state.sessionDoc.games[GAME_DEFS[ni].key] && state.sessionDoc.games[GAME_DEFS[ni].key].status;
        if (st !== 'completed') {
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
      nextLabel = 'the event report';
    }
    url += '&next_url=' + encodeURIComponent(nextUrl) +
      '&next_label=' + encodeURIComponent(nextLabel);

    window.location.href = url;
  }

  async function loadSessionAndShowChecklist(sessionId) {
    try {
      var doc = await fetchSession(sessionId);
      state.sessionId = sessionId;
      state.sessionDoc = doc;
      renderChecklist(doc);
    } catch (err) {
      // Stale or invalid session id (e.g. old bookmark, or backend was
      // reset between events) - don't strand the operator, send them
      // back to start a fresh participant instead of showing a dead page.
      setSessionIdInUrl('');
      goToParticipantForm();
      el.participantError.textContent = 'Could not load that session (' + err.message + '). Start a new participant below.';
      el.participantError.hidden = false;
    }
  }

  el.btnRefreshStatus.addEventListener('click', function () {
    if (state.sessionId) loadSessionAndShowChecklist(state.sessionId);
  });

  el.btnFinishSession.addEventListener('click', async function () {
    if (!state.sessionId) return;
    el.btnFinishSession.disabled = true;
    try {
      await fetch('/api/sessions/' + encodeURIComponent(state.sessionId) + '/complete', { method: 'POST' });
    } catch (err) { /* best-effort; report screen still works without this */ }
    el.btnFinishSession.disabled = false;
    showReport();
  });

  // ---------------------------------------------------------------------
  // Screen: Final report
  // ---------------------------------------------------------------------
  var GAME_ORDER_FOR_REPORT = ['timer', 'gaze', 'wobblewalk', 'deadpan'];

  function renderMetricGrid(entries) {
    var dl = document.createElement('dl');
    dl.className = 'metric-grid';
    entries.forEach(function (pair) {
      if (pair[1] === undefined || pair[1] === null) return;
      var dt = document.createElement('dt');
      dt.textContent = pair[0];
      var dd = document.createElement('dd');
      dd.textContent = pair[1];
      dl.appendChild(dt);
      dl.appendChild(dd);
    });
    return dl;
  }

  function renderReport(report) {
    el.reportMeta.textContent = 'Participant ' + (report.participant && report.participant.participant_id) +
      ' — ' + report.games_completed.length + ' of ' + GAME_ORDER_FOR_REPORT.length + ' games completed.';
    el.reportDisclaimer.textContent = report.disclaimer || '';

    el.reportBody.innerHTML = '';
    var overall = document.createElement('div');
    overall.className = 'overall-score';
    if (report.overall_score === null || report.overall_score === undefined) {
      overall.textContent = 'Overall performance score will appear after all four games are completed.';
    } else {
      overall.textContent = 'Overall performance score: ' + report.overall_score.toFixed(1) + ' / ' + (report.max_score || 100);
    }
    el.reportBody.appendChild(overall);

    GAME_ORDER_FOR_REPORT.forEach(function (key) {
      var summary = report.summary && report.summary[key];
      var card = document.createElement('div');
      card.className = 'report-card';

      var heading = document.createElement('h3');
      heading.textContent = (summary && summary.label) || key;
      card.appendChild(heading);

      if (summary && summary.score !== undefined && summary.score !== null) {
        var score = document.createElement('div');
        score.className = 'game-score';
        score.textContent = 'Performance score: ' + Number(summary.score).toFixed(1) + ' / 25';
        card.appendChild(score);
      }

      if (!summary) {
        var missing = document.createElement('p');
        missing.className = 'missing';
        missing.textContent = 'Not completed for this session.';
        card.appendChild(missing);
      } else if (summary.available === false) {
        var unavailable = document.createElement('p');
        unavailable.className = 'missing';
        unavailable.textContent = 'Recorded, but metrics could not be computed' + (summary.reason ? ' (' + summary.reason + ').' : '.');
        card.appendChild(unavailable);
        if (summary.note) {
          var unavailableNote = document.createElement('p');
          unavailableNote.className = 'missing';
          unavailableNote.style.marginTop = '10px';
          unavailableNote.textContent = summary.note;
          card.appendChild(unavailableNote);
        }
      } else {
        var entries = Object.keys(summary)
          .filter(function (k) { return k !== 'label' && k !== 'note' && k !== 'score'; })
          .map(function (k) { return [k, summary[k]]; });
        card.appendChild(renderMetricGrid(entries));
        if (summary.note) {
          var note = document.createElement('p');
          note.className = 'missing';
          note.style.marginTop = '10px';
          note.textContent = summary.note;
          card.appendChild(note);
        }
      }
      el.reportBody.appendChild(card);
    });

    showScreen('report');
  }

  async function showReport() {
    if (!state.sessionId) return;
    try {
      var res = await fetch('/api/sessions/' + encodeURIComponent(state.sessionId) + '/report');
      var data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Could not load the report.');
      renderReport(data);
    } catch (err) {
      el.reportMeta.textContent = 'Could not load the report: ' + err.message;
      el.reportBody.innerHTML = '';
      el.reportDisclaimer.textContent = '';
      showScreen('report');
    }
  }

  el.btnBackToChecklist.addEventListener('click', function () {
    if (state.sessionId) loadSessionAndShowChecklist(state.sessionId);
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
