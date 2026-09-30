// hooks/useRoom.js - CODEO Room Management Hook
import { useState, useCallback, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from './useAuth';

export function useRoom(autoFetch = false) {
  const { isAuthenticated, isEmailVerified } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [count, setCount] = useState(0);
  const [limit, setLimit] = useState(10);
  const [remaining, setRemaining] = useState(10);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);

  // Helper to extract clean error message
  const extractError = (err, fallback = 'Operation failed.') => {
    if (!err) return fallback;
    if (err.response?.data?.error) return err.response.data.error;
    if (err.response?.data?.message) return err.response.data.message;
    return err.message || fallback;
  };

  /**
   * Fetch user's active rooms and room quota limits
   */
  const getUserRooms = useCallback(async () => {
    if (!isAuthenticated) return { success: false, error: 'Not authenticated' };

    try {
      setLoading(true);
      setError(null);
      const res = await api.getUserRooms();

      if (res.success) {
        const fetchedRooms = res.rooms || [];
        setRooms(fetchedRooms);
        setCount(res.count ?? fetchedRooms.length);
        setLimit(res.limit ?? 10);
        setRemaining(res.remaining ?? Math.max(0, 10 - fetchedRooms.length));
        return {
          success: true,
          rooms: fetchedRooms,
          count: res.count,
          limit: res.limit,
          remaining: res.remaining,
        };
      } else {
        throw new Error(res.error || 'Failed to fetch rooms');
      }
    } catch (err) {
      const msg = extractError(err, 'Could not load your rooms.');
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (autoFetch && isAuthenticated) {
      getUserRooms();
    }
  }, [autoFetch, isAuthenticated, getUserRooms]);

  /**
   * Create a new collaborative room
   */
  const createRoom = async ({ title, description = '', language = 'javascript' }) => {
    try {
      setActionLoading(true);
      setError(null);

      const res = await api.createRoom({
        title: (title || '').trim(),
        description: (description || '').trim(),
        language: (language || 'javascript').toLowerCase(),
      });

      if (res.success && res.room) {
        // Refresh room list
        await getUserRooms();
        return { success: true, room: res.room, code: res.code || res.room.code };
      } else {
        throw new Error(res.error || 'Failed to create room.');
      }
    } catch (err) {
      const msg = extractError(err, 'Failed to create room.');
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Join an existing room using 6-character room code or invite token
   */
  const joinRoom = async (code) => {
    try {
      setActionLoading(true);
      setError(null);

      const cleanCode = (code || '').trim().toUpperCase();
      if (!cleanCode) {
        throw new Error('Please enter a valid room code.');
      }

      const res = await api.joinRoom(cleanCode);

      if (res.success && res.room) {
        await getUserRooms();
        return { success: true, room: res.room, code: res.room.code };
      } else {
        throw new Error(res.error || 'Room not found.');
      }
    } catch (err) {
      const msg = extractError(err, 'Room not found or could not be joined.');
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Leave a room
   */
  const leaveRoom = async (idOrCode) => {
    try {
      setActionLoading(true);
      setError(null);

      const res = await api.leaveRoom(idOrCode);
      if (res.success) {
        await getUserRooms();
        return { success: true, message: res.message };
      } else {
        throw new Error(res.error || 'Failed to leave room.');
      }
    } catch (err) {
      const msg = extractError(err, 'Failed to leave room.');
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Delete a room (Host only)
   */
  const deleteRoom = async (idOrCode) => {
    try {
      setActionLoading(true);
      setError(null);

      const res = await api.deleteRoom(idOrCode);
      if (res.success) {
        await getUserRooms();
        return { success: true, message: res.message };
      } else {
        throw new Error(res.error || 'Failed to delete room.');
      }
    } catch (err) {
      const msg = extractError(err, 'Failed to delete room.');
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setActionLoading(false);
    }
  };

  return {
    rooms,
    count,
    limit,
    remaining,
    loading,
    actionLoading,
    error,
    getUserRooms,
    createRoom,
    joinRoom,
    leaveRoom,
    deleteRoom,
    refreshRooms: getUserRooms,
  };
}

export default useRoom;
