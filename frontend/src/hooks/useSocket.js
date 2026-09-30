// hooks/useSocket.js - Socket.io Real-time Event Hook
import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.PROD ? window.location.origin : 'http://localhost:5000');

export function useSocket(roomCode, user = null) {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [members, setMembers] = useState([]);
  const [activeUsersCount, setActiveUsersCount] = useState(1);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!roomCode || roomCode === 'undefined' || roomCode === 'null') {
      setIsConnected(false);
      setMembers([]);
      return;
    }

    const cleanCode = roomCode.toUpperCase().trim();

    const newSocket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    if (newSocket.connected) {
      setIsConnected(true);
      setIsReconnecting(false);
    }

    newSocket.on('connect', () => {
      setIsConnected(true);
      setIsReconnecting(false);

      // Join collaborative room channel
      const userAvatar = user?.avatar || user?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null;
      newSocket.emit('join-room', {
        roomCode: cleanCode,
        user: {
          id: user?.id || `guest-${Math.random().toString(36).substring(2, 7)}`,
          name: user?.name || user?.user_metadata?.user_name || user?.email?.split('@')[0] || 'Anonymous',
          email: user?.email || null,
          avatar: userAvatar,
          role: user?.role || 'member',
        },
      });
    });

    newSocket.on('disconnect', (reason) => {
      setIsConnected(false);
      if (reason === 'io server disconnect') {
        newSocket.connect();
      } else {
        setIsReconnecting(true);
      }
    });

    newSocket.on('reconnect_attempt', () => {
      setIsReconnecting(true);
    });

    newSocket.on('reconnect', () => {
      setIsConnected(true);
      setIsReconnecting(false);
    });

    newSocket.on('room-users', (users) => {
      if (Array.isArray(users)) {
        setMembers(users);
        setActiveUsersCount(users.length);
      }
    });

    newSocket.on('audio-enabled', (data) => {
      setMembers((prev) => {
        return prev.map((m) => {
          if (String(m.id) === String(data.userId) || m.socketId === data.socketId) {
            return {
              ...m,
              isInVoice: true,
              audioEnabled: true,
              isMuted: false,
              rtcUid: data.rtcUid || m.rtcUid,
            };
          }
          return m;
        });
      });
    });

    newSocket.on('audio-disabled', (data) => {
      setMembers((prev) => {
        return prev.map((m) => {
          if (String(m.id) === String(data.userId) || m.socketId === data.socketId) {
            return {
              ...m,
              audioEnabled: false,
              isMuted: true,
              isInVoice: data.leftVoice ? false : (data.isInVoice !== undefined ? data.isInVoice : m.isInVoice),
            };
          }
          return m;
        });
      });
    });

    return () => {
      if (newSocket) {
        newSocket.emit('leave-room', { roomCode: cleanCode });
        newSocket.disconnect();
      }
    };
  }, [roomCode, user?.id, user?.name]);

  const emitEvent = useCallback(
    (eventName, payload) => {
      if (socketRef.current && isConnected) {
        socketRef.current.emit(eventName, { roomCode, ...payload });
      }
    },
    [isConnected, roomCode]
  );

  return {
    socket,
    isConnected,
    isReconnecting,
    members,
    activeUsersCount,
    emitEvent,
  };
}

export default useSocket;
