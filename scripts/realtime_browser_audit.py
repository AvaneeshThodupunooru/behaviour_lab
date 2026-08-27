"""Temporary headed Chrome audit using real wall-clock waits only."""
from __future__ import annotations

import json
import os
import time
import urllib.request

from websocket import create_connection


CDP = "http://127.0.0.1:9223"


class Tab:
    def __init__(self):
        request = urllib.request.Request(CDP + "/json/new?about:blank", method="PUT")
        with urllib.request.urlopen(request, timeout=10) as response:
            target = json.load(response)
        self.ws = create_connection(target["webSocketDebuggerUrl"], timeout=30)
        self.ident = 0

    def call(self, method, params=None):
        self.ident += 1
        ident = self.ident
        self.ws.send(json.dumps({"id": ident, "method": method, "params": params or {}}))
        while True:
            message = json.loads(self.ws.recv())
            if message.get("id") == ident:
                return message.get("result", {})

    def evaluate(self, expression):
        response = self.call("Runtime.evaluate", {
            "expression": expression,
            "returnByValue": True,
            "awaitPromise": True,
        })
        result = response.get("result", {})
        if "exceptionDetails" in response:
            raise RuntimeError(response["exceptionDetails"])
        return result.get("value")

    def navigate(self, url):
        self.call("Page.navigate", {"url": url})
        deadline = time.time() + 30
        while time.time() < deadline:
            try:
                if self.evaluate("document.readyState") == "complete":
                    self.call("Page.bringToFront")
                    return
            except Exception:
                pass
            time.sleep(0.25)
        raise RuntimeError(f"Timed out loading {url}")

    def close(self):
        self.ws.close()


def phase_state(tab):
    return tab.evaluate("""
      (() => {
        const state = {};
        for (const id of ['merged-calibration-screen','experimentScreen','app','screen-start','screen-transition','screen-game','screen-results']) {
          const e = document.getElementById(id); const s = e && getComputedStyle(e);
          state[id] = e ? {hidden:e.hidden, display:s.display, visibility:s.visibility, className:e.className} : null;
        }
        state.posterCounter = document.getElementById('posterCounter').textContent;
        state.timer = document.getElementById('timer-value-sec').textContent + document.getElementById('timer-value-ms').textContent;
        return state;
      })()
    """)


def wait_foreground(tab, seconds):
    end = time.time() + seconds
    while time.time() < end:
        tab.call("Page.bringToFront")
        time.sleep(min(1, max(0, end - time.time())))


def main():
    base = "http://127.0.0.1:8000"

    gaze = Tab()
    gaze.navigate(base + "/games/gaze-timer/")
    print("GAZE_LOAD=" + json.dumps(phase_state(gaze), sort_keys=True))
    # Keep real image loading and phase timers, but replace only external calibration.
    gaze.evaluate("GazeTracker.start = () => setTimeout(() => GazeCloudAPI.OnCalibrationComplete(), 100)")
    gaze.evaluate("document.getElementById('merged-start').click()")
    wait_foreground(gaze, 2)
    print("GAZE_PHASE1_2S=" + json.dumps(phase_state(gaze), sort_keys=True))
    wait_foreground(gaze, 10)
    print("GAZE_PHASE1_12S=" + json.dumps(phase_state(gaze), sort_keys=True))
    wait_foreground(gaze, 10)
    print("GAZE_TRANSITION_22S=" + json.dumps(phase_state(gaze), sort_keys=True))
    wait_foreground(gaze, 5)
    print("GAZE_PHASE2_27S=" + json.dumps(phase_state(gaze), sort_keys=True))
    wait_foreground(gaze, 20)
    print("GAZE_PHASE2_47S=" + json.dumps(phase_state(gaze), sort_keys=True))
    wait_foreground(gaze, 25)
    print("GAZE_AFTER_72S=" + json.dumps(phase_state(gaze), sort_keys=True))
    gaze.close()

    if os.environ.get("GAZE_ONLY"):
        return

    deadpan = Tab()
    deadpan.navigate(base + "/games/deadpan/")
    deadpan.evaluate("""
      window.__audit = {ticks: [], errors: []};
      window.addEventListener('error', e => window.__audit.errors.push('error:' + e.message));
      window.addEventListener('unhandledrejection', e => window.__audit.errors.push('rejection:' + String(e.reason)));
      window.__auditNativeSetInterval = window.setInterval;
      window.setInterval = function(fn, delay, ...args) {
        if (delay === 1000) {
          return window.__auditNativeSetInterval(function(...inner) {
            const timer = document.getElementById('hudTimer');
            window.__audit.ticks.push({wall: Date.now(), before: timer && timer.textContent});
            return fn.apply(this, inner);
          }, delay, ...args);
        }
        return window.__auditNativeSetInterval(fn, delay, ...args);
      };
    """)
    # This is the participant-facing path that was broken: the visible modal button.
    deadpan.evaluate("document.getElementById('introCloseBtn').click()")
    started = time.time()
    for elapsed in (2, 12, 22, 32, 35):
        wait_foreground(deadpan, max(0, elapsed - (time.time() - started)))
        state = deadpan.evaluate("""
          (() => ({
            wall: Date.now(),
            timerText: document.getElementById('hudTimer').textContent,
            timerShown: document.getElementById('hudTimer').classList.contains('show'),
            summaryShown: document.getElementById('summaryOverlay').classList.contains('show'),
            ticks: window.__audit.ticks,
            errors: window.__audit.errors
          }))()
        """)
        print(f"DEADPAN_{elapsed}S=" + json.dumps(state, sort_keys=True))
    deadpan.close()


if __name__ == "__main__":
    main()
