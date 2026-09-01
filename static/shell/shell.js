(function () {
  'use strict';

  var GAME_DEFS = [
    { key: 'timer', label: 'Gaze + Pressure Clock', path: '/games/gaze-timer/' },
    { key: 'deadpan', label: 'DEADPAN — Try Not to Laugh', path: '/games/deadpan/' },
    { key: 'wobblewalk', label: 'WobbleWalk — Walk the Line', path: '/games/wobblewalk/' }
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

  async function loadSessionAndShowChecklist(sessionId) {
    try {
      var doc = await fetchSession(sessionId);
      state.sessionId = sessionId;
      state.sessionDoc = doc;
      renderChecklist(doc);
    } catch (err) {
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
  var GAME_ORDER_FOR_REPORT = ['gaze', 'timer', 'deadpan', 'wobblewalk'];

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

  function getVibe(score, maxScore) {
    if (score === null || score === undefined) return 'Your lab snapshot is ready.';
    var pct = score / maxScore;
    if (pct >= 0.85) return 'HIGH CONSISTENCY & RECALL';
    if (pct >= 0.70) return 'SOLID PERFORMANCE ACROSS ACTIVITIES';
    if (pct >= 0.50) return 'BALANCED PARTICIPATION';
    return 'SESSION COMPLETED';
  }

  function renderGazeImageOverlay(canvas, imgUrl, samples) {
    var ctx = canvas.getContext('2d');
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () {
      canvas.width = img.naturalWidth || 600;
      canvas.height = img.naturalHeight || 400;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      if (!samples || samples.length === 0) return;

      // Draw gaze scanpath (connecting line)
      ctx.strokeStyle = 'rgba(255, 77, 141, 0.7)';
      ctx.lineWidth = Math.max(2, canvas.width * 0.004);
      ctx.beginPath();
      samples.forEach(function (pt, idx) {
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();

      // Draw fixation points
      samples.forEach(function (pt) {
        ctx.fillStyle = 'rgba(255, 210, 63, 0.8)';
        ctx.beginPath();
        var radius = Math.max(3, canvas.width * 0.007);
        ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(18, 11, 38, 0.85)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
    };
    img.onerror = function () {
      canvas.width = 400;
      canvas.height = 250;
      ctx.fillStyle = '#251850';
      ctx.fillRect(0, 0, 400, 250);
      ctx.fillStyle = '#fff4e4';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Poster image', 200, 125);
    };
    img.src = imgUrl;
  }

  function renderRouteCanvas(canvas, route) {
    var ctx = canvas.getContext('2d');
    canvas.width = 300;
    canvas.height = 300;
    ctx.fillStyle = '#120b26';
    ctx.fillRect(0, 0, 300, 300);

    // Center straight reference line
    ctx.strokeStyle = 'rgba(255, 244, 228, 0.25)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(150, 20);
    ctx.lineTo(150, 280);
    ctx.stroke();
    ctx.setLineDash([]);

    if (!route || route.length === 0) return;

    // Draw actual walked route
    ctx.strokeStyle = '#3fe0a0';
    ctx.lineWidth = 3;
    ctx.beginPath();
    route.forEach(function (pt, idx) {
      var px = (pt.x / 100) * 300;
      var py = (pt.y / 100) * 300;
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
  }

  function renderReport(report) {
    var maxScore = report.max_score || 100;
    var completedCount = report.games_completed.length;
    el.reportMeta.textContent = 'Participant ' + (report.participant && report.participant.participant_id) +
      ' — ' + completedCount + ' of 4 tracked activities completed.';
    el.reportDisclaimer.textContent = report.disclaimer || '';

    el.reportBody.innerHTML = '';

    // 1. Hero overall score block
    var hero = document.createElement('div');
    hero.className = 'report-hero';
    var heroTitle = document.createElement('div');
    heroTitle.className = 'report-hero-title';
    heroTitle.textContent = 'YOUR THE THING REPORT';
    hero.appendChild(heroTitle);
    var vibe = document.createElement('div');
    vibe.className = 'report-vibe';
    vibe.textContent = getVibe(report.overall_score, maxScore);
    hero.appendChild(vibe);
    var score = document.createElement('div');
    score.className = 'report-score-big';
    score.textContent = report.overall_score === null || report.overall_score === undefined
      ? '—'
      : Number(report.overall_score).toFixed(1) + ' / ' + maxScore;
    hero.appendChild(score);

    // Score cards bar
    var breakdownGrid = document.createElement('div');
    breakdownGrid.className = 'score-breakdown-grid';
    GAME_ORDER_FOR_REPORT.forEach(function (key) {
      var s = report.summary && report.summary[key];
      var item = document.createElement('div');
      item.className = 'score-breakdown-item';
      var label = document.createElement('div');
      label.className = 'score-breakdown-label';
      label.textContent = key === 'timer' ? 'Pressure' : key === 'gaze' ? 'Gaze Recall' : key === 'deadpan' ? 'DEADPAN' : 'WobbleWalk';
      var val = document.createElement('div');
      val.className = 'score-breakdown-val';
      val.textContent = (s && s.score !== undefined && s.score !== null) ? Number(s.score).toFixed(1) + '/25' : '—';
      item.appendChild(label);
      item.appendChild(val);
      breakdownGrid.appendChild(item);
    });
    hero.appendChild(breakdownGrid);
    el.reportBody.appendChild(hero);

    // 2. Activity cards
    GAME_ORDER_FOR_REPORT.forEach(function (key) {
      var summary = report.summary && report.summary[key];
      var card = document.createElement('div');
      card.className = 'report-card';

      var heading = document.createElement('h3');
      heading.textContent = (summary && summary.label) || (key.charAt(0).toUpperCase() + key.slice(1));
      card.appendChild(heading);

      if (summary && summary.score !== undefined && summary.score !== null) {
        var scoreLine = document.createElement('div');
        scoreLine.className = 'game-score';
        scoreLine.textContent = Number(summary.score).toFixed(1) + ' / 25';
        card.appendChild(scoreLine);
      }

      if (!summary) {
        var missing = document.createElement('p');
        missing.className = 'missing';
        missing.textContent = 'Not completed for this session.';
        card.appendChild(missing);
        el.reportBody.appendChild(card);
        return;
      }

      if (summary.available === false) {
        var unavailable = document.createElement('p');
        unavailable.className = 'missing';
        unavailable.textContent = 'Recorded, but metrics could not be computed' + (summary.reason ? ' (' + summary.reason + ').' : '.');
        card.appendChild(unavailable);
        el.reportBody.appendChild(card);
        return;
      }

      // Activity-specific rendering
      if (key === 'gaze') {
        var gazeResultDoc = state.sessionDoc && state.sessionDoc.games && state.sessionDoc.games.gaze && state.sessionDoc.games.gaze.result;
        var imagesData = (gazeResultDoc && gazeResultDoc.images) || [];

        // Metric grid for basic gaze info
        var gazeEntries = [
          ['Images Viewed', '2 (Active Experiment)'],
          ['Recall Accuracy', summary.recallScore || '—'],
          ['Gaze Samples Captured', summary.gazeSamplesCollected || '0']
        ];
        card.appendChild(renderMetricGrid(gazeEntries));

        // EXACTLY TWO gaze images with gaze paths
        var imgGrid = document.createElement('div');
        imgGrid.className = 'gaze-images-grid';

        [1, 2].forEach(function (imgId) {
          var imgCard = document.createElement('div');
          imgCard.className = 'gaze-image-card';
          var imgTitle = document.createElement('h4');
          imgTitle.textContent = 'Image ' + imgId + ' — Gaze Path';
          imgCard.appendChild(imgTitle);

          var canvasWrap = document.createElement('div');
          canvasWrap.className = 'gaze-canvas-wrap';
          var canvas = document.createElement('canvas');
          canvasWrap.appendChild(canvas);
          imgCard.appendChild(canvasWrap);

          var imgInfo = imagesData.find(function (im) { return im.id === imgId; });
          var samples = imgInfo ? (imgInfo.samples || []) : [];
          var imgUrl = '/games/gaze-timer/Images/' + imgId + '.png';
          renderGazeImageOverlay(canvas, imgUrl, samples);

          imgGrid.appendChild(imgCard);
        });
        card.appendChild(imgGrid);

        // Delayed recall question breakdown
        var qResults = (gazeResultDoc && gazeResultDoc.questionResults) || [];
        if (qResults.length > 0) {
          var qTitle = document.createElement('h4');
          qTitle.style.marginTop = '16px';
          qTitle.style.marginBottom = '6px';
          qTitle.textContent = 'Recall Questions Breakdown';
          card.appendChild(qTitle);

          var qList = document.createElement('ul');
          qList.className = 'recall-questions-list';
          qResults.forEach(function (q, idx) {
            var li = document.createElement('li');
            li.className = 'recall-question-item';

            var qText = document.createElement('div');
            qText.className = 'recall-q-text';
            qText.textContent = (idx + 1) + '. (Image ' + q.imageId + ') ' + (q.questionText || 'Recall Question');
            li.appendChild(qText);

            var qAns = document.createElement('div');
            qAns.className = 'recall-q-ans';
            var badge = document.createElement('span');
            badge.className = q.correct ? 'badge-correct' : 'badge-incorrect';
            badge.textContent = q.correct ? '✓ Correct' : '✗ Incorrect';
            qAns.appendChild(badge);
            qAns.appendChild(document.createTextNode('Selected: ' + (q.selected || 'None') + (q.correct ? '' : ' (Correct: ' + (q.correctAnswer || '—') + ')')));
            li.appendChild(qAns);

            qList.appendChild(li);
          });
          card.appendChild(qList);
        }
      } else if (key === 'wobblewalk') {
        var wwEntries = Object.keys(summary)
          .filter(function (k) { return k !== 'label' && k !== 'note' && k !== 'score' && k !== 'available'; })
          .map(function (k) { return [k, summary[k]]; });
        card.appendChild(renderMetricGrid(wwEntries));

        // Route visualization if route points exist
        var wwResult = state.sessionDoc && state.sessionDoc.games && state.sessionDoc.games.wobblewalk && state.sessionDoc.games.wobblewalk.result;
        if (wwResult && wwResult.route && wwResult.route.length > 0) {
          var routeWrap = document.createElement('div');
          routeWrap.className = 'route-canvas-wrap';
          var routeTitle = document.createElement('h4');
          routeTitle.textContent = 'Walked Route Replay';
          routeTitle.style.marginBottom = '6px';
          routeWrap.appendChild(routeTitle);
          var routeCanvas = document.createElement('canvas');
          routeWrap.appendChild(routeCanvas);
          renderRouteCanvas(routeCanvas, wwResult.route);
          card.appendChild(routeWrap);
        }
      } else {
        var entries = Object.keys(summary)
          .filter(function (k) { return k !== 'label' && k !== 'note' && k !== 'score'; })
          .map(function (k) { return [k, summary[k]]; });
        card.appendChild(renderMetricGrid(entries));
      }

      if (summary.note) {
        var note = document.createElement('p');
        note.className = 'missing';
        note.style.marginTop = '10px';
        note.textContent = summary.note;
        card.appendChild(note);
      }

      el.reportBody.appendChild(card);
    });

    showScreen('report');
  }

  async function showReport() {
    if (!state.sessionId) return;
    try {
      await fetch('/api/sessions/' + encodeURIComponent(state.sessionId) + '/complete', { method: 'POST' }).catch(function () {});
      var resDoc = await fetchSession(state.sessionId);
      state.sessionDoc = resDoc;
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
