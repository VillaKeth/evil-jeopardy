function createSocket() {
  const socket = io({
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
  });

  const statusEl = document.getElementById('connection-status');

  socket.on('connect', () => {
    if (statusEl) statusEl.className = 'connection-dot connected';
    console.log('Connected:', socket.id);
  });

  socket.on('disconnect', () => {
    if (statusEl) statusEl.className = 'connection-dot disconnected';
    console.log('Disconnected');
  });

  socket.on('reconnect_attempt', (attempt) => {
    if (statusEl) statusEl.className = 'connection-dot reconnecting';
    console.log('Reconnecting...', attempt);
  });

  return socket;
}
