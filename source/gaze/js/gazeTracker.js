const GazeTracker = (function () {
  let onCalibrationCompleteCb = null;
  let onResultCb = null;
  let onErrorCb = null;
  let onCamDeniedCb = null;

  GazeCloudAPI.OnCalibrationComplete = function () {
    if (onCalibrationCompleteCb) onCalibrationCompleteCb();
  };
  GazeCloudAPI.OnResult = function (GazeData) {
    if (onResultCb) onResultCb(GazeData);
  };
  GazeCloudAPI.OnError = function (msg) {
    if (onErrorCb) onErrorCb(msg);
  };
  GazeCloudAPI.OnCamDenied = function () {
    if (onCamDeniedCb) onCamDeniedCb();
  };

  return {
    start: () => GazeCloudAPI.StartEyeTracking(),
    stop: () => GazeCloudAPI.StopEyeTracking(),
    onCalibrationComplete: (cb) => { onCalibrationCompleteCb = cb; },
    onResult: (cb) => { onResultCb = cb; },
    onError: (cb) => { onErrorCb = cb; },
    onCamDenied: (cb) => { onCamDeniedCb = cb; }
  };
})();