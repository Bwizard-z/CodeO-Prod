// socket.js - Socket.io Real-time Collaboration Engine
const { Server } = require('socket.io');
const { supabaseAdmin } = require('./services/supabase');

// Singleton instance of initialized Socket.IO server
let ioInstance = null;

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

// In-memory cache of latest execution output & stdin per room for immediate sync on join
const latestRoomOutputs = new Map();
const latestRoomStdin = new Map();

// Synchronize active status in room_members table with real-time presence
async function activateMemberInDb(roomCode, user) {
  if (!roomCode || !user?.id) return;
  try {
    const { data: roomRow } = await supabaseAdmin.from('rooms').select('id').eq('code', roomCode).maybeSingle();
    if (!roomRow?.id) return;

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(user.id));
    if (isUuid) {
      await supabaseAdmin
        .from('room_members')
        .update({ is_active: true, kicked_at: null })
        .eq('room_id', roomRow.id)
        .eq('user_id', user.id);
    } else {
      const anonSessionId = user.anonymousSessionId || user.anonymous_session_id;
      if (anonSessionId) {
        await supabaseAdmin
          .from('room_members')
          .update({ is_active: true, kicked_at: null })
          .eq('room_id', roomRow.id)
          .eq('anonymous_session_id', anonSessionId);
      }
    }
  } catch (err) {
    console.warn('[Socket] DB member activation note:', err.message);
  }
}

async function deactivateMemberInDb(roomCode, user, isLastUser = false) {
  if (!roomCode) return;
  try {
    const { data: roomRow } = await supabaseAdmin.from('rooms').select('id').eq('code', roomCode).maybeSingle();
    if (!roomRow?.id) return;

    if (isLastUser) {
      await supabaseAdmin.from('room_members').update({ is_active: false }).eq('room_id', roomRow.id);
      return;
    }

    if (user?.id) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(user.id));
      if (isUuid) {
        await supabaseAdmin
          .from('room_members')
          .update({ is_active: false })
          .eq('room_id', roomRow.id)
          .eq('user_id', user.id);
      } else {
        const anonSessionId = user.anonymousSessionId || user.anonymous_session_id;
        if (anonSessionId) {
          await supabaseAdmin
            .from('room_members')
            .update({ is_active: false })
            .eq('room_id', roomRow.id)
            .eq('anonymous_session_id', anonSessionId);
        }
      }
    }
  } catch (err) {
    console.warn('[Socket] DB member deactivation note:', err.message);
  }
}

// On server startup: Reset any lingering active flags from past server sessions
async function reconcileStaleMembers() {
  try {
    await supabaseAdmin.from('room_members').update({ is_active: false }).eq('is_active', true);
  } catch (err) {
    console.warn('[Socket] Startup member reconciliation note:', err.message);
  }
}

function initSocket(server, allowedOrigins = []) {
  reconcileStaleMembers();
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

      // Verify room exists in database and user is not kicked
      try {
        const { data: roomData } = await supabaseAdmin
          .from('rooms')
          .select('id, code, is_locked')
          .eq('code', cleanCode)
          .maybeSingle();

        if (!roomData) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        // If user ID is provided, verify they were not kicked
        if (user?.id) {
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(user.id));
          if (isUuid) {
            const { data: memberData } = await supabaseAdmin
              .from('room_members')
              .select('is_active, kicked_at')
              .eq('room_id', roomData.id)
              .or(`user_id.eq.${user.id},anonymous_session_id.eq.${user.id}`)
              .maybeSingle();

            if (memberData && memberData.kicked_at) {
              socket.emit('user-kicked', { message: 'You have been removed from this room by the host.' });
              return;
            }
          }
        }
      } catch (checkErr) {
        console.warn('[Socket join verification warning]:', checkErr.message);
      }

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

      // Instantly synchronize latest execution output & stdin to this newly joined socket
      if (latestRoomOutputs.has(cleanCode)) {
        socket.emit('code-output', latestRoomOutputs.get(cleanCode));
      }
      if (latestRoomStdin.has(cleanCode)) {
        socket.emit('stdin-changed', { stdin: latestRoomStdin.get(cleanCode) });
      }

      if (!roomMembers.has(cleanCode)) {
        roomMembers.set(cleanCode, new Map());
      }
      const membersMap = roomMembers.get(cleanCode);

      // Deduplicate: If an existing socket in this room belongs to the same user.id, remove that stale socket
      if (currentUser.id && !currentUser.id.startsWith('guest-')) {
        for (const [sId, existingMem] of membersMap.entries()) {
          if (String(existingMem.id) === String(currentUser.id) && sId !== socket.id) {
            membersMap.delete(sId);
          }
        }
      }
      membersMap.set(socket.id, currentUser);

      const activeUsers = Array.from(membersMap.values());
      // Emit full users list to all members in the room
      io.to(`room-${cleanCode}`).emit('room-users', activeUsers);

      // Notify others that a new user joined
      socket.to(`room-${cleanCode}`).emit('user-joined', {
        user: currentUser,
        timestamp: new Date().toISOString(),
      });

      // Synchronize active status in database
      activateMemberInDb(cleanCode, currentUser);
    });

    // 1b. User Role / Profile Metadata Update (e.g. host role discovered)
    socket.on('user-update', ({ roomCode, user: updatedUser }) => {
      const cleanCode = (roomCode || currentRoomCode)?.toUpperCase()?.trim();
      if (!cleanCode || !currentUser) return;
      if (updatedUser?.role) currentUser.role = updatedUser.role;
      if (updatedUser?.name) currentUser.name = updatedUser.name;
      if (roomMembers.has(cleanCode)) {
        roomMembers.get(cleanCode).set(socket.id, currentUser);
        io.to(`room-${cleanCode}`).emit('room-users', Array.from(roomMembers.get(cleanCode).values()));
      }
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
        stdin: data.stdin !== undefined ? data.stdin : '',
        status: data.status || (data.error ? 'error' : 'success'),
        executionTime: data.executionTime || 0,
        error: Boolean(data.error),
        userId: data.userId || currentUser?.id,
        userName: data.userName || data.ranBy || currentUser?.name || 'Someone',
        ranBy: data.userName || data.ranBy || currentUser?.name || 'Someone',
        timestamp: data.timestamp || new Date().toISOString(),
      };

      // Cache latest output & stdin for room
      latestRoomOutputs.set(cleanCode, payload);
      if (data?.stdin !== undefined) {
        latestRoomStdin.set(cleanCode, data.stdin);
      }

      // Broadcast to all sockets in the room
      io.to(`room-${cleanCode}`).emit('code-result', payload);
      io.to(`room-${cleanCode}`).emit('code-output', payload);
    });

    // 4b. Real-Time Stdin Change Broadcast
    socket.on('stdin-change', (data) => {
      const roomCode = data?.roomCode || currentRoomCode;
      if (!roomCode) return;
      const cleanCode = roomCode.toUpperCase().trim();
      if (data?.stdin !== undefined) {
        latestRoomStdin.set(cleanCode, data.stdin);
      }
      socket.to(`room-${cleanCode}`).emit('stdin-changed', {
        stdin: data?.stdin !== undefined ? data.stdin : '',
        userName: currentUser?.name || 'Collaborator',
        userId: currentUser?.id,
      });
    });

    // 4c. Real-Time Code Running Indicator Broadcast
    socket.on('code-running', (data) => {
      const roomCode = data?.roomCode || currentRoomCode;
      if (!roomCode) return;
      const cleanCode = roomCode.toUpperCase().trim();
      socket.to(`room-${cleanCode}`).emit('code-running', {
        userName: data?.userName || currentUser?.name || 'A collaborator',
        language: data?.language || '',
        stdin: data?.stdin !== undefined ? data.stdin : '',
        userId: currentUser?.id,
      });
    });

    // 4d. Code Output Cleared Broadcast
    socket.on('code-cleared', (data) => {
      const roomCode = data?.roomCode || currentRoomCode;
      if (!roomCode) return;
      const cleanCode = roomCode.toUpperCase().trim();
      latestRoomOutputs.delete(cleanCode);
      io.to(`room-${cleanCode}`).emit('code-cleared', {});
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

    // 5b. AI Chat Question Broadcast (real-time peer sync)
    socket.on('ai-question', (data) => {
      const roomCode = data?.roomCode || currentRoomCode;
      if (!roomCode) return;
      const cleanCode = roomCode.toUpperCase().trim();

      const payload = {
        message: data.message || data.promptText || '',
        promptText: data.promptText || data.message || '',
        userName: data.userName || currentUser?.name || 'Collaborator',
        userId: data.userId || currentUser?.id,
        timestamp: data.timestamp || new Date().toISOString(),
        id: data.id || `aiq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      };

      // Broadcast to all other peers in the room
      socket.to(`room-${cleanCode}`).emit('ai-question', payload);
    });

    // 5c. AI Chat Response Broadcast
    socket.on('ai-response', (data) => {
      const roomCode = data?.roomCode || currentRoomCode;
      if (!roomCode) return;
      const cleanCode = roomCode.toUpperCase().trim();

      const payload = {
        message: data.message || data.response || '',
        response: data.message || data.response || '',
        promptText: data.promptText || '',
        userName: data.userName || currentUser?.name || 'Collaborator',
        userId: data.userId || currentUser?.id,
        timestamp: data.timestamp || new Date().toISOString(),
        id: data.id || `air-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      };

      // Broadcast to all other peers in the room
      socket.to(`room-${cleanCode}`).emit('ai-response', payload);
    });

    // 5d. AI Chat Error Broadcast
    socket.on('ai-response-error', (data) => {
      const roomCode = data?.roomCode || currentRoomCode;
      if (!roomCode) return;
      const cleanCode = roomCode.toUpperCase().trim();
      socket.to(`room-${cleanCode}`).emit('ai-response-error', data);
    });

    // 5e. AI Chat Clear Broadcast
    socket.on('ai-chat-clear', (data) => {
      const roomCode = data?.roomCode || currentRoomCode;
      if (!roomCode) return;
      const cleanCode = roomCode.toUpperCase().trim();
      socket.to(`room-${cleanCode}`).emit('ai-chat-clear', data);
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
      if (String(user.role || '').toLowerCase() === 'host') return true;
      try {
        const { data: room } = await supabaseAdmin
          .from('rooms')
          .select('id, created_by')
          .eq('code', code)
          .maybeSingle();

        if (
          room &&
          user.id &&
          room.created_by &&
          String(room.created_by).trim().toLowerCase() === String(user.id).trim().toLowerCase()
        ) {
          return true;
        }

        if (room && user.id) {
          const { data: member } = await supabaseAdmin
            .from('room_members')
            .select('role')
            .eq('room_id', room.id)
            .or(`user_id.eq.${user.id},anonymous_session_id.eq.${user.id}`)
            .maybeSingle();
          if (member && member.role === 'host') return true;
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

    // 10b. Host Moderation: Unmute specific user
    socket.on('host-unmute-user', async ({ roomCode, targetUserId }) => {
      const code = (roomCode || currentRoomCode)?.toUpperCase()?.trim();
      if (!code || !targetUserId) return;
      const isHost = await checkIsHost(code, currentUser);
      if (!isHost) {
        return socket.emit('error', { message: 'Only the room host can unmute participants.' });
      }
      io.to(`room-${code}`).emit('unmute-user', {
        targetUserId: String(targetUserId),
        roomCode: code,
        unmutedBy: currentUser?.name || 'Host',
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

    // 12b. Host Moderation: Rename Room
    socket.on('host-rename-room', async ({ roomCode, title }) => {
      const code = (roomCode || currentRoomCode)?.toUpperCase()?.trim();
      const cleanTitle = (title || '').trim();
      if (!code || !cleanTitle) return;
      const isHost = await checkIsHost(code, currentUser);
      if (!isHost) {
        return socket.emit('error', { message: 'Only the room host can rename the room.' });
      }

      try {
        await supabaseAdmin.from('rooms').update({ title: cleanTitle, updated_at: new Date().toISOString() }).eq('code', code);
      } catch (e) {
        console.warn('[Socket] Rename room DB error:', e.message);
      }

      io.to(`room-${code}`).emit('room-renamed', {
        roomCode: code,
        title: cleanTitle,
        renamedBy: currentUser?.name || 'Host',
        renamedById: currentUser?.id,
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
    socket.on('leave-room', ({ roomCode } = {}) => {
      const code = (roomCode || currentRoomCode)?.toUpperCase()?.trim();
      if (!code) return;

      socket.leave(`room-${code}`);
      if (roomMembers.has(code)) {
        const members = roomMembers.get(code);
        members.delete(socket.id);
        const remaining = Array.from(members.values());

        if (remaining.length === 0) {
          roomMembers.delete(code);
          deactivateMemberInDb(code, null, true);
        } else {
          io.to(`room-${code}`).emit('room-users', remaining);
          const userStillPresent = remaining.some((m) => String(m.id) === String(currentUser?.id));
          if (!userStillPresent) {
            deactivateMemberInDb(code, currentUser, false);
          }
        }
      } else {
        deactivateMemberInDb(code, currentUser, false);
      }

      if (currentUser) {
        socket.to(`room-${code}`).emit('user-left', {
          user: currentUser,
          userId: currentUser?.id,
          socketId: socket.id,
          timestamp: new Date().toISOString(),
        });
      }
      if (currentRoomCode === code) {
        currentRoomCode = null;
      }
    });

    // 7. Socket Disconnect - evicts socket from all rooms to prevent ghost users
    socket.on('disconnect', () => {
      for (const [code, members] of roomMembers.entries()) {
        if (members.has(socket.id)) {
          const removedUser = members.get(socket.id);
          members.delete(socket.id);
          const remaining = Array.from(members.values());

          if (remaining.length === 0) {
            roomMembers.delete(code);
            deactivateMemberInDb(code, null, true);
          } else {
            io.to(`room-${code}`).emit('room-users', remaining);
            const userStillPresent = remaining.some((m) => String(m.id) === String(removedUser?.id));
            if (!userStillPresent) {
              deactivateMemberInDb(code, removedUser || currentUser, false);
            }
          }

          io.to(`room-${code}`).emit('user-left', {
            user: removedUser || currentUser,
            userId: removedUser?.id || currentUser?.id,
            socketId: socket.id,
            timestamp: new Date().toISOString(),
          });
        }
      }
      currentRoomCode = null;
      currentUser = null;
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
    stdin: data.stdin !== undefined ? data.stdin : '',
    userName: data.userName || 'Collaborator',
    timestamp: data.timestamp || new Date().toISOString(),
    executionTime: data.executionTime || 0,
    error: Boolean(data.error),
    ranBy: data.userName || 'Collaborator',
    userId: data.userId || null,
  };
  latestRoomOutputs.set(cleanCode, payload);
  if (data?.stdin !== undefined) {
    latestRoomStdin.set(cleanCode, data.stdin);
  }
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


