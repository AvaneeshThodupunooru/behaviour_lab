/**
 * reveal.js — staged reveal sequence (spec §8).
 * Pure-ish: buildRevealScript() is a pure function of the real timer-check
 * count; the player() below is a small stateful UI helper that advances
 * through the script either automatically or on click/keypress.
 */
(function (root) {
  'use strict';

  /**
   * @param {number} timerCheckCount the participant's real, computed count
   * @returns {{text:string, pauseMs:number, emphasis:boolean}[]}
   */
  function buildRevealScript(timerCheckCount) {
    return [
      { text: 'YOU FINISHED!', sub: 'Nice job.', pauseMs: 1400, emphasis: false },
      { text: 'BUT\u2026', sub: '', pauseMs: 1700, emphasis: false },
      { text: 'You weren\u2019t really just playing a game.', sub: '', pauseMs: 1800, emphasis: false },
      { text: 'WE WERE WATCHING YOUR EYES.', sub: '', pauseMs: 1900, emphasis: true },
      { text: 'Every time you looked at the countdown, we recorded it.', sub: '', pauseMs: 1800, emphasis: false },
      {
        text: 'YOU CHECKED THE TIMER ' + timerCheckCount + ' TIME' + (timerCheckCount === 1 ? '' : 'S'),
        sub: '',
        pauseMs: 2200,
        emphasis: true,
        big: true
      },
      { text: 'Most people don\u2019t realize how often they check the clock under pressure.', sub: '', pauseMs: 2200, emphasis: false }
    ];
  }

  /**
   * Drives a reveal sequence into a container element, one beat at a time.
   * @param {HTMLElement} container
   * @param {ReturnType<typeof buildRevealScript>} script
   * @param {Function} onComplete called once the last beat has been shown and cleared
   */
  function playReveal(container, script, onComplete) {
    var index = -1;
    var advancing = false;
    var timerId = null;
    var cancelled = false;

    function renderBeat(beat) {
      container.innerHTML = '';
      var line = document.createElement('div');
      line.className = 'reveal-line' + (beat.emphasis ? ' reveal-line--emphasis' : '') + (beat.big ? ' reveal-line--big' : '');
      line.textContent = beat.text;
      container.appendChild(line);
      if (beat.sub) {
        var sub = document.createElement('div');
        sub.className = 'reveal-sub';
        sub.textContent = beat.sub;
        container.appendChild(sub);
      }
      // restart CSS fade-in
      // eslint-disable-next-line no-unused-expressions
      line.offsetWidth;
      line.classList.add('reveal-line--in');
    }

    function next() {
      if (cancelled) return;
      if (advancing) return;
      advancing = true;
      index++;
      if (index >= script.length) {
        container.innerHTML = '';
        if (onComplete) onComplete();
        return;
      }
      renderBeat(script[index]);
      var beat = script[index];
      timerId = setTimeout(function () {
        advancing = false;
        next();
      }, beat.pauseMs);
    }

    next();
    return function cancel() {
      cancelled = true;
      if (timerId !== null) clearTimeout(timerId);
    };
  }

  root.PressureClockReveal = { buildRevealScript: buildRevealScript, playReveal: playReveal };
})(typeof window !== 'undefined' ? window : globalThis);
