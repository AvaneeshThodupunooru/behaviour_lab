/**
 * trial-logger.js — records one row per game trial.
 * Stateful (unlike roi.js / metrics.js) but has no DOM dependency, so it's
 * still easy to unit test: create a logger, feed it start/response calls,
 * assert on getTrials().
 */
(function (root) {
  'use strict';

  /**
   * @returns {{startTrial:Function, recordResponse:Function, getTrials:Function, reset:Function}}
   */
  function createTrialLogger() {
    var trials = [];
    var counter = 0;

    /**
     * @param {1|2|3} round
    * @param {string} targetType canonical target identifier, such as a word
     * @param {number} shownAt session-relative ms
     * @returns {object} the trial record (also stored internally, mutated by recordResponse)
     */
    function startTrial(round, targetType, shownAt) {
      counter++;
      var trial = {
        round: round,
        trialId: counter,
        targetShownAt: shownAt,
        respondedAt: null,
        reactionTimeMs: null,
        correct: false,
        targetType: targetType,
        clickedType: null
      };
      trials.push(trial);
      return trial;
    }

    /**
     * @param {object} trial record returned by startTrial
    * @param {string} clickedType the selected target identifier
     * @param {number} respondedAt session-relative ms
     * @param {boolean} [isCorrect] override auto correctness check (targetType === clickedType)
     */
    function recordResponse(trial, clickedType, respondedAt, isCorrect) {
      if (clickedType === null) {
        trial.respondedAt = null;
        trial.reactionTimeMs = null;
      } else {
        trial.respondedAt = respondedAt;
        trial.reactionTimeMs = respondedAt - trial.targetShownAt;
      }
      trial.clickedType = clickedType;
      trial.correct = typeof isCorrect === 'boolean' ? isCorrect : clickedType === trial.targetType;
      return trial;
    }

    function getTrials(round) {
      if (typeof round === 'undefined') return trials.slice();
      return trials.filter(function (t) { return t.round === round; });
    }

    function reset() {
      trials = [];
      counter = 0;
    }

    return {
      startTrial: startTrial,
      recordResponse: recordResponse,
      getTrials: getTrials,
      reset: reset
    };
  }

  var api = { createTrialLogger: createTrialLogger };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.PressureClockTrialLogger = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
