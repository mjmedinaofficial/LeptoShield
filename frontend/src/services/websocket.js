export function websocketUrl() {
  const configured = import.meta.env.VITE_WS_URL;
  if (configured) return configured;
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.host}/ws`;
}

/**
 * Live state connection with exponential reconnect. Falls back silently to
 * periodic REST polling when the socket cannot be established.
 */
export function connectLive({ onState, onStatus, onEvent } = {}) {
  let socket = null;
  let closed = false;
  let attempts = 0;
  let pingTimer = null;
  let retryTimer = null;

  const clearTimers = () => {
    if (pingTimer) window.clearInterval(pingTimer);
    if (retryTimer) window.clearTimeout(retryTimer);
    pingTimer = null;
    retryTimer = null;
  };

  const open = () => {
    if (closed) return;
    onStatus?.('connecting');
    try {
      socket = new WebSocket(websocketUrl());
    } catch {
      onStatus?.('offline');
      scheduleRetry();
      return;
    }

    socket.onopen = () => {
      attempts = 0;
      onStatus?.('live');
      pingTimer = window.setInterval(() => {
        try {
          if (socket?.readyState === WebSocket.OPEN) socket.send('ping');
        } catch {
          /* ignore */
        }
      }, 25000);
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'state') {
          onState?.(message.data, message.event ?? null);
          if (message.event) onEvent?.(message.event);
        } else if (message.type === 'hello') {
          onState?.(message.data, null);
        }
      } catch {
        /* ignore malformed frames */
      }
    };

    socket.onclose = () => {
      if (pingTimer) window.clearInterval(pingTimer);
      pingTimer = null;
      if (closed) return;
      onStatus?.('reconnecting');
      scheduleRetry();
    };

    socket.onerror = () => {
      try {
        socket?.close();
      } catch {
        /* ignore */
      }
    };
  };

  const scheduleRetry = () => {
    attempts += 1;
    const delay = Math.min(15000, 700 * 2 ** Math.min(attempts, 5));
    retryTimer = window.setTimeout(open, delay);
  };

  open();

  return {
    close() {
      closed = true;
      clearTimers();
      try {
        socket?.close();
      } catch {
        /* ignore */
      }
    },
  };
}
