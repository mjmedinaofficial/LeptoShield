import { useCallback, useEffect, useRef, useState } from 'react';

import { getQueue } from '../services/api';
import { connectLive } from '../services/websocket';

/**
 * One live clinic snapshot shared by a view: WebSocket pushes first, REST
 * polling as a safety net, and a manual refresh for after mutations.
 */
export function useLiveQueue({ pollMs = 15000 } = {}) {
  const [snapshot, setSnapshot] = useState(null);
  const [status, setStatus] = useState('connecting');
  const [lastEvent, setLastEvent] = useState(null);
  const [error, setError] = useState(null);
  const [refreshedAt, setRefreshedAt] = useState(null);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const data = await getQueue();
      if (!mounted.current) return data;
      setSnapshot(data);
      setError(null);
      setRefreshedAt(Date.now());
      return data;
    } catch (requestError) {
      if (mounted.current) {
        setError(requestError.friendlyMessage || 'Cannot reach the clinic server.');
      }
      return null;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    refresh();
    const connection = connectLive({
      onStatus: (next) => {
        if (mounted.current) setStatus(next);
      },
      onState: (data, event) => {
        if (!mounted.current) return;
        setSnapshot(data);
        setError(null);
        setRefreshedAt(Date.now());
        if (event) setLastEvent(event);
      },
      onEvent: (event) => {
        if (mounted.current) setLastEvent(event);
      },
    });
    const timer = window.setInterval(refresh, pollMs);
    return () => {
      mounted.current = false;
      connection.close();
      window.clearInterval(timer);
    };
  }, [pollMs, refresh]);

  return { snapshot, status, lastEvent, error, refresh, refreshedAt, setSnapshot };
}
