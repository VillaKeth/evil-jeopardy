const TIE_THRESHOLD_MS = 10;

function createBuzzQueue() {
  return { buzzes: [], isOpen: false, pointValue: 0, openedAt: null };
}

function open(queue, pointValue) {
  queue.buzzes = [];
  queue.isOpen = true;
  queue.pointValue = pointValue;
  queue.openedAt = Date.now();
}

function lock(queue) { queue.isOpen = false; }
function isOpen(queue) { return queue.isOpen; }

function recordBuzz(queue, socketId, serverReceiveTime, avgLatency) {
  if (!queue.isOpen) return false;
  if (queue.buzzes.some((b) => b.socketId === socketId)) return false;
  const adjustedTime = serverReceiveTime - avgLatency / 2;
  queue.buzzes.push({ socketId, serverReceiveTime, adjustedTime, avgLatency });
  queue.buzzes.sort((a, b) => a.adjustedTime - b.adjustedTime);
  return true;
}

function getBuzzWinner(queue) {
  if (queue.buzzes.length === 0) return null;
  const first = queue.buzzes[0];
  if (queue.buzzes.length === 1) return { socketId: first.socketId, adjustedTime: first.adjustedTime, tie: false };
  const second = queue.buzzes[1];
  const diff = Math.abs(first.adjustedTime - second.adjustedTime);
  if (diff <= TIE_THRESHOLD_MS) {
    const coinFlip = Math.random() < 0.5 ? 0 : 1;
    const winner = coinFlip === 0 ? first : second;
    return { socketId: winner.socketId, adjustedTime: winner.adjustedTime, tie: true };
  }
  return { socketId: first.socketId, adjustedTime: first.adjustedTime, tie: false };
}

function getBuzzOrder(queue) { return queue.buzzes.map((b) => b.socketId); }

function reset(queue) {
  queue.buzzes = [];
  queue.isOpen = false;
  queue.pointValue = 0;
  queue.openedAt = null;
}

module.exports = { createBuzzQueue, open, lock, isOpen, recordBuzz, getBuzzWinner, getBuzzOrder, reset, TIE_THRESHOLD_MS };
