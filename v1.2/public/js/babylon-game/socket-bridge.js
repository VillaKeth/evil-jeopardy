// Evil Jeopardy 1.2 — Babylon.js Socket Bridge
// Bridges Babylon minigame scenes ↔ Socket.io server events

class SocketBridge {
  constructor(socket) {
    this.socket = socket;
    this._listeners = new Map();
  }

  // === Outgoing (scene → server) ===

  emitPhaseComplete(phase, score, details = {}) {
    if (!this.socket) return;
    this.socket.emit('baking:phase-complete', {
      teamId: this.teamId,
      phase,
      score: Math.round(score),
      details
    });
  }

  // === Incoming (server → scene) ===

  onPhaseCompleted(callback) {
    return this._on('baking:phase-completed', callback);
  }

  onChaosEvent(callback) {
    return this._on('baking:chaos-event', callback);
  }

  onTimeUp(callback) {
    return this._on('baking:time-up', callback);
  }

  onTimerTick(callback) {
    return this._on('baking:timer-tick', callback);
  }

  onBakingStarted(callback) {
    return this._on('baking:started', callback);
  }

  // === Lifecycle ===

  setTeamId(teamId) {
    this.teamId = teamId;
  }

  _on(event, callback) {
    if (!this.socket) return () => {};
    this.socket.on(event, callback);
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event).push(callback);
    return () => this.socket.off(event, callback);
  }

  dispose() {
    for (const [event, callbacks] of this._listeners) {
      for (const cb of callbacks) {
        this.socket.off(event, cb);
      }
    }
    this._listeners.clear();
  }
}

window.SocketBridge = SocketBridge;
