// hooks/useYjs.js - Yjs Real-Time Collaborative Document Hook
import { useState, useEffect, useMemo, useRef } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

// Palette of colors for remote collaborator cursors
const COLLABORATOR_COLORS = [
  { name: 'Amber', hex: '#f59e0b', bg: 'rgba(245, 158, 11, 0.2)' },
  { name: 'Emerald', hex: '#10b981', bg: 'rgba(16, 185, 129, 0.2)' },
  { name: 'Blue', hex: '#3b82f6', bg: 'rgba(59, 130, 246, 0.2)' },
  { name: 'Pink', hex: '#ec4899', bg: 'rgba(236, 72, 153, 0.2)' },
  { name: 'Purple', hex: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.2)' },
  { name: 'Cyan', hex: '#06b6d4', bg: 'rgba(6, 182, 212, 0.2)' },
  { name: 'Orange', hex: '#f97316', bg: 'rgba(249, 115, 22, 0.2)' },
  { name: 'Teal', hex: '#14b8a6', bg: 'rgba(20, 184, 166, 0.2)' },
];

function pickColor(seed = '') {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COLLABORATOR_COLORS.length;
  return COLLABORATOR_COLORS[index];
}

export function useYjs(roomCode, user = null) {
  const [status, setStatus] = useState('connecting'); // 'connecting' | 'connected' | 'disconnected'
  const [isSynced, setIsSynced] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [lastSaved, setLastSaved] = useState(null);

  // Keep single stable instance of Y.Doc and Y.Text per roomCode lifecycle
  const docRef = useRef(null);
  const yTextRef = useRef(null);
  const providerRef = useRef(null);
  const [yAwareness, setYAwareness] = useState(null);

  if (!docRef.current) {
    docRef.current = new Y.Doc();
    yTextRef.current = docRef.current.getText('monaco');
  }

  const doc = docRef.current;
  const yText = yTextRef.current;

  // Determine WebSocket URL
  const wsUrl = useMemo(() => {
    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      // In production, connect directly to the current host via reverse proxy
      if (import.meta.env.PROD) {
        return `${protocol}//${window.location.host}/yjs`;
      }
      if (import.meta.env.VITE_WS_URL) {
        return window.location.protocol === 'https:'
          ? import.meta.env.VITE_WS_URL.replace(/^ws:/, 'wss:')
          : import.meta.env.VITE_WS_URL;
      }
      if (import.meta.env.VITE_BACKEND_URL) {
        try {
          const parsed = new URL(import.meta.env.VITE_BACKEND_URL);
          const wsProto = (window.location.protocol === 'https:' || parsed.protocol === 'https:') ? 'wss:' : 'ws:';
          return `${wsProto}//${parsed.host}/yjs`;
        } catch (e) {
          console.warn('Could not derive WS URL from VITE_BACKEND_URL:', e);
        }
      }
      return `${protocol}//${window.location.hostname}:5000/yjs`;
    }
    return 'ws://localhost:5000/yjs';
  }, []);

  const assignedColor = useMemo(() => {
    const seed = user?.id || user?.name || Math.random().toString();
    return pickColor(seed);
  }, [user?.id, user?.name]);

  const userName =
    user?.name ||
    user?.user_metadata?.user_name ||
    user?.email?.split('@')[0] ||
    'Collaborator';

  // 1. Manage WebsocketProvider lifecycle strictly per roomCode
  useEffect(() => {
    if (!roomCode) return;

    const cleanCode = roomCode.toUpperCase().trim();
    const currentDoc = docRef.current;
    const currentYText = yTextRef.current;

    // Create single persistent provider instance
    const provider = new WebsocketProvider(wsUrl, cleanCode, currentDoc, {
      connect: true,
      maxBackoffTime: 5000,
    });
    providerRef.current = provider;
    setYAwareness(provider.awareness);

    const awareness = provider.awareness;

    // Set initial awareness
    const shouldUseInitials = Boolean(user?.use_initials || user?.user_metadata?.use_initials);
    const userAvatar = shouldUseInitials
      ? null
      : (user?.avatar || user?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null);
    awareness.setLocalStateField('user', {
      name: userName,
      color: assignedColor.hex,
      colorLight: assignedColor.bg,
      id: user?.id || `client-${currentDoc.clientID}`,
      clientID: currentDoc.clientID,
      avatar: userAvatar,
    });

    if (provider.wsconnected || provider.synced) {
      setStatus('connected');
      if (provider.synced) {
        setIsSynced(true);
      }
    }

    const handleStatus = (event) => {
      const nextStatus = event?.status || (provider.wsconnected ? 'connected' : 'connecting');
      setStatus(nextStatus);
    };
    provider.on('status', handleStatus);

    const handleSync = (synced) => {
      setIsSynced(synced);
      if (synced) {
        setStatus('connected');
        setLastSaved(Date.now());
      }
    };
    provider.on('sync', handleSync);

    // Awareness change listener with user deduplication
    const handleAwarenessChange = () => {
      const states = awareness.getStates();
      const usersByUniqueUser = new Map();

      states.forEach((state, clientID) => {
        if (state.user) {
          const userKey = (state.user.id || state.user.name || '').trim().toLowerCase() || String(clientID);
          const isLocal = clientID === currentDoc.clientID;

          let safeCursor = null;
          if (state.cursor) {
            const line = Math.max(1, state.cursor.line || state.cursor.lineNumber || 1);
            const column = Math.max(1, state.cursor.column || 1);
            safeCursor = { line, lineNumber: line, column };
          }

          usersByUniqueUser.set(userKey, {
            clientID,
            isLocal,
            id: state.user.id || `client-${clientID}`,
            name: state.user.name || 'Anonymous',
            color: state.user.color || '#3b82f6',
            colorLight: state.user.colorLight || 'rgba(59, 130, 246, 0.2)',
            avatar: state.user.avatar || null,
            cursor: safeCursor,
            voice: state.voice || state.audio || null,
            isTyping: Boolean(state.isTyping),
          });
        }
      });

      setConnectedUsers(Array.from(usersByUniqueUser.values()));
    };
    awareness.on('change', handleAwarenessChange);

    const handleDocUpdate = () => {
      try {
        const text = currentYText.toString();
        if (text) {
          localStorage.setItem(`codeo_backup_${cleanCode}`, text);
        }
      } catch {
        // Ignored
      }
    };
    currentDoc.on('update', handleDocUpdate);

    return () => {
      currentDoc.off('update', handleDocUpdate);
      awareness.off('change', handleAwarenessChange);
      provider.off('status', handleStatus);
      provider.off('sync', handleSync);

      // Cleanly clear awareness state so peers remove cursor immediately
      try {
        awareness.setLocalState(null);
      } catch {
        // Ignored
      }

      provider.disconnect();
      provider.destroy();
      providerRef.current = null;
      setYAwareness(null);
    };
  }, [roomCode, wsUrl]);

  // 2. Dynamically update awareness when user info or color changes without reconnecting provider
  useEffect(() => {
    if (providerRef.current && providerRef.current.awareness && docRef.current) {
      const shouldUseInitials = Boolean(user?.use_initials || user?.user_metadata?.use_initials);
      const userAvatar = shouldUseInitials
        ? null
        : (user?.avatar || user?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null);
      providerRef.current.awareness.setLocalStateField('user', {
        name: userName,
        color: assignedColor.hex,
        colorLight: assignedColor.bg,
        id: user?.id || `client-${docRef.current.clientID}`,
        clientID: docRef.current.clientID,
        avatar: userAvatar,
      });
    }
  }, [userName, assignedColor, user?.id, user?.avatar, user?.avatar_url, user?.user_metadata?.avatar_url, user?.user_metadata?.picture, user?.user_metadata?.use_initials, user?.use_initials]);

  return {
    doc,
    provider: providerRef.current,
    yText,
    yAwareness: yAwareness || providerRef.current?.awareness || null,
    status,
    isSynced,
    connectedUsers,
    lastSaved,
    localColor: assignedColor,
  };
}

export default useYjs;
