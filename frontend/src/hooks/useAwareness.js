// hooks/useAwareness.js - Real-time Awareness Hook (Cursors, Presence, and Selections)
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// Palette of distinctive colors for collaborator cursors and badges
export const COLLABORATOR_PALETTE = [
  { name: 'Amber', hex: '#f59e0b', bg: 'rgba(245, 158, 11, 0.25)' },
  { name: 'Emerald', hex: '#10b981', bg: 'rgba(16, 185, 129, 0.25)' },
  { name: 'Blue', hex: '#3b82f6', bg: 'rgba(59, 130, 246, 0.25)' },
  { name: 'Pink', hex: '#ec4899', bg: 'rgba(236, 72, 153, 0.25)' },
  { name: 'Purple', hex: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.25)' },
  { name: 'Cyan', hex: '#06b6d4', bg: 'rgba(6, 182, 212, 0.25)' },
  { name: 'Orange', hex: '#f97316', bg: 'rgba(249, 115, 22, 0.25)' },
  { name: 'Teal', hex: '#14b8a6', bg: 'rgba(20, 184, 166, 0.25)' },
];

export function pickUserColor(seed = '') {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COLLABORATOR_PALETTE.length;
  return COLLABORATOR_PALETTE[index];
}

/**
 * Bounds checking helper for cursor positioning
 */
export const clampCursor = (pos, maxPos = Infinity) => {
  return Math.max(0, Math.min(pos, maxPos));
};

/**
 * useAwareness
 * Manages remote user awareness, cursor coordinates, and selection ranges.
 * Fixes cursor jumping on content deletion, resets cursors on full document clear,
 * and maintains continuous tracking when editing resumes.
 *
 * @param {object} awareness - Yjs Awareness instance
 * @param {object} user - Current user metadata { id, name, email }
 * @param {number} clientID - Current Y.Doc clientID
 * @param {object} yText - Optional shared Y.Text instance to monitor text length & deletions
 */
export function useAwareness(awareness, user, clientID, yText = null) {
  const [connectedUsers, setConnectedUsers] = useState([]);
  const localCursorPosRef = useRef({ line: 1, column: 1, offset: 0 });

  const assignedColor = useMemo(() => {
    const seed = user?.id || user?.name || Math.random().toString();
    return pickUserColor(seed);
  }, [user?.id, user?.name]);

  const userName = useMemo(() => {
    return (
      user?.name ||
      user?.user_metadata?.user_name ||
      user?.user_metadata?.name ||
      user?.email?.split('@')[0] ||
      'Collaborator'
    );
  }, [user?.name, user?.user_metadata, user?.email]);

  // Initialize and synchronize local awareness profile
  useEffect(() => {
    if (!awareness) return;

    awareness.setLocalStateField('user', {
      id: user?.id || `client-${clientID}`,
      clientID: clientID,
      name: userName,
      color: assignedColor.hex,
      colorLight: assignedColor.bg,
    });

    const handleAwarenessChange = () => {
      const states = awareness.getStates();
      const users = [];

      states.forEach((state, cid) => {
        if (state.user) {
          const rawCursor = state.cursor;
          let safeCursor = null;

          if (rawCursor) {
            safeCursor = {
              line: Math.max(1, rawCursor.line || 1),
              column: Math.max(1, rawCursor.column || 1),
              lineNumber: Math.max(1, rawCursor.lineNumber || rawCursor.line || 1),
              offset: clampCursor(rawCursor.offset || 0),
            };
          }

          users.push({
            clientID: cid,
            isLocal: cid === clientID,
            name: state.user.name || 'Collaborator',
            color: state.user.color || '#3b82f6',
            colorLight: state.user.colorLight || 'rgba(59, 130, 246, 0.25)',
            cursor: safeCursor,
            isTyping: Boolean(state.isTyping),
          });
        }
      });

      setConnectedUsers(users);
    };

    awareness.on('change', handleAwarenessChange);
    handleAwarenessChange(); // initial population

    return () => {
      awareness.off('change', handleAwarenessChange);
    };
  }, [awareness, user?.id, userName, assignedColor, clientID]);

  // Monitor Yjs text changes: clamp cursors, handle full clear, and prevent getting stuck
  useEffect(() => {
    if (!yText || !awareness) return;

    const handleTextChange = () => {
      const currentLen = yText.length;

      // When all content is cleared (length drops to 0)
      if (currentLen === 0) {
        localCursorPosRef.current = { line: 1, column: 1, offset: 0 };
        awareness.setLocalStateField('cursor', {
          line: 1,
          column: 1,
          lineNumber: 1,
          offset: 0,
        });
        return;
      }

      // If document has content, ensure local cursor offset doesn't exceed valid bounds
      const current = localCursorPosRef.current;
      if (current.offset > currentLen) {
        current.offset = currentLen;
        awareness.setLocalStateField('cursor', {
          ...current,
          offset: currentLen,
        });
      }
    };

    yText.observe(handleTextChange);
    return () => {
      yText.unobserve(handleTextChange);
    };
  }, [yText, awareness]);

  // Update local cursor position for remote collaborators
  const updateCursor = useCallback(
    ({ line = 1, column = 1, offset = 0 }) => {
      const safeLine = Math.max(1, line);
      const safeCol = Math.max(1, column);
      const safeOffset = Math.max(0, offset);

      localCursorPosRef.current = {
        line: safeLine,
        column: safeCol,
        offset: safeOffset,
      };

      if (awareness) {
        awareness.setLocalStateField('cursor', {
          line: safeLine,
          column: safeCol,
          lineNumber: safeLine,
          offset: safeOffset,
        });
      }
    },
    [awareness]
  );

  // Set local typing indicator
  const setTyping = useCallback(
    (isTyping) => {
      if (awareness) {
        awareness.setLocalStateField('isTyping', Boolean(isTyping));
      }
    },
    [awareness]
  );

  const remoteUsers = useMemo(() => {
    return connectedUsers.filter((u) => !u.isLocal);
  }, [connectedUsers]);

  const localUser = useMemo(() => {
    return connectedUsers.find((u) => u.isLocal) || {
      clientID,
      isLocal: true,
      name: userName,
      color: assignedColor.hex,
      colorLight: assignedColor.bg,
      cursor: null,
    };
  }, [connectedUsers, clientID, userName, assignedColor]);

  return {
    connectedUsers,
    remoteUsers,
    localUser,
    updateCursor,
    setTyping,
    assignedColor,
  };
}

export default useAwareness;
