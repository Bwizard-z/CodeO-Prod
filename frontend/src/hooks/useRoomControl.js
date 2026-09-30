// hooks/useRoomControl.js - Hook for Room Host Controls & Moderation
import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';

export function useRoomControl({
  roomId = null,
  roomCode = null,
  currentUser = null,
  isHost = false,
  socket = null,
  initialIsLocked = false,
}) {
  const [isLocked, setIsLocked] = useState(Boolean(initialIsLocked));
  const [canEdit, setCanEdit] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isKicked, setIsKicked] = useState(false);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState({});
  const [error, setError] = useState(null);

  const targetIdentifier = roomId || roomCode;
  const currentUserId = currentUser?.id;
  const isMountedRef = useRef(true);

  // Sync initialIsLocked if it changes
  useEffect(() => {
    if (initialIsLocked !== undefined && initialIsLocked !== null) {
      setIsLocked(Boolean(initialIsLocked));
    }
  }, [initialIsLocked]);

  /**
   * Fetch room members and their permission states from backend
   */
  const fetchMembers = useCallback(async () => {
    if (!targetIdentifier) return;
    try {
      setLoading(true);
      const res = await api.getRoomMembers(targetIdentifier);
      if (res?.success && isMountedRef.current) {
        setMembers(res.members || []);
        if (res.isLocked !== undefined) {
          setIsLocked(Boolean(res.isLocked));
        }

        // Check if current user has restrictions
        if (currentUserId) {
          const myRecord = (res.members || []).find(
            (m) => String(m.userId) === String(currentUserId) || String(m.id) === String(currentUserId)
          );
          if (myRecord) {
            setCanEdit(myRecord.canEdit !== false);
            setIsMuted(Boolean(myRecord.isMuted));
          }
        }
      }
    } catch (err) {
      console.warn('[useRoomControl] Error fetching members:', err.message);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [targetIdentifier, currentUserId]);

  // Initial fetch on mount or room change
  useEffect(() => {
    isMountedRef.current = true;
    fetchMembers();
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchMembers]);

  /**
   * Lock room (makes room read-only)
   */
  const lockRoom = useCallback(async () => {
    if (!targetIdentifier) return false;
    setActionLoading((prev) => ({ ...prev, lock: true }));
    setError(null);
    try {
      const res = await api.lockRoom(targetIdentifier);
      if (isMountedRef.current) {
        setIsLocked(true);
      }
      return true;
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to lock room.';
      if (isMountedRef.current) setError(msg);
      // Fallback: emit direct socket event
      if (socket && roomCode) {
        socket.emit('host-lock-room', { roomCode });
      }
      return false;
    } finally {
      if (isMountedRef.current) {
        setActionLoading((prev) => ({ ...prev, lock: false }));
      }
    }
  }, [targetIdentifier, socket, roomCode]);

  /**
   * Unlock room
   */
  const unlockRoom = useCallback(async () => {
    if (!targetIdentifier) return false;
    setActionLoading((prev) => ({ ...prev, lock: true }));
    setError(null);
    try {
      const res = await api.unlockRoom(targetIdentifier);
      if (isMountedRef.current) {
        setIsLocked(false);
      }
      return true;
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to unlock room.';
      if (isMountedRef.current) setError(msg);
      // Fallback: emit direct socket event
      if (socket && roomCode) {
        socket.emit('host-unlock-room', { roomCode });
      }
      return false;
    } finally {
      if (isMountedRef.current) {
        setActionLoading((prev) => ({ ...prev, lock: false }));
      }
    }
  }, [targetIdentifier, socket, roomCode]);

  /**
   * Toggle room lock
   */
  const toggleLock = useCallback(async () => {
    if (isLocked) {
      return await unlockRoom();
    } else {
      return await lockRoom();
    }
  }, [isLocked, lockRoom, unlockRoom]);

  /**
   * Mute user
   */
  const muteUser = useCallback(async (memberId) => {
    if (!targetIdentifier || !memberId) return false;
    const actionKey = `mute_${memberId}`;
    setActionLoading((prev) => ({ ...prev, [actionKey]: true }));
    setError(null);
    try {
      await api.muteMember(targetIdentifier, memberId);
      setMembers((prev) =>
        prev.map((m) =>
          String(m.id) === String(memberId) || String(m.userId) === String(memberId)
            ? { ...m, isMuted: true }
            : m
        )
      );
      return true;
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to mute member.';
      if (isMountedRef.current) setError(msg);
      if (socket && roomCode) {
        socket.emit('host-mute-user', { roomCode, targetUserId: memberId });
      }
      return false;
    } finally {
      if (isMountedRef.current) {
        setActionLoading((prev) => ({ ...prev, [actionKey]: false }));
      }
    }
  }, [targetIdentifier, socket, roomCode]);

  /**
   * Unmute user
   */
  const unmuteUser = useCallback(async (memberId) => {
    if (!targetIdentifier || !memberId) return false;
    const actionKey = `mute_${memberId}`;
    setActionLoading((prev) => ({ ...prev, [actionKey]: true }));
    setError(null);
    try {
      await api.unmuteMember(targetIdentifier, memberId);
      setMembers((prev) =>
        prev.map((m) =>
          String(m.id) === String(memberId) || String(m.userId) === String(memberId)
            ? { ...m, isMuted: false }
            : m
        )
      );
      return true;
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to unmute member.';
      if (isMountedRef.current) setError(msg);
      return false;
    } finally {
      if (isMountedRef.current) {
        setActionLoading((prev) => ({ ...prev, [actionKey]: false }));
      }
    }
  }, [targetIdentifier]);

  /**
   * Disable editor for a specific member
   */
  const disableEditor = useCallback(async (memberId) => {
    if (!targetIdentifier || !memberId) return false;
    const actionKey = `edit_${memberId}`;
    setActionLoading((prev) => ({ ...prev, [actionKey]: true }));
    setError(null);

    const tid = String(memberId).trim().toLowerCase();

    // Instant local state update so the UI immediately flips icon and status
    setMembers((prev) => {
      let found = false;
      const updated = prev.map((m) => {
        const mId = String(m.id || '').trim().toLowerCase();
        const mUid = String(m.userId || '').trim().toLowerCase();
        const mName = String(m.name || '').trim().toLowerCase();
        if (
          (mId && mId === tid) ||
          (mUid && mUid === tid) ||
          (mName && mName === tid) ||
          (mName && tid === `guest-${mName.replace(/[^a-z0-9]/g, '')}`) ||
          (mId && tid === `guest-${mName.replace(/[^a-z0-9]/g, '')}`)
        ) {
          found = true;
          return { ...m, canEdit: false };
        }
        return m;
      });
      // If member not found in controlMembers, add a new entry so displayMembers picks it up
      if (!found) {
        updated.push({ id: memberId, userId: memberId, name: memberId, canEdit: false });
      }
      return updated;
    });

    // Real-time socket broadcast
    if (socket && roomCode) {
      socket.emit('host-disable-editor', { roomCode, targetUserId: memberId });
    }

    // Persist to DB via REST API
    try {
      await api.disableMemberEditor(targetIdentifier, memberId);
    } catch (err) {
      console.warn('[disableEditor] Note:', err.message);
    } finally {
      if (isMountedRef.current) {
        setActionLoading((prev) => ({ ...prev, [actionKey]: false }));
      }
    }
    return true;
  }, [targetIdentifier, socket, roomCode]);

  /**
   * Enable editor for a specific member
   */
  const enableEditor = useCallback(async (memberId) => {
    if (!targetIdentifier || !memberId) return false;
    const actionKey = `edit_${memberId}`;
    setActionLoading((prev) => ({ ...prev, [actionKey]: true }));
    setError(null);

    const tid = String(memberId).trim().toLowerCase();

    // Instant local state update so the UI immediately flips icon and status
    setMembers((prev) => {
      let found = false;
      const updated = prev.map((m) => {
        const mId = String(m.id || '').trim().toLowerCase();
        const mUid = String(m.userId || '').trim().toLowerCase();
        const mName = String(m.name || '').trim().toLowerCase();
        if (
          (mId && mId === tid) ||
          (mUid && mUid === tid) ||
          (mName && mName === tid) ||
          (mName && tid === `guest-${mName.replace(/[^a-z0-9]/g, '')}`) ||
          (mId && tid === `guest-${mName.replace(/[^a-z0-9]/g, '')}`)
        ) {
          found = true;
          return { ...m, canEdit: true };
        }
        return m;
      });
      // If member not found in controlMembers, add a new entry so displayMembers picks it up
      if (!found) {
        updated.push({ id: memberId, userId: memberId, name: memberId, canEdit: true });
      }
      return updated;
    });

    // Real-time socket broadcast
    if (socket && roomCode) {
      socket.emit('host-enable-editor', { roomCode, targetUserId: memberId });
    }

    // Persist to DB via REST API
    try {
      await api.enableMemberEditor(targetIdentifier, memberId);
    } catch (err) {
      console.warn('[enableEditor] Note:', err.message);
    } finally {
      if (isMountedRef.current) {
        setActionLoading((prev) => ({ ...prev, [actionKey]: false }));
      }
    }
    return true;
  }, [targetIdentifier, socket, roomCode]);

  /**
   * Kick member from room
   */
  const kickUser = useCallback(async (memberId) => {
    if (!targetIdentifier || !memberId) return false;
    const actionKey = `kick_${memberId}`;
    setActionLoading((prev) => ({ ...prev, [actionKey]: true }));
    setError(null);
    try {
      await api.kickMember(targetIdentifier, memberId);
      setMembers((prev) =>
        prev.filter((m) => String(m.id) !== String(memberId) && String(m.userId) !== String(memberId))
      );
      return true;
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to kick member.';
      if (isMountedRef.current) setError(msg);
      if (socket && roomCode) {
        socket.emit('host-kick-user', { roomCode, targetUserId: memberId });
      }
      return false;
    } finally {
      if (isMountedRef.current) {
        setActionLoading((prev) => ({ ...prev, [actionKey]: false }));
      }
    }
  }, [targetIdentifier, socket, roomCode]);

  /**
   * Register Socket.io real-time moderation events
   */
  useEffect(() => {
    if (!socket) return;

    const handleRoomLocked = () => {
      setIsLocked(true);
    };

    const handleRoomUnlocked = () => {
      setIsLocked(false);
    };

    const handleEditorDisabled = (data) => {
      const tid = String(data?.targetUserId || data?.memberId || '').trim().toLowerCase();
      const myId = String(currentUserId || '').trim().toLowerCase();
      const myName = String(currentUser?.name || currentUser?.user_metadata?.user_name || '').trim().toLowerCase();

      const isTarget =
        (myId && (tid === myId || tid === `guest-${myId.replace(/[^a-z0-9]/g, '')}`)) ||
        (myName && (tid === myName || tid === `guest-${myName.replace(/[^a-z0-9]/g, '')}`));

      if (isTarget) {
        setCanEdit(false);
      }

      setMembers((prev) => {
        let found = false;
        const updated = prev.map((m) => {
          const mId = String(m.id || '').trim().toLowerCase();
          const mUid = String(m.userId || '').trim().toLowerCase();
          const mName = String(m.name || '').trim().toLowerCase();
          if (
            (mId && mId === tid) ||
            (mUid && mUid === tid) ||
            (mName && mName === tid) ||
            (mName && tid === `guest-${mName.replace(/[^a-z0-9]/g, '')}`) ||
            (mId && mId.startsWith('guest-') && mName && tid === mName)
          ) {
            found = true;
            return { ...m, canEdit: false };
          }
          return m;
        });
        if (!found) {
          updated.push({ id: tid, userId: tid, canEdit: false });
        }
        return updated;
      });
    };

    const handleEditorEnabled = (data) => {
      const tid = String(data?.targetUserId || data?.memberId || '').trim().toLowerCase();
      const myId = String(currentUserId || '').trim().toLowerCase();
      const myName = String(currentUser?.name || currentUser?.user_metadata?.user_name || '').trim().toLowerCase();

      const isTarget =
        (myId && (tid === myId || tid === `guest-${myId.replace(/[^a-z0-9]/g, '')}`)) ||
        (myName && (tid === myName || tid === `guest-${myName.replace(/[^a-z0-9]/g, '')}`));

      if (isTarget) {
        setCanEdit(true);
      }

      setMembers((prev) => {
        let found = false;
        const updated = prev.map((m) => {
          const mId = String(m.id || '').trim().toLowerCase();
          const mUid = String(m.userId || '').trim().toLowerCase();
          const mName = String(m.name || '').trim().toLowerCase();
          if (
            (mId && mId === tid) ||
            (mUid && mUid === tid) ||
            (mName && mName === tid) ||
            (mName && tid === `guest-${mName.replace(/[^a-z0-9]/g, '')}`) ||
            (mId && mId.startsWith('guest-') && mName && tid === mName)
          ) {
            found = true;
            return { ...m, canEdit: true };
          }
          return m;
        });
        if (!found) {
          updated.push({ id: tid, userId: tid, canEdit: true });
        }
        return updated;
      });
    };

    const handleUserMuted = (data) => {
      const isTarget =
        String(data?.targetUserId) === String(currentUserId) ||
        String(data?.memberId) === String(currentUserId);

      if (isTarget) {
        setIsMuted(true);
      }

      setMembers((prev) =>
        prev.map((m) =>
          String(m.id) === String(data?.memberId) ||
          String(m.userId) === String(data?.targetUserId)
            ? { ...m, isMuted: true }
            : m
        )
      );
    };

    const handleUserUnmuted = (data) => {
      const isTarget =
        String(data?.targetUserId) === String(currentUserId) ||
        String(data?.memberId) === String(currentUserId);

      if (isTarget) {
        setIsMuted(false);
      }

      setMembers((prev) =>
        prev.map((m) =>
          String(m.id) === String(data?.memberId) ||
          String(m.userId) === String(data?.targetUserId)
            ? { ...m, isMuted: false }
            : m
        )
      );
    };

    const handleUserKicked = (data) => {
      const isTarget =
        String(data?.targetUserId) === String(currentUserId) ||
        String(data?.memberId) === String(currentUserId);

      if (isTarget) {
        setIsKicked(true);
        setCanEdit(false);
      }

      setMembers((prev) =>
        prev.filter(
          (m) =>
            String(m.id) !== String(data?.memberId) &&
            String(m.userId) !== String(data?.targetUserId)
        )
      );
    };

    socket.on('room-locked', handleRoomLocked);
    socket.on('room-unlocked', handleRoomUnlocked);
    socket.on('editor-disabled', handleEditorDisabled);
    socket.on('editor-enabled', handleEditorEnabled);
    socket.on('user-muted', handleUserMuted);
    socket.on('user-unmuted', handleUserUnmuted);
    socket.on('user-kicked', handleUserKicked);

    return () => {
      socket.off('room-locked', handleRoomLocked);
      socket.off('room-unlocked', handleRoomUnlocked);
      socket.off('editor-disabled', handleEditorDisabled);
      socket.off('editor-enabled', handleEditorEnabled);
      socket.off('user-muted', handleUserMuted);
      socket.off('user-unmuted', handleUserUnmuted);
      socket.off('user-kicked', handleUserKicked);
    };
  }, [socket, currentUserId]);

  return {
    isLocked,
    canEdit: canEdit && !isLocked && !isKicked,
    rawCanEdit: canEdit,
    isMuted,
    isKicked,
    members,
    loading,
    actionLoading,
    error,
    setError,
    lockRoom,
    unlockRoom,
    toggleLock,
    muteUser,
    unmuteUser,
    disableEditor,
    enableEditor,
    kickUser,
    fetchMembers,
  };
}

export default useRoomControl;
