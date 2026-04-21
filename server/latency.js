const CALIBRATION_INTERVAL_MS = 5 * 60 * 1000;
const PING_COUNT = 10;

function calculateAvgLatency(samples) {
  if (samples.length === 0) return 0;
  if (samples.length >= 5) {
    const sorted = [...samples].sort((a, b) => a - b);
    const trimmed = sorted.slice(1, -1);
    return Math.round(trimmed.reduce((a, b) => a + b, 0) / trimmed.length);
  }
  return Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
}

function shouldRecalibrate(lastCalibrationTime) {
  return Date.now() - lastCalibrationTime > CALIBRATION_INTERVAL_MS;
}

function createCalibrationSession() {
  return { samples: [], pingsSent: 0, startTime: null };
}

function recordPingSent(session) {
  session.startTime = Date.now();
  session.pingsSent++;
}

function recordPong(session) {
  if (session.startTime) {
    session.samples.push(Date.now() - session.startTime);
    session.startTime = null;
  }
  return session.pingsSent >= PING_COUNT;
}

module.exports = {
  PING_COUNT, CALIBRATION_INTERVAL_MS,
  calculateAvgLatency, shouldRecalibrate,
  createCalibrationSession, recordPingSent, recordPong,
};
