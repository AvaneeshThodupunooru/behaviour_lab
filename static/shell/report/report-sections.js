/**
 * report-sections.js — one builder per page of the final report.
 *
 * Each builder receives the server's report payload (backend/report.py
 * build_report) and returns a finished .rp-page element. No builder computes a
 * metric or fills a gap: a value the station never recorded is simply absent
 * from the page, and a station that recorded nothing says so in words.
 *
 * The same elements are used on screen and in the PDF. report.css carries the
 * print rules, so there is no second, PDF-only rendering path.
 */
window.ReportSections = (function () {
  'use strict';

  var D = window.ReportDom;
  var Charts = window.ReportCharts;
  var Heatmap = window.ReportHeatmap;
  var WalkPath = window.ReportWalkPath;

  var STATION_COLOR = {
    gaze: '--sky',
    timer: '--zap',
    deadpan: '--punch',
    wobblewalk: '--mint'
  };

  var MAX_STATION_SCORE = 25;

  function page(variant) {
    return D.el('section', 'rp-page' + (variant ? ' ' + variant : ''));
  }

  function card(variant) {
    return D.el('article', 'rp-card' + (variant ? ' ' + variant : ''));
  }

  /** Local date and time, or null when the timestamp is missing/unparsable. */
  function when(iso) {
    if (!iso) return null;
    var date = new Date(iso);
    if (isNaN(date.getTime())) return null;
    try {
      return date.toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch (err) {
      return date.toISOString().replace('T', ' ').slice(0, 16);
    }
  }
  /** Key/value strip used for session facts (not measurements). */
  function facts(pairs) {
    var grid = D.el('dl', 'rp-facts');
    var used = 0;
    pairs.forEach(function (pair) {
      if (pair[1] === null || pair[1] === undefined || pair[1] === '') return;
      var cell = D.el('div', 'rp-fact');
      D.append(cell, D.el('dt', null, pair[0]));
      D.append(cell, D.el('dd', null, pair[1]));
      D.append(grid, cell);
      used++;
    });
    return used ? grid : null;
  }

  /** Station page header: eyebrow, title, one-line blurb, score chip. */
  function stationHead(key, title, blurb, score) {
    var head = D.el('header', 'rp-station-head');
    head.style.setProperty('--rp-accent', 'var(' + (STATION_COLOR[key] || '--lilac') + ')');
    var top = D.el('div', 'rp-station-top');
    D.append(top, D.eyebrow(title, STATION_COLOR[key]));
    if (D.isNum(score)) {
      var chip = D.el('span', 'rp-score-chip');
      D.append(chip, D.el('b', null, D.num(score, 1)));
      D.append(chip, D.el('span', null, '/ ' + MAX_STATION_SCORE));
      D.append(top, chip);
    }
    D.append(head, top);
    if (blurb) D.append(head, D.el('p', 'rp-station-blurb', blurb));
    return head;
  }

  function rowsFor(report) {
    return (report.score_breakdown || []).map(function (row) {
      return {
        key: row.key,
        label: row.label,
        chip: row.chip,
        blurb: row.blurb,
        score: D.isNum(row.score) ? row.score : null,
        color: STATION_COLOR[row.key] || '--lilac'
      };
    });
  }
  /** Page 1 — who, when, the overall score, and the four station scores. */
  function summaryPage(report) {
    var node = page('rp-page--summary');
    var participant = report.participant || {};
    var head = D.el('header', 'rp-masthead');
    D.append(head, D.eyebrow('The Thing · Behaviour Lab', '--zap'));
    D.append(head, D.el('h1', 'tt-display rp-title', 'Your session report'));
    D.append(head, D.el('p', 'rp-lede',
      'Four short activities, four sets of measurements, one afternoon. ' +
      'What follows is a record of what the stations recorded while you played.'));
    D.append(node, head);

    D.append(node, facts([
      ['Participant', participant.name || participant.participant_id || 'Anonymous'],
      ['Participant ID', participant.name && participant.participant_id ? participant.participant_id : null],
      ['Session', report.session_id],
      ['Started', when(report.started_at)],
      ['Finished', when(report.completed_at)],
      ['Stations completed', report.stations_completed + ' of ' + report.stations_total]
    ]));

    var interpretation = report.interpretation || {};
    var overall = card('rp-card--overall');
    D.append(overall, Charts.ring(report.overall_score, report.max_score || 100, 'overall'));
    var text = D.el('div', 'rp-overall-text');
    D.append(text, D.eyebrow('Overall score', '--mint'));
    if (interpretation.headline) D.append(text, D.el('h2', 'rp-overall-headline', interpretation.headline));
    if (interpretation.comment) D.append(text, D.el('p', 'rp-overall-comment', interpretation.comment));
    if (interpretation.body) D.append(text, D.el('p', 'rp-overall-body', interpretation.body));
    D.append(overall, text);
    D.append(node, overall);

    var stations = card('rp-card--stations');
    D.append(stations, D.el('h3', 'rp-card-title', 'The four stations'));
    D.append(stations, D.el('p', 'rp-card-sub', 'Each station is scored out of ' +
      MAX_STATION_SCORE + ', on the same scale, so the four bars can be read against each other.'));
    D.append(stations, Charts.stationBars(rowsFor(report), MAX_STATION_SCORE));
    D.append(node, stations);
    return node;
  }
  /** The four scores as one 100-point bar, with the arithmetic spelled out. */
  function distributionPage(report) {
    var node = page('rp-page--dist');
    var rows = rowsFor(report);
    D.append(node, D.eyebrow('Score distribution', '--lilac'));
    D.append(node, D.el('h2', 'rp-h2', 'How the 100 points were made up'));

    var main = card('rp-card--dist');
    D.append(main, Charts.distribution(rows, MAX_STATION_SCORE, report.overall_score));
    D.append(main, Charts.stationKey(rows));

    var sum = D.el('div', 'rp-sum');
    rows.forEach(function (row, i) {
      if (i) D.append(sum, D.el('span', 'rp-sum-op', '+'));
      var term = D.el('span', 'rp-sum-term');
      term.style.setProperty('--rp-accent', 'var(' + row.color + ')');
      D.append(term, D.el('b', null, D.isNum(row.score) ? D.num(row.score, 1) : '—'));
      D.append(term, D.el('small', null, row.chip));
      D.append(sum, term);
    });
    D.append(sum, D.el('span', 'rp-sum-op', '='));
    var total = D.el('span', 'rp-sum-term rp-sum-term--total');
    D.append(total, D.el('b', null, D.num(report.overall_score, 1)));
    D.append(total, D.el('small', null, 'of ' + D.int(report.max_score || 100)));
    D.append(sum, total);
    D.append(main, sum);
    D.append(node, main);

    var howTo = card('rp-card--howto');
    D.append(howTo, D.el('h3', 'rp-card-title', 'How to read the pages that follow'));
    var list = D.el('ul', 'rp-list');
    [
      'Every number comes from what the station itself recorded during your run. Nothing is estimated, and anything a station did not measure is left out rather than filled in.',
      'Higher is better only against that activity\'s own target — a station is not "better" than another because its bar is longer.',
      'These activities are seconds to minutes long. Repeat them and the numbers will move. That is normal for measurements this short.',
      'The last page covers what signals like these are used for in real research, and where the limits of an activity like this one sit.'
    ].forEach(function (item) { D.append(list, D.el('li', null, item)); });
    D.append(howTo, list);
    D.append(node, howTo);
    return node;
  }
  function stationRow(report, key) {
    var rows = report.score_breakdown || [];
    for (var i = 0; i < rows.length; i++) if (rows[i].key === key) return rows[i];
    return {};
  }

  function answerLine(question) {
    var line = D.el('li', 'rp-answer' + (question.correct ? ' is-correct' : ' is-miss'));
    D.append(line, D.el('span', 'rp-answer-mark', question.correct ? '✓' : '✗'));
    var body = D.el('div', 'rp-answer-body');
    D.append(body, D.el('p', 'rp-answer-q', question.questionText || 'Recall question'));
    var detail = D.el('p', 'rp-answer-a');
    D.append(detail, D.el('span', null, 'You chose: ' + (question.selected || 'no answer')));
    if (!question.correct && question.correctAnswer) {
      D.append(detail, D.el('span', 'rp-answer-key', 'Answer: ' + question.correctAnswer));
    }
    D.append(body, detail);
    D.append(line, body);
    return line;
  }

  /** Test 2 — the posters, the recall questions, and the real gaze heatmap. */
  function gazePage(report) {
    var g = (report.summary || {}).gaze;
    if (!g) return null;
    var row = stationRow(report, 'gaze');
    var node = page('rp-page--gaze');
    D.append(node, stationHead('gaze', 'Test 2 · Gaze / Visual Memory', row.blurb, g.score));

    var top = D.el('div', 'rp-split');
    D.append(top, D.figure(g.recallScore || '—', 'Recall', 'questions answered correctly', '--sky'));
    D.append(top, D.metrics([
      ['Posters viewed', D.int(g.imagesViewed)],
      ['Gaze points recorded', D.int(g.gazeSamplesCollected), 'Estimated gaze positions captured while the posters were on screen.'],
      ['Recall accuracy', D.fraction(g.recallAccuracy)],
      ['Questions correct', D.isNum(g.recallCorrect) && D.isNum(g.recallTotal) ? g.recallCorrect + ' of ' + g.recallTotal : null]
    ]));
    D.append(node, top);

    var heat = card('rp-card--heat');
    D.append(heat, D.el('h3', 'rp-card-title', 'Where you looked'));
    D.append(heat, D.el('p', 'rp-card-sub', g.heatmapAvailable
      ? 'Built from the gaze coordinates this station recorded, drawn over the poster you were looking at. Warmer colour means that area held your gaze longer.'
      : 'The gaze tracker captured no points during this station, so no heatmap can be drawn. The posters are shown exactly as they appeared.'));
    var grid = D.el('div', 'rp-heat-grid');
    (g.images || []).forEach(function (image, i) { D.append(grid, Heatmap.card(image, i)); });
    D.append(heat, grid);
    D.append(node, heat);

    if ((g.questions || []).length) {
      var answers = card('rp-card--answers');
      D.append(answers, D.el('h3', 'rp-card-title', 'The recall questions'));
      var list = D.el('ul', 'rp-answers');
      g.questions.forEach(function (question) { D.append(list, answerLine(question)); });
      D.append(answers, list);
      D.append(node, answers);
    }

    D.append(node, D.researchPanel(g.researchNote, g.researchCaveat));
    return node;
  }
  /** Test 1 — the word search against a visible countdown. */
  function timerPage(report) {
    var t = (report.summary || {}).timer;
    if (!t) return null;
    var row = stationRow(report, 'timer');
    var node = page('rp-page--timer');
    D.append(node, stationHead('timer', 'Test 1 · Timer Attention / Visual Search', row.blurb, t.score));

    // §5's headline measurement, stated in words before it is charted.
    var checks = D.isNum(t.timerCheckCount) ? t.timerCheckCount : ((t.timerVisits || []).length || null);
    var callout = D.el('div', 'rp-callout');
    if (D.isNum(checks)) {
      var line = D.el('p', 'rp-callout-line');
      D.append(line, D.el('span', null, 'Number of times the participant looked at the ticking time:'));
      D.append(line, D.el('b', 'rp-callout-value', D.int(checks)));
      D.append(callout, line);
      D.append(callout, D.el('p', 'rp-callout-note',
        'This value shows how often attention shifted from the word search to the countdown. ' +
        'The station logged a check each time your gaze left the grid and settled on the clock.'));
    } else {
      D.append(callout, D.el('p', 'rp-callout-note',
        'Gaze tracking was not available for this round, so looks at the clock were not counted.'));
    }
    D.append(node, callout);

    var top = D.el('div', 'rp-split');
    D.append(top, D.figure(D.isNum(checks) ? D.int(checks) : '—', 'Time checks', 'times', '--zap'));
    D.append(top, D.metrics([
      ['Accuracy', D.fraction(t.accuracy), D.isNum(t.trialCount) && t.trialCount
        ? t.correctCount + ' of ' + t.trialCount + ' targets found' : null],
      ['Reaction time (median)', D.ms(t.medianReactionTimeMs)],
      ['Reaction time (mean)', D.ms(t.meanReactionTimeMs)],
      ['Reaction variability', D.ms(t.reactionTimeVariabilityMs), 'Spread of your reaction times across the round.'],
      ['Clock checks per minute', D.num(t.timerChecksPerMinute, 1)],
      ['Attention switches per minute', D.num(t.attentionSwitchesPerMinute, 1), 'Gaze moving between the grid and the clock.'],
      ['Time spent on the clock', D.ms(t.totalDwellMs)],
      ['Average glance length', D.ms(t.avgGlanceMs)],
      ['Deadline sensitivity', D.isNum(t.deadlineSensitivityRatio)
        ? D.num(t.deadlineSensitivityRatio, 2) + '×' + (t.deadlineSensitivityLabel ? ' · ' + t.deadlineSensitivityLabel : '')
        : null, 'Clock checks in the final quarter of the round against the first quarter.'],
      ['Accuracy change, start to end', D.signedFraction(t.performanceDelta), 'Last third of trials minus the first third, in percentage points.'],
      ['Pressure index', D.int(t.pressureIndex), 'The station\'s own 0-100 blend of clock checking, deadline sensitivity, reaction variability and switching. Its calibration range is provisional.'],
      ['Round length', D.seconds(t.roundDurationSeconds)]
    ]));
    D.append(node, top);

    var timeline = Charts.clockTimeline(t.timerVisits, t.roundDurationSeconds);
    var quarters = Charts.quarters(t.checksPerQuarter);
    if (timeline || quarters) {
      var chart = card('rp-card--timeline');
      D.append(chart, D.el('h3', 'rp-card-title', 'When the clock pulled you away'));
      if (timeline) D.append(chart, timeline);
      if (quarters) {
        D.append(chart, D.el('p', 'rp-card-sub', 'Checks per quarter of the round'));
        D.append(chart, quarters);
      }
      D.append(node, chart);
    }

    D.append(node, D.researchPanel(t.researchNote, t.researchCaveat));
    return node;
  }
  /** Test 4 — the try-not-to-laugh station. */
  function deadpanPage(report) {
    var d = (report.summary || {}).deadpan;
    if (!d) return null;
    var row = stationRow(report, 'deadpan');
    var node = page('rp-page--deadpan');
    D.append(node, stationHead('deadpan', 'Test 4 · Facial Expression / Emotional Containment', row.blurb, d.score));

    var top = D.el('div', 'rp-split');
    D.append(top, D.figure(D.int(d.laughCount) || '0', 'Expression events', 'times the signal crossed the station\'s threshold', '--punch'));
    D.append(top, D.metrics([
      ['Events recorded', D.int(d.expressionEvents)],
      ['Events per minute', D.num(d.laughsPerMinute, 2)],
      ['Peak intensity', D.percent(d.peakScorePct, 0), 'The strongest single expression reading of the whole session.'],
      ['Typical peak', D.percent(d.meanPeakPct, 0), 'Averaged across every recorded event.'],
      ['Median peak', D.percent(d.medianPeakPct, 0)],
      ['Session length', D.seconds(d.durationSeconds)],
      ['Mode', D.titleCase(d.mode)]
    ]));
    D.append(node, top);

    var strip = Charts.eventStrip(d.events);
    if (strip) {
      var chart = card('rp-card--events');
      D.append(chart, D.el('h3', 'rp-card-title', 'Every time you cracked'));
      D.append(chart, strip);
      D.append(node, chart);
    }
    if (d.note) D.append(node, D.note(d.note, 'rp-note--station'));
    D.append(node, D.researchPanel(d.researchNote, d.researchCaveat));
    return node;
  }

  var DRIFT_LABEL = { center: 'Straight', centre: 'Straight', left: 'Left', right: 'Right' };

  /** Test 3 — spin, then walk the line. */
  function wobblePage(report) {
    var w = (report.summary || {}).wobblewalk;
    if (!w) return null;
    var row = stationRow(report, 'wobblewalk');
    var node = page('rp-page--wobble');
    D.append(node, stationHead('wobblewalk', 'Test 3 · Walking Stability / Wobble Walk', row.blurb, w.score));

    if (w.available === false) {
      D.append(node, D.note(w.reason ||
        'The station could not track the walk well enough to measure it, so no walking metrics were recorded.',
        'rp-note--empty'));
      D.append(node, D.researchPanel(w.researchNote, w.researchCaveat));
      return node;
    }

    var top = D.el('div', 'rp-split');
    D.append(top, D.figure(D.num(w.wobbleScore, 1) || '—', 'Wobble', 'out of 100', '--mint'));
    D.append(top, D.metrics([
      ['Average deviation', D.percent(w.meanDeviationPct), 'How far from the ideal line you typically were.'],
      ['Widest deviation', D.percent(w.maxDeviationPct)],
      ['Path efficiency', D.percent(w.pathEfficiencyPct), 'Extra distance covered compared with a straight walk.'],
      ['Direction changes', D.int(w.directionChanges), 'Times the walk swapped sides of the centre line.'],
      ['Final direction', DRIFT_LABEL[w.driftDirection] || D.titleCase(w.driftDirection), 'Which side the end of the walk sat on.'],
      ['Walk duration', D.seconds(w.walkDurationSeconds)],
      ['Distance walked', D.isNum(w.walkDistanceBodyWidths) ? D.num(w.walkDistanceBodyWidths, 1) + ' body widths' : null],
      ['Spins before walking', D.int(w.spinCount)],
      ['Tracked frames', D.int(w.trackedFrames), 'Camera frames in which your body was located.']
    ]));
    D.append(node, top);

    var pathCard = card('rp-card--path');
    D.append(pathCard, D.el('h3', 'rp-card-title', 'The line you actually walked'));
    if ((w.route || []).length >= 2) {
      D.append(pathCard, D.el('p', 'rp-card-sub',
        'Your tracked position through the walk, against the straight line the activity asked for. ' +
        'You walked from the start marker toward the end marker.'));
      var canvas = D.el('canvas', 'rp-path-canvas');
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', 'Your walking path against the ideal straight centre line.');
      var paint = function () { WalkPath.render(canvas, w.route); };
      paint();
      // Canvas labels are drawn with the site's mono face; redraw once it is
      // ready so the printed page does not fall back to a system font.
      if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
        document.fonts.ready.then(paint).catch(function () {});
      }
      D.append(pathCard, canvas);
      D.append(pathCard, WalkPath.legend());
      if (w.measurementUnit) {
        D.append(pathCard, D.note('Deviation is measured in ' + w.measurementUnit +
          ', so the numbers do not change with how far you stood from the camera.', 'rp-note--unit'));
      }
    } else {
      D.append(pathCard, D.note('Too few tracked frames were kept to redraw the path.', 'rp-note--empty'));
    }
    D.append(node, pathCard);
    D.append(node, D.researchPanel(w.researchNote, w.researchCaveat));
    return node;
  }
  var LINE_ACCENTS = ['--sky', '--zap', '--punch', '--mint'];

  /**
   * Final page — research context, two short awareness notes, the disclaimer.
   * The four research directions and the awareness lines are chosen on the
   * server (backend/report_content.py) so screen and PDF always agree.
   */
  function finalPage(report) {
    var node = page('rp-page--final');
    D.append(node, D.eyebrow('Research context', '--lilac'));
    D.append(node, D.el('h2', 'rp-h2', 'What signals like these are used for'));
    if (report.research_intro) D.append(node, D.el('p', 'rp-lede', report.research_intro));

    var tiles = D.el('div', 'rp-research-grid');
    (report.research_lines || []).forEach(function (line, i) {
      var tile = D.el('div', 'rp-research-tile');
      tile.style.setProperty('--rp-accent', 'var(' + LINE_ACCENTS[i % LINE_ACCENTS.length] + ')');
      D.append(tile, D.el('span', 'rp-research-index', '0' + (i + 1)));
      D.append(tile, D.el('p', 'rp-research-line', line));
      D.append(tiles, tile);
    });
    D.append(node, tiles);
    D.append(node, D.note('Research directions, not measurements taken from you. ' +
      'Each report shows a different four.', 'rp-note--quiet'));

    if ((report.awareness_lines || []).length) {
      var awareness = card('rp-card--awareness');
      D.append(awareness, D.el('h3', 'rp-card-title', 'Two conditions that research keeps returning to'));
      report.awareness_lines.forEach(function (line) {
        D.append(awareness, D.el('p', 'rp-awareness-line', line));
      });
      D.append(node, awareness);
    }

    var disclaimer = D.el('aside', 'rp-disclaimer');
    D.append(disclaimer, D.el('h3', 'rp-disclaimer-title', 'What this report is not'));
    D.append(disclaimer, D.el('p', 'rp-disclaimer-body', report.disclaimer ||
      'These results represent performance metrics from experimental activities. ' +
      'They are not a diagnosis, clinical assessment, or medical evaluation of any kind.'));
    D.append(disclaimer, D.el('p', 'rp-disclaimer-body',
      'Nothing here says anything about your health. Four short games on one afternoon ' +
      'cannot, and this report does not try to. If something about your health is on your ' +
      'mind, that is a conversation for a doctor, not a score.'));
    D.append(node, disclaimer);

    var footer = D.el('footer', 'rp-footer');
    D.append(footer, D.el('span', null, 'The Thing · Behaviour Lab'));
    if (report.session_id) D.append(footer, D.el('span', null, report.session_id));
    if (when(report.generated_at)) D.append(footer, D.el('span', null, 'Generated ' + when(report.generated_at)));
    D.append(node, footer);
    return node;
  }

  return {
    summaryPage: summaryPage,
    distributionPage: distributionPage,
    timerPage: timerPage,
    gazePage: gazePage,
    wobblePage: wobblePage,
    deadpanPage: deadpanPage,
    finalPage: finalPage
  };
})();
