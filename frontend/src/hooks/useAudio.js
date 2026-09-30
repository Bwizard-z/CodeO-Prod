// hooks/useAudio.js - Ultra-low latency Agora RTC Audio Hook (<100ms)
import { useState, useEffect, useRef, useCallback } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import api from '../services/api';

// Set Agora Web SDK log level to warning in production/dev
AgoraRTC.setLogLevel(2);

// Generate deterministic integer UID within Agora safe 32-bit positive integer range
export function generateNumericUid(userId) {
  if (typeof userId === 'number' && Number.isInteger(userId) && userId > 0 && userId <= 4294967295) {
    return userId;
  }
  const str = String(userId || '');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % 900000) + 100000;
}

export function useAudio({ roomCode, userId, userName = 'Collaborator', socket = null, autoJoin = false }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [activeSpeakers, setActiveSpeakers] = useState([]);
  const [localVolume, setLocalVolume] = useState(0);
  const [networkQuality, setNetworkQuality] = useState({ uplink: 1, downlink: 1 });
  const [error, setError] = useState(null);

  const clientRef = useRef(null);
  const localAudioTrackRef = useRef(null);
  const joinedRoomRef = useRef(null);
  const isMountedRef = useRef(true);
  const localRtcUidRef = useRef(null);
  const uidMapRef = useRef(new Map());

  /**
   * Leave current audio channel and release audio hardware
   */
  const leaveCall = useCallback(async () => {
    try {
      if (localAudioTrackRef.current) {
        localAudioTrackRef.current.stop();
        localAudioTrackRef.current.close();
        localAudioTrackRef.current = null;
      }

      if (clientRef.current) {
        // Remove all listeners
        clientRef.current.removeAllListeners();
        await clientRef.current.leave();
        clientRef.current = null;
      }

      if (socket && joinedRoomRef.current) {
        socket.emit('audio-disabled', {
          roomCode: joinedRoomRef.current,
          userId,
          leftVoice: true,
          isInVoice: false,
        });
      }
    } catch (err) {
      console.warn('[useAudio] Error leaving audio call:', err);
    } finally {
      if (isMountedRef.current) {
        setIsConnected(false);
        setIsConnecting(false);
        setRemoteUsers([]);
        setActiveSpeakers([]);
        setLocalVolume(0);
      }
      joinedRoomRef.current = null;
    }
  }, [socket, userId]);

  /**
   * Join Agora RTC Audio channel with ultra-low latency profile
   */
  const joinCall = useCallback(async (customRoomCode = null, customUserId = null, role = 'publisher') => {
    const targetRoomCode = (customRoomCode || roomCode || '').toUpperCase().trim();
    const targetUserId = customUserId || userId;

    if (!targetRoomCode) {
      setError('Room code is required to start audio call.');
      return false;
    }

    if (!targetUserId) {
      setError('User identifier is required.');
      return false;
    }

    if (isConnected || isConnecting) {
      return true;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // 1. Generate deterministic integer UID within Agora safe 32-bit positive integer range
      const numericUid = generateNumericUid(targetUserId);
      localRtcUidRef.current = numericUid;

      // 2. Fetch Agora RTC token from backend API
      const tokenRes = await api.getAgoraToken({
        roomCode: targetRoomCode,
        userId: String(targetUserId),
        uid: numericUid,
        role,
      });

      if (!tokenRes?.token || !tokenRes?.appId) {
        throw new Error(tokenRes?.error || 'Agora token generation failed on server.');
      }

      const { token, appId, channelName } = tokenRes;

      // 2. Initialize Agora RTC Client optimized for interactive voice (<100ms latency)
      const client = AgoraRTC.createClient({
        mode: 'rtc',
        codec: 'vp8',
      });
      clientRef.current = client;

      // Enable volume indicator for active speaker detection (reports every 200ms)
      client.enableAudioVolumeIndicator();

      // 3. Register RTC Remote User Event Listeners
      client.on('user-published', async (user, mediaType) => {
        try {
          await client.subscribe(user, mediaType);
          if (mediaType === 'audio') {
            user.audioTrack?.play();

            if (isMountedRef.current) {
              setRemoteUsers((prev) => {
                const exists = prev.find((u) => String(u.uid) === String(user.uid));
                if (exists) {
                  return prev.map((u) =>
                    String(u.uid) === String(user.uid)
                      ? { ...u, audioTrack: user.audioTrack, hasAudio: true }
                      : u
                  );
                }
                return [
                  ...prev,
                  {
                    uid: user.uid,
                    audioTrack: user.audioTrack,
                    hasAudio: true,
                    volume: 0,
                    isSpeaking: false,
                  },
                ];
              });
            }
          }
        } catch (subErr) {
          console.warn('[useAudio] Failed to subscribe to user:', subErr);
        }
      });

      client.on('user-unpublished', (user, mediaType) => {
        if (mediaType === 'audio') {
          user.audioTrack?.stop();
          if (isMountedRef.current) {
            setRemoteUsers((prev) =>
              prev.map((u) =>
                String(u.uid) === String(user.uid)
                  ? { ...u, hasAudio: false, isSpeaking: false }
                  : u
              )
            );
          }
        }
      });

      client.on('user-left', (user) => {
        if (isMountedRef.current) {
          setRemoteUsers((prev) => prev.filter((u) => String(u.uid) !== String(user.uid)));
          setActiveSpeakers((prev) => prev.filter((uid) => String(uid) !== String(user.uid)));
        }
      });

      // Volume indicator for active speakers
      client.on('volume-indicator', (volumes) => {
        if (!isMountedRef.current) return;

        const speakingUids = [];
        volumes.forEach((vol) => {
          const uidStr = String(vol.uid);
          const isLocal =
            vol.uid === 0 ||
            vol.uid === localRtcUidRef.current ||
            uidStr === String(localRtcUidRef.current) ||
            uidStr === String(targetUserId);

          if (isLocal) {
            setLocalVolume(vol.level > 5 ? vol.level : 0);
            if (vol.level > 15) {
              speakingUids.push('You');
              speakingUids.push(String(targetUserId));
              if (localRtcUidRef.current) speakingUids.push(String(localRtcUidRef.current));
              if (userName) speakingUids.push(userName);
            }
          } else if (vol.level > 15) {
            const mapped = uidMapRef.current.get(uidStr);
            if (mapped?.name) {
              speakingUids.push(mapped.name);
            }
            speakingUids.push(uidStr);
            if (mapped?.userId) speakingUids.push(mapped.userId);
          }
        });

        setActiveSpeakers(speakingUids);
      });

      // Network quality indicator
      client.on('network-quality', (stats) => {
        if (isMountedRef.current) {
          setNetworkQuality({
            uplink: stats.uplinkNetworkQuality || 1,
            downlink: stats.downlinkNetworkQuality || 1,
          });
        }
      });

      // Connection state changes
      client.on('connection-state-change', (curState, revState) => {
        if (curState === 'DISCONNECTED') {
          if (isMountedRef.current && isConnected) {
            setIsConnected(false);
          }
        }
      });

      // 4. Request microphone permission & create audio track
      // Enabled with noise suppression, echo cancellation, and auto gain
      let localTrack;
      try {
        localTrack = await AgoraRTC.createMicrophoneAudioTrack({
          encoderConfig: 'speech_standard',
          AEC: true, // Acoustic Echo Cancellation
          ANS: true, // Automatic Noise Suppression
          AGC: true, // Automatic Gain Control
        });
        localAudioTrackRef.current = localTrack;
      } catch (micErr) {
        if (
          micErr.name === 'NotAllowedError' ||
          micErr.name === 'PermissionDeniedError' ||
          micErr.message?.toLowerCase().includes('permission')
        ) {
          throw new Error('Microphone permission denied');
        }
        throw new Error(`Microphone initialization failed: ${micErr.message}`);
      }

      // 5. Join Agora Channel with dynamic token and numeric UID
      const joinRes = await client.join(appId, channelName, token, numericUid);
      const joinedRtcUid = (joinRes !== undefined && joinRes !== null) ? joinRes : numericUid;
      localRtcUidRef.current = joinedRtcUid;
      await client.publish([localTrack]);

      joinedRoomRef.current = targetRoomCode;

      if (isMountedRef.current) {
        setIsConnected(true);
        setIsConnecting(false);
        setIsMuted(false);
        setError(null);
      }

      // Notify Socket.io room peers
      if (socket) {
        socket.emit('audio-enabled', {
          roomCode: targetRoomCode,
          userId: targetUserId,
          rtcUid: joinedRtcUid,
        });
      }

      return true;
    } catch (err) {
      console.error('[useAudio] Join call error:', err);
      const friendlyMsg = err.message?.includes('Microphone permission denied')
        ? 'Microphone permission denied'
        : `Agora connection failed: ${err.message || 'Unknown error'}`;

      if (isMountedRef.current) {
        setError(friendlyMsg);
        setIsConnecting(false);
        setIsConnected(false);
      }

      await leaveCall();
      return false;
    }
  }, [roomCode, userId, userName, isConnected, isConnecting, socket, leaveCall]);

  /**
   * Toggle mute / unmute state
   */
  const toggleMute = useCallback(async () => {
    if (!localAudioTrackRef.current || !isConnected) return;

    try {
      const nextMuted = !isMuted;
      await localAudioTrackRef.current.setEnabled(!nextMuted);
      setIsMuted(nextMuted);

      if (socket && joinedRoomRef.current) {
        if (nextMuted) {
          socket.emit('audio-disabled', {
            roomCode: joinedRoomRef.current,
            userId,
          });
        } else {
          socket.emit('audio-enabled', {
            roomCode: joinedRoomRef.current,
            userId,
          });
        }
      }
    } catch (err) {
      console.warn('[useAudio] Failed to toggle mute:', err);
    }
  }, [isMuted, isConnected, socket, userId]);

  /**
   * Explicitly set mute state
   */
  const setMuted = useCallback(async (shouldMute) => {
    if (!localAudioTrackRef.current || !isConnected) return;
    try {
      await localAudioTrackRef.current.setEnabled(!shouldMute);
      setIsMuted(shouldMute);

      if (socket && joinedRoomRef.current) {
        socket.emit(shouldMute ? 'audio-disabled' : 'audio-enabled', {
          roomCode: joinedRoomRef.current,
          userId,
        });
      }
    } catch (err) {
      console.warn('[useAudio] Failed to set mute state:', err);
    }
  }, [isConnected, socket, userId]);

  // Speaker / Deafen control
  const [isDeafened, setIsDeafened] = useState(false);
  const toggleSpeaker = useCallback(() => {
    setIsDeafened((prev) => {
      const next = !prev;
      remoteUsers.forEach((u) => {
        if (u.audioTrack) {
          try {
            u.audioTrack.setVolume(next ? 0 : 100);
          } catch {}
        }
      });
      return next;
    });
  }, [remoteUsers]);

  // Host moderation actions
  const hostMuteUser = useCallback((targetUserId) => {
    if (!socket || !targetUserId || !roomCode) return;
    socket.emit('host-mute-user', { roomCode, targetUserId });
  }, [socket, roomCode]);

  const hostMuteAll = useCallback(() => {
    if (!socket || !roomCode) return;
    socket.emit('host-mute-all', { roomCode });
  }, [socket, roomCode]);

  const hostRemoveFromVoice = useCallback((targetUserId) => {
    if (!socket || !targetUserId || !roomCode) return;
    socket.emit('host-remove-from-voice', { roomCode, targetUserId });
  }, [socket, roomCode]);

  // Listen to Socket.io remote moderation events (e.g. host muting users or removing them)
  useEffect(() => {
    if (!socket) return;

    const handleRemoteMuted = (data) => {
      if (data?.targetUserId === String(userId) || data?.userId === String(userId)) {
        setMuted(true);
        setError('You were muted by the host');
      }
    };

    const handleMuteAll = (data) => {
      if (String(data?.hostUserId) !== String(userId)) {
        setMuted(true);
        setError('Host muted everyone in the room');
      }
    };

    const handleRemovedFromVoice = (data) => {
      if (data?.targetUserId === String(userId)) {
        leaveCall();
        setError('You were removed from voice chat by the host');
      }
    };

    const handleRemoteAudioEnabled = (data) => {
      if (data?.rtcUid && data?.userId) {
        uidMapRef.current.set(String(data.rtcUid), { userId: String(data.userId), name: data.user?.name });
      }
    };

    socket.on('audio-enabled', handleRemoteAudioEnabled);
    socket.on('mute-user', handleRemoteMuted);
    socket.on('force-mute', handleRemoteMuted);
    socket.on('mute-all-by-host', handleMuteAll);
    socket.on('removed-from-voice', handleRemovedFromVoice);

    return () => {
      socket.off('audio-enabled', handleRemoteAudioEnabled);
      socket.off('mute-user', handleRemoteMuted);
      socket.off('force-mute', handleRemoteMuted);
      socket.off('mute-all-by-host', handleMuteAll);
      socket.off('removed-from-voice', handleRemovedFromVoice);
    };
  }, [socket, userId, setMuted, leaveCall]);

  // Auto-join on mount if requested
  useEffect(() => {
    isMountedRef.current = true;
    if (autoJoin && roomCode && userId) {
      joinCall(roomCode, userId);
    }

    return () => {
      isMountedRef.current = false;
      leaveCall();
    };
  }, [autoJoin, roomCode, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    isConnected,
    isConnecting,
    isMuted,
    isDeafened,
    remoteUsers,
    activeSpeakers,
    localVolume,
    networkQuality,
    error,
    setError,
    joinCall,
    leaveCall,
    toggleMute,
    setMuted,
    toggleSpeaker,
    hostMuteUser,
    hostMuteAll,
    hostRemoveFromVoice,
  };
}

export default useAudio;
