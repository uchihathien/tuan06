import { useState, useEffect, useCallback, useRef } from 'react';
import config from '../config';

export function useSSE(userId) {
  const [notifications, setNotifications] = useState([]);
  const [connected, setConnected] = useState(false);
  const esRef = useRef(null);

  useEffect(() => {
    if (!userId) return;

    const url = `${config.PAYMENT_SERVICE}/notifications/stream?userId=${userId}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => setConnected(true);

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'connected') return;
        setNotifications((prev) => [data, ...prev].slice(0, 20));
      } catch (_) {}
    };

    es.onerror = () => {
      setConnected(false);
    };

    return () => {
      es.close();
      setConnected(false);
    };
  }, [userId]);

  const dismiss = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return { notifications, connected, dismiss };
}
