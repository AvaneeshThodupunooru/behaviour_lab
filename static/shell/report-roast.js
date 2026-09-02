/* Behavior Lab — final report voice.
 *
 * All participant-facing copy for the final report lives here: score tiers,
 * roast lines, per-station verdicts, callouts, and human metric labels. Pure
 * data and pure functions, deliberately mirroring the structure WobbleWalk's
 * own report page uses so the two read like the same writer.
 *
 * Nothing here computes a score. Every number still comes from
 * backend/report.py; this file only decides what to say about it.
 *
 * House rule: roast the performance, never imply a finding. The report sits
 * directly under a "not a diagnosis" disclaimer and the stations are real.
 */
(function () {
  'use strict';

  // Higher overall is better here (100 = accurate, calm, straight, stone-faced),
  // which is the inverse of WobbleWalk's own 0-100 wobble scale. Top tier gets
  // the "irritatingly competent" joke; bottom tier gets the chaos.
  var OVERALL_TIERS = [
    {
      min: 85,
      label: 'Nothing found, concerningly',
      title: 'Suspiciously Well-Adjusted',
      note: 'Four cameras, four tasks, nothing to report. Either you are genuinely fine, or you have gotten very good at the parts people can measure.'
    },
    {
      min: 70,
      label: 'Holds up under inspection',
      title: 'Functioning Adult, Allegedly',
      note: 'You cleared the bar by enough that nobody will look again. Most things go unnoticed exactly this way.'
    },
    {
      min: 50,
      label: 'Cracks, but load-bearing',
      title: 'Structurally Sound, Emotionally Load-Bearing',
      note: 'Everything works. Nothing is comfortable. You will keep doing this for decades and describe it as fine.'
    },
    {
      min: 30,
      label: 'Operational, barely',
      title: 'Held Together By Vibes And Ligaments',
      note: 'Your nervous system attended under protest, delivered the minimum, and is already negotiating an exit.'
    },
    {
      min: 15,
      label: 'Findings withheld',
      title: 'The Data Has Concerns It Cannot Legally Express',
      note: 'Four stations, four separate complaints, one shared conclusion we are not allowed to print.'
    },
    {
      min: 0,
      label: 'Statistically upsetting',
      title: "You Are The Control Group's Nightmare",
      note: 'You have widened the known range of what a human being does under observation. The lower end of it.'
    }
  ];

  var PARTIAL_TIER = {
    min: null,
    label: 'Incomplete evidence',
    title: 'Insufficient Data, Abundant Opinions',
    note: 'You left before every station got its turn, so the overall score is withheld. The individual verdicts were already written.'
  };

  // Picked by a seed derived from the session's own metrics, so a given
  // participant always gets the same roast no matter how often they reload.
  var ROAST_LINES = {
    clean: [
      'Bro completed a behavioural test battery and made it look like a hobby.',
      'Every station tried to find something. Every station went home unpaid.',
      'You performed so consistently the data got bored and stopped taking notes.',
      'Bro walked in, cooperated fully, and left. Deeply unsettling behaviour.',
      'Your nervous system has better uptime than most production servers.',
      'Suspiciously clean. Either you are well-rested or you have done this before.',
      'Bro treated a psychology experiment like a performance review he intended to win.',
      'Nothing showed up. That is not the same as nothing being there.',
      'You are the participant the lab shows to funders. Nobody asks what it cost you.',
      'Composure this good is usually built rather than born, and we are not going to ask.',
      'Bro cleared every station and learned nothing about himself. Efficient.',
      'The data has no notes. The data is being polite.',
      'You held four cameras at arm’s length for twenty minutes. Practised.',
      'Bro is fine. Bro has been fine for a suspiciously long time now.',
      'Every metric behaved itself. Somewhere, something is compensating.',
      'You gave the machines exactly what they asked for and not one thing more.',
      'Bro optimised for the test. Life is also a test, so honestly, fair.',
      'Flawless run. The lab will remember you for about a week.'
    ],
    wobbly: [
      'Bro is running on 40% battery and refusing to plug in.',
      'Half your brain showed up. The other half is still in the queue.',
      'You were fine, then you were not, then you were fine again. Riveting.',
      'Your reflexes and your memory are not on the same payroll.',
      'Bro peaked during calibration and coasted on nostalgia.',
      'Every station got a different version of you. None of them was the final draft.',
      'You performed like the Wi-Fi at a government office.',
      'Bro has two settings and both of them were on cooldown.',
      'Consistently mediocre across four unrelated tasks. That takes a kind of discipline.',
      'You are functioning. Nobody specified at what.',
      'Bro is doing his best and his best is currently under review.',
      'The results are average, which historically is where people stop looking.',
      'You did just enough to not be noticed. That is a strategy, and it is working.',
      'Bro’s attention arrived late and left early, like a contractor.',
      'Somewhere in the middle. Nobody builds a plaque for the middle.',
      'Your good stations are carrying your bad stations and they are getting tired.',
      'Bro is one bad night of sleep away from a significantly funnier report.',
      'You are not falling apart. You are simply not assembled tightly.',
      'Four tasks, four partial efforts, one unified shrug.',
      'The lab has no strong feelings about you. Neither, apparently, do you.'
    ],
    chaos: [
      'Bro, four cameras and not one of them can explain what happened.',
      'Your data has been forwarded to people who did not ask for it.',
      'You did not fail the tests. You renegotiated them.',
      'Bro’s nervous system left on read.',
      'Every metric moved. None of them helped.',
      'The lab has seen worse. The lab is lying to be polite.',
      'Bro treated the instructions like terms and conditions.',
      'Your results will be used to calibrate the lower bound.',
      'Four stations, four witnesses, no defence.',
      'Bro arrived as a participant and leaves as a cautionary example.',
      'This report will outlive your memory of taking it.',
      'You have set a record nobody is going to read out loud.',
      'The scoring function tried to be generous. There was nothing to be generous with.',
      'Bro did not lose to the tasks. Bro lost to being awake.',
      'Somewhere a graph now has an outlier, and the outlier has your name on it.',
      'Your performance has been archived for reasons that were not explained to us.',
      'Bro is not built for measurement, and yet here he is, consenting to it.',
      'Every station is fine. They are unanimous about the other thing.',
      'You will tell this story as a joke. The data is filing it differently.',
      'Bro walked into a room full of sensors and gave them all the same answer.'
    ]
  };

  function roastPool(pct) {
    if (pct >= 0.7) return ROAST_LINES.clean;
    if (pct >= 0.3) return ROAST_LINES.wobbly;
    return ROAST_LINES.chaos;
  }

  // -------------------------------------------------------------------
  // Value formatting. The grids used to print raw payload keys and full
  // float precision ("accuracy: 0.6666666666666666"), which is the least
  // funny thing a report can do.
  // -------------------------------------------------------------------
  function num(value, fallback) {
    var parsed = Number(value);
    return isFinite(parsed) ? parsed : (fallback === undefined ? 0 : fallback);
  }

  function trim(value, digits) {
    var factor = Math.pow(10, digits === undefined ? 1 : digits);
    return String(Math.round(num(value) * factor) / factor);
  }

  var fmt = {
    pctOfOne: function (v) { return Math.round(num(v) * 100) + '%'; },
    pct: function (v) { return trim(v) + '%'; },
    seconds: function (v) { return trim(v) + ' s'; },
    msAsSeconds: function (v) { return trim(num(v) / 1000) + ' s'; },
    msSpread: function (v) { return '±' + trim(num(v) / 1000) + ' s'; },
    perMinute: function (v) { return trim(v) + ' / min'; },
    outOf100: function (v) { return trim(v) + ' / 100'; },
    count: function (v) { return String(num(v)); },
    plain: function (v) { return String(v); },
    side: function (v) { return v === 'center' ? 'Dead centre' : (String(v || '').charAt(0).toUpperCase() + String(v || '').slice(1)); }
  };

  // [payload key, human label, formatter] in the order they should appear.
  var METRIC_SPECS = {
    timer: [
      ['accuracy', 'Accuracy', fmt.pctOfOne],
      ['meanReactionTimeMs', 'Mean reaction', fmt.msAsSeconds],
      ['reactionTimeVariabilityMs', 'Reaction spread', fmt.msSpread],
      ['timerChecksPerMinute', 'Clock checks', fmt.perMinute],
      ['attentionSwitchesPerMinute', 'Attention switches', fmt.perMinute],
      ['pressureIndex', 'Pressure index', fmt.outOf100]
    ],
    gaze: [
      ['recallScore', 'Recall', fmt.plain],
      ['imagesViewed', 'Images viewed', fmt.count],
      ['gazeSamplesCollected', 'Gaze samples', fmt.count]
    ],
    deadpan: [
      ['laughCount', 'Laughs', fmt.count],
      ['peakScorePct', 'Peak expression', fmt.pct],
      ['durationSeconds', 'Held out for', fmt.seconds]
    ],
    wobblewalk: [
      ['wobbleScore', 'Wobble', fmt.outOf100],
      ['walkDurationSeconds', 'Walk duration', fmt.seconds],
      ['meanDeviationPct', 'Average deviation', fmt.pct],
      ['pathEfficiencyPct', 'Path efficiency', fmt.pct],
      ['directionChanges', 'Direction changes', fmt.count],
      ['driftDirection', 'Finished', fmt.side]
    ]
  };

  // -------------------------------------------------------------------
  // Per-station voice. Each entry supplies the card heading, a verdict
  // chosen from the station's own numbers, and callouts in WobbleWalk's
  // buildCallouts style: one line per metric, joke attached.
  // -------------------------------------------------------------------
  function recallFraction(summary) {
    var parts = String(summary.recallScore || '').split('/');
    var got = num(parts[0], 0);
    var total = num(parts[1], 0);
    return total > 0 ? got / total : null;
  }

  var STATIONS = {
    gaze: {
      title: 'Eyewitness Unreliability Assessment',
      chip: 'Eyewitness',
      skipped: 'Skipped. The tracker was ready to judge you and got nothing.',
      verdict: function (summary) {
        var recall = recallFraction(summary);
        if (recall === null) return 'You looked at the images. No recall questions came back, so we are taking your word for all of it.';
        if (recall >= 0.99) return 'You remembered everything. Under oath this would be suspicious.';
        if (recall >= 0.6) return 'Mostly accurate. A jury would believe you and be mildly wrong.';
        if (recall >= 0.3) return 'You saw the image. You did not file the paperwork.';
        return 'Your eyes were open the entire time. That is the most we can confirm.';
      },
      callouts: function (summary) {
        var lines = [];
        var recall = recallFraction(summary);
        var samples = num(summary.gazeSamplesCollected);

        if (recall !== null) {
          var parts = String(summary.recallScore).split('/');
          var missed = num(parts[1]) - num(parts[0]);
          if (missed === 0) lines.push('Every recall question correct. Annoyingly retentive behaviour.');
          else if (missed === 1) lines.push('One question missed. It will bother you later, at an inconvenient hour.');
          else lines.push(missed + ' questions missed. Your eyes filed the report and your memory lost it.');
        }

        if (samples >= 200) lines.push(samples + ' gaze samples. The tracker knows the exact order you looked at things, and it has opinions about that order.');
        else if (samples >= 100) lines.push(samples + ' gaze samples — enough to reconstruct where you looked, not quite enough to defend it.');
        else if (samples > 0) lines.push('Only ' + samples + ' samples survived tracking. Your eyes and the camera never agreed on a meeting time.');
        else lines.push('No gaze samples recorded. Whatever you were looking at, it was not the experiment.');

        return lines;
      }
    },

    timer: {
      title: 'Grace Under Pressure (Pending Review)',
      chip: 'Composure',
      skipped: 'Skipped. The clock is still running, technically.',
      verdict: function (summary) {
        var pressure = num(summary.pressureIndex);
        if (pressure < 25) return 'Calm, accurate, irritating. The clock ran out of ideas before you did.';
        if (pressure < 50) return 'You held it together the way a folding chair holds it together.';
        if (pressure < 75) return 'Composure was attempted. Composure was not achieved.';
        return 'The clock won. It did not even try hard.';
      },
      callouts: function (summary) {
        var lines = [];
        var accuracy = num(summary.accuracy);
        var reaction = num(summary.meanReactionTimeMs);
        var spread = num(summary.reactionTimeVariabilityMs);
        var checks = num(summary.timerChecksPerMinute);

        if (accuracy >= 0.9) lines.push(Math.round(accuracy * 100) + '% accurate under a countdown. Show-off.');
        else if (accuracy >= 0.6) lines.push(Math.round(accuracy * 100) + '% accurate. Passing, in the way a bridge can be passing.');
        else lines.push(Math.round(accuracy * 100) + '% accurate. You were guessing, and the guesses were also under pressure.');

        if (reaction > 0 && reaction < 800) lines.push('Reacting in ' + trim(reaction / 1000) + 's — faster than your judgement, which explains a lot.');
        else if (reaction >= 1800) lines.push(trim(reaction / 1000) + 's to react. Long enough to consider your options and pick the wrong one.');
        else if (reaction > 0) lines.push(trim(reaction / 1000) + 's to react. Not slow, not fast, deeply average, much like the rest of us.');

        if (spread > 0 && spread > reaction * 0.6) lines.push('Your reaction times swung by ±' + trim(spread / 1000) + 's. Consistency is a choice and you declined it.');

        if (checks === 0) lines.push('You never checked the clock once. Bold. Also why you ran out of it.');
        else if (checks >= 10) lines.push(trim(checks) + ' clock checks a minute. The time was not going to change, but you kept asking.');

        return lines;
      }
    },

    deadpan: {
      title: 'Emotional Containment Audit',
      chip: 'Restraint',
      skipped: 'Skipped. Your face escaped documentation.',
      verdict: function (summary) {
        var laughs = num(summary.laughCount);
        var peak = num(summary.peakScorePct);
        if (laughs === 0 && peak < 25) return 'Zero laughs, flat throughout. Whatever happened to you, it happened long before this event.';
        if (laughs === 0) return 'You did not laugh, but your face filed a partial confession.';
        if (laughs <= 2) return 'You broke twice. Everyone breaks. You just did it on camera, in front of a scoring function.';
        return laughs + ' laughs. Containment was never really on the table.';
      },
      callouts: function (summary) {
        var lines = [];
        var laughs = num(summary.laughCount);
        var peak = num(summary.peakScorePct);
        var held = num(summary.durationSeconds);

        if (peak >= 85) lines.push('Peak expression hit ' + trim(peak) + '%. Your face made an executive decision without consulting you.');
        else if (peak >= 40) lines.push('Peak expression ' + trim(peak) + '%. Something got through. We both know what it was.');
        else lines.push('Peak expression only ' + trim(peak) + '%. Impressive, and slightly concerning as a personality trait.');

        if (held > 0 && held < 30) lines.push('You lasted ' + trim(held) + ' seconds. The video had not even reached the good part.');
        else if (held > 0) lines.push('Held out for ' + trim(held) + ' seconds against material specifically engineered to beat you.');

        if (laughs >= 5) lines.push(laughs + ' separate failures of composure. At this point it is less an audit and more a highlight reel.');
        else if (laughs === 0) lines.push('Not one laugh. The camera waited the entire time and got nothing to work with.');

        return lines;
      }
    },

    wobblewalk: {
      title: 'Structural Integrity Survey',
      chip: 'Structural',
      skipped: 'Skipped. Your gait remains a rumour.',
      unavailable: 'The video came back unscoreable, which is its own kind of result.',
      verdict: function (summary) {
        var wobble = num(summary.wobbleScore);
        if (wobble < 15) return 'You walked a straight line on request, first try. Deeply un-relatable.';
        if (wobble < 40) return 'Broadly straight, occasionally negotiable.';
        if (wobble < 70) return 'You did not walk the line. You entered talks with it.';
        return 'That was not a walk. That was a series of recoveries in a convincing order.';
      },
      callouts: function (summary) {
        var lines = [];
        var changes = num(summary.directionChanges);
        var drift = summary.driftDirection;
        var efficiency = num(summary.pathEfficiencyPct);

        if (changes >= 5) lines.push(changes + ' direction changes. Commitment issues, now available in 4K.');
        else if (changes >= 2) lines.push(changes + ' course corrections. Your balance was clearly working from home.');
        else lines.push('Almost no course corrections. Annoyingly mature behaviour.');

        if (drift === 'center') lines.push('You finished near centre. Your dignity completed a late comeback.');
        else if (drift) lines.push('You drifted ' + drift + '. Apparently that side had better Wi-Fi.');

        if (efficiency > 0 && efficiency < 70) lines.push('Only ' + trim(efficiency) + '% path efficiency. You covered more ground than the task required and got no extra credit for it.');
        else if (efficiency >= 95) lines.push(trim(efficiency) + '% path efficiency. You took the shortest route available to a human being.');

        return lines;
      }
    }
  };

  // -------------------------------------------------------------------
  // Research context. Each station measures something that is genuinely
  // used in autism research, and saying so is more interesting than the
  // joke on its own. Two hard rules for this section:
  //
  //   1. It describes the METHOD, never the participant. Nothing here
  //      refers to the numbers above it.
  //   2. Every claim is group-level and hedged the way the literature
  //      hedges it. No thresholds, no screening language, no "your".
  //
  // RESEARCH_INTRO is printed above every list so the boundary is stated
  // on each card rather than once at the bottom of the page.
  // -------------------------------------------------------------------
  var RESEARCH_INTRO = 'Same signal, serious use. None of the numbers on this card are a screening result.';

  var RESEARCH_CONTEXT = {
    gaze: [
      'Eye-tracking is one of the most studied objective measures in autism research: where attention lands, and for how long, before anyone is asked a question.',
      'Viewing scenes like these, studies repeatedly report group-level differences in social attention — less time on faces and eyes, more on objects, background, and edges.',
      'The paradigm needs no language and no instruction-following, so it can be run on toddlers. That is why it appears so often in work on early identification.',
      'In 2022 the FDA authorised an eye-tracking-based device (EarliPoint Evaluation) as an aid in diagnosing autism in children aged 16-30 months — alongside clinical judgement, explicitly not instead of it.',
      'Order matters as much as dwell time. The sequence a scan path takes is studied as its own signal, and it is not something a heatmap can show you.',
      'The distributions overlap heavily between groups. A heatmap identifies nothing on its own, and an event webcam is far coarser than lab hardware.'
    ],
    timer: [
      'Reaction-time tasks earn their place in neurodevelopmental research less for average speed than for consistency — how much each response differs from the one before it.',
      'Raised intra-individual variability in response time is among the more reproducible findings across autism and ADHD research.',
      'Attention shifting is studied specifically: the cost of disengaging from one thing and re-orienting to another. Slowed disengagement in infancy is an active research area.',
      'Adding a countdown separates ability from executive load. The same person can be accurate untimed and scattered timed, and the gap is the interesting part.',
      'These measures are strikingly non-specific. Variability rises with poor sleep, anxiety, caffeine, ADHD, illness, and simply being a teenager in a room full of cameras.',
      'So they turn up as one input inside a research battery, never as a test that answers anything by itself.'
    ],
    deadpan: [
      'Automated facial-expression analysis lets researchers measure affect frame by frame instead of depending on an observer scoring a video afterwards.',
      'Autism research looks at the dynamics rather than the feeling: how fast an expression builds, how long it holds, how closely it tracks what is happening in the room.',
      'Group-level differences are reported in spontaneous expressivity and in the timing of shared social smiling — the smile that arrives with someone rather than merely near them.',
      'The same pipelines appear in research on Parkinson’s, depression, and pain assessment, because a camera reads any movement of a face without caring why it moved.',
      'Deliberately holding an expression back, which is the whole task here, is a different behaviour from not producing one. To a camera the two look almost identical and they mean opposite things.',
      'That ambiguity is exactly why expression data is never read on its own in a clinical setting.'
    ],
    wobblewalk: [
      'Motor differences are among the earliest and most consistently reported findings in autism research, often observable well before the social criteria are assessed.',
      'Gait work reports group-level differences in step-to-step variability, width of stance, postural stability, and the overall smoothness of the movement.',
      'Markerless pose estimation — the same class of model running in this station — moved that measurement out of a motion-capture lab and onto a phone camera. Much of the recent literature is about validating one against the other.',
      'Motor coordination is not part of the diagnostic criteria for autism. It is studied as an associated feature, and it overlaps with dyspraxia, ADHD, and ordinary differences in how athletic someone is.',
      'Deviation here is normalised to shoulder width so that standing closer to the camera does not change the number — the same scale-invariance trick research pipelines use.',
      'One walk, one corridor, one camera, one evening: a demonstration of the method rather than a measurement of a person.'
    ]
  };

  // -------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------
  function overallTier(score, maxScore) {
    if (score === null || score === undefined) return PARTIAL_TIER;
    var pct = num(score) / num(maxScore, 100);
    var onHundred = Math.round(pct * 100);
    for (var i = 0; i < OVERALL_TIERS.length; i++) {
      if (onHundred >= OVERALL_TIERS[i].min) return OVERALL_TIERS[i];
    }
    return OVERALL_TIERS[OVERALL_TIERS.length - 1];
  }

  // Same trick WobbleWalk uses: seed from the metrics themselves so the roast
  // is stable for a session but varies between participants.
  function overallRoast(report) {
    var summary = (report && report.summary) || {};
    var maxScore = num(report && report.max_score, 100);
    var overall = report && report.overall_score;
    var pct = (overall === null || overall === undefined) ? 0.45 : num(overall) / maxScore;

    var seed = Math.round(num(overall) * 10);
    Object.keys(summary).forEach(function (key) {
      var station = summary[key] || {};
      seed += Math.round(num(station.score) * 7);
      seed += num(station.laughCount) + num(station.directionChanges) + num(station.gazeSamplesCollected);
    });

    var pool = roastPool(pct);
    return pool[Math.abs(seed) % pool.length];
  }

  function station(key) {
    return STATIONS[key] || null;
  }

  function stationMetrics(key, summary) {
    var spec = METRIC_SPECS[key] || [];
    var rows = [];
    spec.forEach(function (entry) {
      var value = summary ? summary[entry[0]] : undefined;
      if (value === undefined || value === null || value === '') return;
      rows.push([entry[1], entry[2](value)]);
    });
    return rows;
  }

  function stationVerdict(key, summary) {
    var config = STATIONS[key];
    return config && config.verdict ? config.verdict(summary || {}) : '';
  }

  function stationCallouts(key, summary) {
    var config = STATIONS[key];
    if (!config || !config.callouts) return [];
    return config.callouts(summary || {}).filter(Boolean);
  }

  // Static per-station text: unlike the verdicts and callouts, this does not
  // read the summary at all, by design.
  function stationResearch(key) {
    return (RESEARCH_CONTEXT[key] || []).slice();
  }

  window.ReportRoast = {
    researchIntro: RESEARCH_INTRO,
    stationResearch: stationResearch,
    overallTier: overallTier,
    overallRoast: overallRoast,
    station: station,
    stationMetrics: stationMetrics,
    stationVerdict: stationVerdict,
    stationCallouts: stationCallouts,
    title: function (key) { return (STATIONS[key] && STATIONS[key].title) || key; },
    chip: function (key) { return (STATIONS[key] && STATIONS[key].chip) || key; },
    skipped: function (key) { return (STATIONS[key] && STATIONS[key].skipped) || 'Not completed for this session.'; },
    unavailable: function (key, reason) {
      var base = (STATIONS[key] && STATIONS[key].unavailable) || 'Recorded, but the metrics did not survive the trip.';
      return reason ? base + ' (' + reason + ')' : base;
    }
  };
})();
