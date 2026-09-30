// hooks/usePing.js - Real-Time Socket.io Latency & Connection Quality Hook
import { useState, useEffect, useRef } from 'react';

/**
 * usePing
 * Measures live round-trip network latency to the backend server every 500ms.
 *
 * @param {import('socket.io-client').Socket|null} socket - Active Socket.io instance
 * @param {boolean} isConnected - Current socket connection state
 * @returns {{ ping: number, status: string, quality: 'good'|'ok'|'bad' }}
 */
export function usePing(socket, isConnected = false) {
  const [ping, setPing] = useState(0);
  const [status, setStatus] = useState(isConnected ? 'Connected' : 'Connecting');
  const [quality, setQuality] = useState('good'); // 'good' (<100ms) | 'ok' (100-500ms) | 'bad' (>500ms)
  const isPingingRef = useRef(false);

  useEffect(() => {
    if (!socket) {
      setStatus('Connecting');
      return;
    }

    const triggerPing = () => {
      if (!socket.connected || isPingingRef.current) return;

      isPingingRef.current = true;
      const startTime = performance.now();

      // Emit ping with acknowledgement callback
      socket.emit('ping', {}, () => {
        const endTime = performance.now();
        const latency = Math.max(1, Math.round(endTime - startTime));
        isPingingRef.current = false;

        setPing(latency);
        setStatus('Connected');

        // Determine network connection quality
        if (latency < 100) {
          setQuality('good'); // Green
        } else if (latency < 500) {
          setQuality('ok'); // Yellow
        } else {
          setQuality('bad'); // Red
        }
      });
    };

    const onConnect = () => {
      setStatus('Connected');
      triggerPing();
    };

    const onDisconnect = () => {
      setStatus('Disconnected');
      setQuality('bad');
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    if (socket.connected) {
      setStatus('Connected');
      triggerPing();
    }

    // Ping every 500ms to measure live dynamic RTT latency
    const pingInterval = setInterval(triggerPing, 500);

    // Safety timeout check
    const safetyInterval = setInterval(() => {
      if (isPingingRef.current) {
        isPingingRef.current = false;
      }
    }, 2000);

    return () => {
      clearInterval(pingInterval);
      clearInterval(safetyInterval);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [socket]);

  return { ping, status, quality };
}

export default usePing;
