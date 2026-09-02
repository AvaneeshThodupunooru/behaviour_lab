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

  // Several report cards pass raw summary keys straight through as labels
  // (meanReactionTimeMs, pathEfficiencyPct, ...). The CSS uppercases every
  // label, which turned those into unreadable runs like MEANREACTIONTIMEMS on
  // the participant's report. Split the camel-case boundaries and expand the
  // two unit suffixes the summarizers use. Labels that are already written as
  // words ('Images Viewed') pass through untouched.
  function prettyLabel(key) {
    return String(key)
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/\bMs\b/g, '(ms)')
      .replace(/\bPct\b/g, '(%)')
      .replace(/\bSeconds\b/g, '(s)')
      .replace(/^./, function (c) { return c.toUpperCase(); });
  }

  function renderMetricGrid(entries) {
    var dl = document.createElement('dl');
    dl.className = 'metric-grid';
    entries.forEach(function (pair) {
      if (pair[1] === undefined || pair[1] === null) return;
      var dt = document.createElement('dt');
      dt.textContent = prettyLabel(pair[0]);
      var dd = document.createElement('dd');
      dd.textContent = pair[1];
      dl.appendChild(dt);
      dl.appendChild(dd);
    });
    return dl;
  }

  function getVibe(score, maxScore) {
    return window.ReportRoast.overallTier(score, maxScore);
  }

  // The one part of a station card that says nothing about the participant:
  // what the instrument is actually for. Rendered on every card, including
  // skipped ones, because it is a property of the station and not the run.
  function renderResearchBlock(key) {
    var lines = window.ReportRoast.stationResearch(key);
    var block = document.createElement('div');
    block.className = 'research-block';
    if (!lines.length) return block;

    var head = document.createElement('div');
    head.className = 'research-head';
    head.textContent = 'Also used in autism research';
    block.appendChild(head);

    var intro = document.createElement('p');
    intro.className = 'research-intro';
    intro.textContent = window.ReportRoast.researchIntro;
    block.appendChild(intro);

    var list = document.createElement('ul');
    list.className = 'research-list';
    lines.forEach(function (line) {
      var li = document.createElement('li');
      li.textContent = line;
      list.appendChild(li);
    });
    block.appendChild(list);
    return block;
  }


  function renderReport(report) {
    var maxScore = report.max_score || 100;
    var completedCount = report.games_completed.length;
    el.reportMeta.textContent = 'Participant ' + (report.participant && report.participant.participant_id) +
      ' — ' + completedCount + ' of 4 tracked activities completed.';
    el.reportDisclaimer.textContent = report.disclaimer || '';

    el.reportBody.innerHTML = '';

    // 1. Hero overall score block
    var tier = getVibe(report.overall_score, maxScore);
    var hero = document.createElement('div');
    hero.className = 'report-hero';
    var heroTitle = document.createElement('div');
    heroTitle.className = 'report-hero-title';
    // The <h2> above already says "Your THE THING report", so the kicker slot
    // carries the tier instead of repeating the branding.
    heroTitle.textContent = tier.label;
    hero.appendChild(heroTitle);
    var vibe = document.createElement('div');
    vibe.className = 'report-vibe';
    vibe.textContent = tier.title;
    hero.appendChild(vibe);
    var score = document.createElement('div');
    score.className = 'report-score-big';
    score.textContent = report.overall_score === null || report.overall_score === undefined
      ? '— / ' + maxScore
      : Number(report.overall_score).toFixed(1) + ' / ' + maxScore;
    hero.appendChild(score);
    var tierNote = document.createElement('p');
    tierNote.className = 'report-tier-note';
    tierNote.textContent = tier.note;
    hero.appendChild(tierNote);

    // Score cards bar
    var breakdownGrid = document.createElement('div');
    breakdownGrid.className = 'score-breakdown-grid';
    GAME_ORDER_FOR_REPORT.forEach(function (key) {
      var s = report.summary && report.summary[key];
      var item = document.createElement('div');
      item.className = 'score-breakdown-item';
      var label = document.createElement('div');
      label.className = 'score-breakdown-label';
      label.textContent = window.ReportRoast.chip(key);
      var val = document.createElement('div');
      val.className = 'score-breakdown-val';
      val.textContent = (s && s.score !== undefined && s.score !== null) ? Number(s.score).toFixed(1) + '/25' : '—';
      item.appendChild(label);
      item.appendChild(val);
      breakdownGrid.appendChild(item);
    });
    hero.appendChild(breakdownGrid);
    el.reportBody.appendChild(hero);

    // 1b. Roast band — the one-liner verdict for the whole session.
    var roastBand = document.createElement('div');
    roastBand.className = 'roast-band';
    var roastKicker = document.createElement('div');
    roastKicker.className = 'roast-kicker';
    roastKicker.textContent = 'Verdict of the session';
    roastBand.appendChild(roastKicker);
    var roastQuote = document.createElement('blockquote');
    roastQuote.className = 'roast-quote';
    roastQuote.textContent = '“' + window.ReportRoast.overallRoast(report) + '”';
    roastBand.appendChild(roastQuote);
    el.reportBody.appendChild(roastBand);

    // 2. Activity cards
    GAME_ORDER_FOR_REPORT.forEach(function (key) {
      var summary = report.summary && report.summary[key];
      var card = document.createElement('div');
      card.className = 'report-card';

      var heading = document.createElement('h3');
      heading.textContent = window.ReportRoast.title(key);
      card.appendChild(heading);

      var subtitle = document.createElement('div');
      subtitle.className = 'report-card-sub';
      subtitle.textContent = (summary && summary.label) || (key.charAt(0).toUpperCase() + key.slice(1));
      card.appendChild(subtitle);

      if (summary && summary.score !== undefined && summary.score !== null) {
        var scoreLine = document.createElement('div');
        scoreLine.className = 'game-score';
        scoreLine.textContent = Number(summary.score).toFixed(1) + ' / 25';
        card.appendChild(scoreLine);
      }

      if (!summary) {
        var missing = document.createElement('p');
        missing.className = 'missing';
        missing.textContent = window.ReportRoast.skipped(key);
        card.appendChild(missing);
        card.appendChild(renderResearchBlock(key));
        el.reportBody.appendChild(card);
        return;
      }

      if (summary.available === false) {
        var unavailable = document.createElement('p');
        unavailable.className = 'missing';
        unavailable.textContent = window.ReportRoast.unavailable(key, summary.reason);
        card.appendChild(unavailable);
        card.appendChild(renderResearchBlock(key));
        el.reportBody.appendChild(card);
        return;
      }

      var verdict = window.ReportRoast.stationVerdict(key, summary);
      if (verdict) {
        var verdictLine = document.createElement('p');
        verdictLine.className = 'station-verdict';
        verdictLine.textContent = verdict;
        card.appendChild(verdictLine);
      }

      // Activity-specific rendering
      if (key === 'gaze') {
        var gazeResultDoc = state.sessionDoc && state.sessionDoc.games && state.sessionDoc.games.gaze && state.sessionDoc.games.gaze.result;
        var imagesData = (gazeResultDoc && gazeResultDoc.images) || [];

        // Metric grid for basic gaze info
        // Labels and rounding come from report-roast.js. imagesViewed is absent
        // on sessions recorded before the station reported it, and the posters
        // are right underneath, so count those rather than drop the row.
        var gazeSummary = summary;
        if (summary && summary.imagesViewed === undefined && imagesData.length) {
          gazeSummary = {};
          Object.keys(summary).forEach(function (k) { gazeSummary[k] = summary[k]; });
          gazeSummary.imagesViewed = imagesData.length;
        }
        card.appendChild(renderMetricGrid(window.ReportRoast.stationMetrics('gaze', gazeSummary)));

        // EXACTLY TWO gaze images with gaze paths
        var imgGrid = document.createElement('div');
        imgGrid.className = 'gaze-images-grid';

        [1, 2].forEach(function (imgId) {
          var imgCard = document.createElement('div');
          imgCard.className = 'gaze-image-card';
          var imgTitle = document.createElement('h4');
          imgTitle.textContent = 'Image ' + imgId + ' — Gaze Heatmap';
          imgCard.appendChild(imgTitle);

          var canvasWrap = document.createElement('div');
          canvasWrap.className = 'gaze-canvas-wrap';
          var canvas = document.createElement('canvas');
          canvasWrap.appendChild(canvas);
          imgCard.appendChild(canvasWrap);

          var imgInfo = imagesData.find(function (im) { return im.id === imgId; });
          var samples = imgInfo ? (imgInfo.samples || []) : [];
          var imgUrl = '/games/gaze-timer/Images/' + imgId + '.png';
          window.ReportVisuals.gazeHeatmap(canvas, imgUrl, samples);

          var legend = document.createElement('div');
          legend.className = 'heat-legend';
          legend.innerHTML = '<span>Fewer looks</span><i class="heat-ramp"></i><span>More looks</span>';
          imgCard.appendChild(legend);

          var pathNote = document.createElement('p');
          pathNote.className = 'canvas-note';
          pathNote.textContent = samples.length
            ? samples.length + ' samples. The line is the order you looked, dark dot first, lime dot last.'
            : 'No gaze samples were captured for this image.';
          imgCard.appendChild(pathNote);

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
            qText.textContent = (idx + 1) + '. '
              + (q.imageId ? '(Image ' + q.imageId + ') ' : '')
              + (q.questionText || q.prompt || 'Recall Question');
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
        card.appendChild(renderMetricGrid(window.ReportRoast.stationMetrics('wobblewalk', summary)));

        // Deviation from the centre line, presented the way WobbleWalk presents it.
        var wwResult = state.sessionDoc && state.sessionDoc.games && state.sessionDoc.games.wobblewalk && state.sessionDoc.games.wobblewalk.result;
        if (wwResult && wwResult.route && wwResult.route.length > 0) {
          var routeWrap = document.createElement('div');
          routeWrap.className = 'route-canvas-wrap';

          var routeHead = document.createElement('div');
          routeHead.className = 'route-head';
          var routeTitle = document.createElement('h4');
          routeTitle.textContent = 'Deviation from the centre line';
          routeHead.appendChild(routeTitle);
          var routeLegend = document.createElement('div');
          routeLegend.className = 'route-legend';
          routeLegend.innerHTML = '<span><i class="ideal"></i>Ideal</span><span><i></i>You</span>';
          routeHead.appendChild(routeLegend);
          routeWrap.appendChild(routeHead);

          var routeCanvas = document.createElement('canvas');
          routeWrap.appendChild(routeCanvas);
          window.ReportVisuals.routeDeviation(routeCanvas, wwResult.route);

          var routeNote = document.createElement('p');
          routeNote.className = 'canvas-note';
          routeNote.textContent = 'Start at the bottom, finish at the top. The shaded area is how far off centre you were, ' +
            'normalised to shoulder width so standing closer to the camera does not change the number.';
          routeWrap.appendChild(routeNote);

          card.appendChild(routeWrap);
        }
      } else {
        card.appendChild(renderMetricGrid(window.ReportRoast.stationMetrics(key, summary)));
      }

      var callouts = window.ReportRoast.stationCallouts(key, summary);
      if (callouts.length) {
        var calloutList = document.createElement('ul');
        calloutList.className = 'station-callouts';
        callouts.forEach(function (line) {
          var li = document.createElement('li');
          li.textContent = line;
          calloutList.appendChild(li);
        });
        card.appendChild(calloutList);
      }

      if (summary.note) {
        var note = document.createElement('p');
        note.className = 'missing';
        note.style.marginTop = '10px';
        note.textContent = summary.note;
        card.appendChild(note);
      }

      card.appendChild(renderResearchBlock(key));

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
