// socket.js - Socket.io Real-time Collaboration Engine
const { Server } = require('socket.io');
const { supabaseAdmin } = require('./services/supabase');

// Map<roomCode, Map<socketId, { id, name, email, avatar, role, color }>>
const roomMembers = new Map();

// Vibrant distinct colors for collaborator cursors and badges
const COLLABORATOR_COLORS = [
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#3b82f6', // Blue
  '#ec4899', // Pink
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#14b8a6', // Teal
];

function getRandomColor(seed = '') {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COLLABORATOR_COLORS.length;
  return COLLABORATOR_COLORS[index];
}

function initSocket(server, allowedOrigins = []) {
  const isProduction = process.env.NODE_ENV === 'production';
  const io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        if (!isProduction) {
          return callback(null, true); // Permissive in development
        }
        return callback(new Error(`Socket connection from origin ${origin} blocked by CORS policy`));
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 30000,
    pingInterval: 10000,
    destroyUpgrade: false, // Prevent Socket.IO engine from destroying Yjs WebSocket upgrades
  });

  io.on('connection', (socket) => {
    let currentRoomCode = null;
    let currentUser = null;

    // 1. Join room
    socket.on('join-room', async ({ roomCode, user }) => {
      if (!roomCode) return;
      const cleanCode = roomCode.toUpperCase().trim();
      currentRoomCode = cleanCode;

      const memberColor = getRandomColor(user?.id || user?.name || socket.id);
      currentUser = {
        socketId: socket.id,
        id: user?.id || `guest-${socket.id.slice(0, 6)}`,
        name: user?.name || user?.user_metadata?.user_name || 'Collaborator',
        email: user?.email || null,
        avatar: user?.avatar || null,
        role: user?.role || 'member',
        color: memberColor,
        joinedAt: new Date().toISOString(),
      };

      socket.join(`room-${cleanCode}`);

      if (!roomMembers.has(cleanCode)) {
        roomMembers.set(cleanCode, new Map());
      }
      roomMembers.get(cleanCode).set(socket.id, currentUser);

      const activeUsers = Array.from(roomMembers.get(cleanCode).values());
      // Emit full users list to all members in the room
      io.to(`room-${cleanCode}`).emit('room-users', activeUsers);

      // Notify others that a new user joined
      socket.to(`room-${cleanCode}`).emit('user-joined', {
        user: currentUser,
        timestamp: new Date().toISOString(),
      });
    });

    // 2. Language Change Sync
    socket.on('language-change', async ({ roomCode, language }) => {
      if (!roomCode || !language) return;
      const cleanCode = roomCode.toUpperCase().trim();

      // Broadcast to all other peers in the room
      socket.to(`room-${cleanCode}`).emit('language-changed', {
        language: language.toLowerCase().trim(),
        changedBy: currentUser?.name || 'A collaborator',
      });

      // Persist language to database
      try {
        await supabaseAdmin
          .from('rooms')
          .update({
            language: language.toLowerCase().trim(),
            updated_at: new Date().toISOString(),
          })
          .eq('code', cleanCode);
      } catch (err) {
        console.warn(`[Socket] Failed to persist language change for ${cleanCode}:`, err.message);
      }
    });

    // 3. Real-Time Ping Handler for latency measurement
    socket.on('ping', (data, callback) => {
      if (typeof callback === 'function') {
        callback({ timestamp: Date.now() });
      } else {
        socket.emit('pong', { timestamp: Date.now() });
      }
    });

    // 4. Code Execution Results Broadcast
    socket.on('code-executed', (data) => {
      const roomCode = data?.roomCode || currentRoomCode;
      if (!roomCode) return;
      const cleanCode = roomCode.toUpperCase().trim();

      const payload = {
        output: data.output || '',
        language: data.language || '',
        status: data.status || (data.error ? 'error' : 'success'),
        executionTime: data.executionTime || 0,
        error: Boolean(data.error),
        userId: data.userId || currentUser?.id,
        userName: data.userName || data.ranBy || currentUser?.name || 'Someone',
        ranBy: data.userName || data.ranBy || currentUser?.name || 'Someone',
        timestamp: data.timestamp || new Date().toISOString(),
      };

      // Broadcast to all other peers in the room
      socket.to(`room-${cleanCode}`).emit('code-result', payload);
      socket.to(`room-${cleanCode}`).emit('code-output', payload);
    });

    // 5. Code Explanation Results Broadcast
    socket.on('code-explained', (data) => {
      const roomCode = data?.roomCode || currentRoomCode;
      if (!roomCode) return;
      const cleanCode = roomCode.toUpperCase().trim();

      const payload = {
        explanation: data.explanation || '',
        code: data.code || '',
        language: data.language || 'javascript',
        user: data.user || (currentUser ? {
          id: currentUser.id,
          name: currentUser.name,
          avatar: currentUser.avatar,
          color: currentUser.color,
        } : { name: 'A collaborator' }),
        timestamp: data.timestamp || new Date().toISOString(),
      };

      // Broadcast to all other peers in the room
      socket.to(`room-${cleanCode}`).emit('code-explained', payload);
    });

    // 6. User Joined Broadcast (Explicit trigger or audio presence)
    socket.on('user-joined', (data = {}) => {
      const roomCode = data?.roomCode || currentRoomCode;
      if (!roomCode) return;
      const cleanCode = roomCode.toUpperCase().trim();
      const payload = {
        user: data.user || currentUser,
        userId: data.userId || currentUser?.id,
        socketId: socket.id,
        timestamp: data.timestamp || new Date().toISOString(),
      };
      socket.to(`room-${cleanCode}`).emit('user-joined', payload);
    });

    // 7. User Left Broadcast (Explicit trigger)
    socket.on('user-left', (data = {}) => {
      const roomCode = data?.roomCode || currentRoomCode;
      if (!roomCode) return;
      const cleanCode = roomCode.toUpperCase().trim();
      const payload = {
        user: data.user || currentUser,
        userId: data.userId || currentUser?.id,
        socketId: socket.id,
        timestamp: data.timestamp || new Date().toISOString(),
      };
      socket.to(`room-${cleanCode}`).emit('user-left', payload);
    });

    // 8. Audio Enabled Broadcast (Microphone unmuted / voice connected)
    socket.on('audio-enabled', (data = {}) => {
      const roomCode = data?.roomCode || currentRoomCode;
      if (!roomCode) return;
      const cleanCode = roomCode.toUpperCase().trim();

      const rtcUid = data.rtcUid || null;
      const payload = {
        userId: data.userId || currentUser?.id,
        user: data.user || currentUser,
        socketId: socket.id,
        rtcUid,
        audioEnabled: true,
        isInVoice: true,
        isMuted: false,
        timestamp: data.timestamp || new Date().toISOString(),
      };

      if (currentUser) {
        currentUser.isInVoice = true;
        currentUser.audioEnabled = true;
        currentUser.isMuted = false;
        if (rtcUid) currentUser.rtcUid = rtcUid;
      }

      if (roomMembers.has(cleanCode) && roomMembers.get(cleanCode).has(socket.id)) {
        const mem = roomMembers.get(cleanCode).get(socket.id);
        mem.isInVoice = true;
        mem.audioEnabled = true;
        mem.isMuted = false;
        if (rtcUid) mem.rtcUid = rtcUid;
        io.to(`room-${cleanCode}`).emit('room-users', Array.from(roomMembers.get(cleanCode).values()));
      }

      socket.to(`room-${cleanCode}`).emit('audio-enabled', payload);
    });

    // 9. Audio Disabled Broadcast (Microphone muted or voice left)
    socket.on('audio-disabled', (data = {}) => {
      const roomCode = data?.roomCode || currentRoomCode;
      if (!roomCode) return;
      const cleanCode = roomCode.toUpperCase().trim();

      const isLeaving = Boolean(data.leftVoice || data.isInVoice === false);
      const payload = {
        userId: data.userId || currentUser?.id,
        user: data.user || currentUser,
        socketId: socket.id,
        audioEnabled: false,
        isInVoice: !isLeaving,
        isMuted: true,
        leftVoice: isLeaving,
        timestamp: data.timestamp || new Date().toISOString(),
      };

      if (currentUser) {
        currentUser.audioEnabled = false;
        currentUser.isMuted = true;
        if (isLeaving) currentUser.isInVoice = false;
      }

      if (roomMembers.has(cleanCode) && roomMembers.get(cleanCode).has(socket.id)) {
        const mem = roomMembers.get(cleanCode).get(socket.id);
        mem.audioEnabled = false;
        mem.isMuted = true;
        if (isLeaving) mem.isInVoice = false;
        io.to(`room-${cleanCode}`).emit('room-users', Array.from(roomMembers.get(cleanCode).values()));
      }

      socket.to(`room-${cleanCode}`).emit('audio-disabled', payload);
    });

    // Helper to verify if currentUser is the room host
    async function checkIsHost(code, user) {
      if (!code || !user) return false;
      if (user.role === 'host') return true;
      try {
        const { data: room } = await supabaseAdmin
          .from('rooms')
          .select('id, created_by')
          .eq('code', code)
          .maybeSingle();
        if (room && String(room.created_by) === String(user.id)) {
          return true;
        }
      } catch (err) {
        console.warn('[Socket] Error checking room host:', err.message);
      }
      return false;
    }

    // 10. Host Moderation: Mute specific user
    socket.on('host-mute-user', async ({ roomCode, targetUserId }) => {
      const code = (roomCode || currentRoomCode)?.toUpperCase()?.trim();
      if (!code || !targetUserId) return;
      const isHost = await checkIsHost(code, currentUser);
      if (!isHost) {
        return socket.emit('error', { message: 'Only the room host can mute participants.' });
      }
      io.to(`room-${code}`).emit('mute-user', {
        targetUserId: String(targetUserId),
        roomCode: code,
        mutedBy: currentUser?.name || 'Host',
      });
    });

    // 11. Host Moderation: Mute all users
    socket.on('host-mute-all', async ({ roomCode }) => {
      const code = (roomCode || currentRoomCode)?.toUpperCase()?.trim();
      if (!code) return;
      const isHost = await checkIsHost(code, currentUser);
      if (!isHost) {
        return socket.emit('error', { message: 'Only the room host can mute all participants.' });
      }
      io.to(`room-${code}`).emit('mute-all-by-host', {
        hostUserId: String(currentUser?.id),
        roomCode: code,
        mutedBy: currentUser?.name || 'Host',
      });
    });

    // 12. Host Moderation: Remove user from voice
    socket.on('host-remove-from-voice', async ({ roomCode, targetUserId }) => {
      const code = (roomCode || currentRoomCode)?.toUpperCase()?.trim();
      if (!code || !targetUserId) return;
      const isHost = await checkIsHost(code, currentUser);
      if (!isHost) {
        return socket.emit('error', { message: 'Only the room host can remove participants from voice.' });
      }
      io.to(`room-${code}`).emit('removed-from-voice', {
        targetUserId: String(targetUserId),
        roomCode: code,
        removedBy: currentUser?.name || 'Host',
      });
    });

    // 13. Host Moderation: Lock Room
    socket.on('host-lock-room', async ({ roomCode }) => {
      const code = (roomCode || currentRoomCode)?.toUpperCase()?.trim();
      if (!code) return;
      const isHost = await checkIsHost(code, currentUser);
      if (!isHost) {
        return socket.emit('error', { message: 'Only the room host can lock the room.' });
      }

      try {
        await supabaseAdmin.from('rooms').update({ is_locked: true, updated_at: new Date().toISOString() }).eq('code', code);
      } catch (e) {
        console.warn('[Socket] Lock room DB error:', e.message);
      }

      io.to(`room-${code}`).emit('room-locked', {
        roomCode: code,
        isLocked: true,
        lockedBy: currentUser?.id,
        lockedByName: currentUser?.name || 'Host',
      });
    });

    // 14. Host Moderation: Unlock Room
    socket.on('host-unlock-room', async ({ roomCode }) => {
      const code = (roomCode || currentRoomCode)?.toUpperCase()?.trim();
      if (!code) return;
      const isHost = await checkIsHost(code, currentUser);
      if (!isHost) {
        return socket.emit('error', { message: 'Only the room host can unlock the room.' });
      }

      try {
        await supabaseAdmin.from('rooms').update({ is_locked: false, updated_at: new Date().toISOString() }).eq('code', code);
      } catch (e) {
        console.warn('[Socket] Unlock room DB error:', e.message);
      }

      io.to(`room-${code}`).emit('room-unlocked', {
        roomCode: code,
        isLocked: false,
        unlockedBy: currentUser?.id,
        unlockedByName: currentUser?.name || 'Host',
      });
    });

    // 15. Host Moderation: Disable Editor for User
    socket.on('host-disable-editor', async ({ roomCode, targetUserId }) => {
      const code = (roomCode || currentRoomCode)?.toUpperCase()?.trim();
      if (!code || !targetUserId) return;
      const isHost = await checkIsHost(code, currentUser);
      if (!isHost) {
        return socket.emit('error', { message: 'Only the room host can disable editor for members.' });
      }

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(targetUserId));
      try {
        const { data: room } = await supabaseAdmin.from('rooms').select('id').eq('code', code).maybeSingle();
        if (room && isUuid) {
          await supabaseAdmin.from('room_members').update({ can_edit: false }).eq('room_id', room.id).or(`id.eq.${targetUserId},user_id.eq.${targetUserId}`);
        } else if (room) {
          await supabaseAdmin.from('room_members').update({ can_edit: false }).eq('room_id', room.id).eq('anonymous_name', targetUserId);
        }
      } catch (e) {
        console.warn('[Socket] Disable editor DB error:', e.message);
      }

      // Update in-memory roomMembers cache
      if (roomMembers.has(code)) {
        for (const mem of roomMembers.get(code).values()) {
          if (String(mem.id) === String(targetUserId) || String(mem.userId) === String(targetUserId) || mem.name === targetUserId) {
            mem.canEdit = false;
          }
        }
        io.to(`room-${code}`).emit('room-users', Array.from(roomMembers.get(code).values()));
      }

      io.to(`room-${code}`).emit('editor-disabled', {
        roomCode: code,
        targetUserId: String(targetUserId),
        memberId: String(targetUserId),
        canEdit: false,
        disabledBy: currentUser?.id,
      });
    });

    // 16. Host Moderation: Enable Editor for User
    socket.on('host-enable-editor', async ({ roomCode, targetUserId }) => {
      const code = (roomCode || currentRoomCode)?.toUpperCase()?.trim();
      if (!code || !targetUserId) return;
      const isHost = await checkIsHost(code, currentUser);
      if (!isHost) {
        return socket.emit('error', { message: 'Only the room host can enable editor for members.' });
      }

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(targetUserId));
      try {
        const { data: room } = await supabaseAdmin.from('rooms').select('id').eq('code', code).maybeSingle();
        if (room && isUuid) {
          await supabaseAdmin.from('room_members').update({ can_edit: true }).eq('room_id', room.id).or(`id.eq.${targetUserId},user_id.eq.${targetUserId}`);
        } else if (room) {
          await supabaseAdmin.from('room_members').update({ can_edit: true }).eq('room_id', room.id).eq('anonymous_name', targetUserId);
        }
      } catch (e) {
        console.warn('[Socket] Enable editor DB error:', e.message);
      }

      // Update in-memory roomMembers cache
      if (roomMembers.has(code)) {
        for (const mem of roomMembers.get(code).values()) {
          if (String(mem.id) === String(targetUserId) || String(mem.userId) === String(targetUserId) || mem.name === targetUserId) {
            mem.canEdit = true;
          }
        }
        io.to(`room-${code}`).emit('room-users', Array.from(roomMembers.get(code).values()));
      }

      io.to(`room-${code}`).emit('editor-enabled', {
        roomCode: code,
        targetUserId: String(targetUserId),
        memberId: String(targetUserId),
        canEdit: true,
        enabledBy: currentUser?.id,
      });
    });

    // 17. Host Moderation: Kick User from Room
    socket.on('host-kick-user', async ({ roomCode, targetUserId }) => {
      const code = (roomCode || currentRoomCode)?.toUpperCase()?.trim();
      if (!code || !targetUserId) return;
      const isHost = await checkIsHost(code, currentUser);
      if (!isHost) {
        return socket.emit('error', { message: 'Only the room host can kick participants.' });
      }

      const now = new Date().toISOString();
      try {
        const { data: room } = await supabaseAdmin.from('rooms').select('id').eq('code', code).maybeSingle();
        if (room) {
          await supabaseAdmin.from('room_members').update({ is_active: false, kicked_at: now }).eq('room_id', room.id).or(`id.eq.${targetUserId},user_id.eq.${targetUserId}`);
        }
      } catch (e) {
        console.warn('[Socket] Kick user DB error:', e.message);
      }

      io.to(`room-${code}`).emit('user-kicked', {
        roomCode: code,
        targetUserId: String(targetUserId),
        kickedBy: currentUser?.id,
        kickedByName: currentUser?.name || 'Host',
        timestamp: now,
      });
    });

    // 10. Leave room
    socket.on('leave-room', ({ roomCode }) => {
      const code = (roomCode || currentRoomCode)?.toUpperCase()?.trim();
      if (!code) return;

      socket.leave(`room-${code}`);
      if (roomMembers.has(code)) {
        const members = roomMembers.get(code);
        members.delete(socket.id);
        const remaining = Array.from(members.values());

        if (remaining.length === 0) {
          roomMembers.delete(code);
        } else {
          io.to(`room-${code}`).emit('room-users', remaining);
        }
      }

      if (currentUser) {
        socket.to(`room-${code}`).emit('user-left', {
          user: currentUser,
          timestamp: new Date().toISOString(),
        });
      }
      currentRoomCode = null;
    });

    // 7. Socket Disconnect
    socket.on('disconnect', () => {
      if (currentRoomCode && roomMembers.has(currentRoomCode)) {
        const members = roomMembers.get(currentRoomCode);
        members.delete(socket.id);
        const remaining = Array.from(members.values());

        if (remaining.length === 0) {
          roomMembers.delete(currentRoomCode);
        } else {
          io.to(`room-${currentRoomCode}`).emit('room-users', remaining);
        }

        if (currentUser) {
          socket.to(`room-${currentRoomCode}`).emit('user-left', {
            user: currentUser,
            timestamp: new Date().toISOString(),
          });
        }
      }
    });
  });

  ioInstance = io;
  return io;
}

function getIo() {
  return ioInstance;
}

function broadcastCodeExecuted(roomCode, data) {
  if (!ioInstance || !roomCode) return;
  const cleanCode = roomCode.toUpperCase().trim();
  const payload = {
    output: data.output || '',
    language: data.language || '',
    userName: data.userName || 'Collaborator',
    timestamp: data.timestamp || new Date().toISOString(),
    executionTime: data.executionTime || 0,
    error: Boolean(data.error),
    ranBy: data.userName || 'Collaborator',
    userId: data.userId || null,
  };
  ioInstance.to(`room-${cleanCode}`).emit('code-executed', payload);
  ioInstance.to(`room-${cleanCode}`).emit('code-output', payload);
}

function broadcastCodeExplained(roomCode, data) {
  if (!ioInstance || !roomCode) return;
  const cleanCode = roomCode.toUpperCase().trim();
  const payload = {
    explanation: data.explanation || '',
    code: data.code || '',
    language: data.language || 'javascript',
    user: data.user || { name: data.userName || 'Collaborator' },
    timestamp: data.timestamp || new Date().toISOString(),
  };
  ioInstance.to(`room-${cleanCode}`).emit('code-explained', payload);
}

function broadcastAudioEnabled(roomCode, data) {
  if (!ioInstance || !roomCode) return;
  const cleanCode = roomCode.toUpperCase().trim();
  ioInstance.to(`room-${cleanCode}`).emit('audio-enabled', {
    userId: data.userId,
    user: data.user,
    audioEnabled: true,
    isMuted: false,
    timestamp: data.timestamp || new Date().toISOString(),
  });
}

function broadcastAudioDisabled(roomCode, data) {
  if (!ioInstance || !roomCode) return;
  const cleanCode = roomCode.toUpperCase().trim();
  ioInstance.to(`room-${cleanCode}`).emit('audio-disabled', {
    userId: data.userId,
    user: data.user,
    audioEnabled: false,
    isMuted: true,
    timestamp: data.timestamp || new Date().toISOString(),
  });
}

function broadcastUserJoined(roomCode, data) {
  if (!ioInstance || !roomCode) return;
  const cleanCode = roomCode.toUpperCase().trim();
  ioInstance.to(`room-${cleanCode}`).emit('user-joined', {
    user: data.user,
    userId: data.userId,
    timestamp: data.timestamp || new Date().toISOString(),
  });
}

function broadcastUserLeft(roomCode, data) {
  if (!ioInstance || !roomCode) return;
  const cleanCode = roomCode.toUpperCase().trim();
  ioInstance.to(`room-${cleanCode}`).emit('user-left', {
    user: data.user,
    userId: data.userId,
    timestamp: data.timestamp || new Date().toISOString(),
  });
}

module.exports = {
  initSocket,
  getIo,
  broadcastCodeExecuted,
  broadcastCodeExplained,
  broadcastAudioEnabled,
  broadcastAudioDisabled,
  broadcastUserJoined,
  broadcastUserLeft,
};


