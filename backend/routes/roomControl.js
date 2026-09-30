// routes/roomControl.js - Host Control Routes for Rooms & Collaborator Moderation
const express = require('express');
const router = express.Router();
const roomService = require('../services/roomService');
const { verifyAuth } = require('../middleware/verifyAuth');
const { supabaseAdmin } = require('../services/supabase');
const { AppError } = require('../utils/errorHandler');
const { getIo } = require('../socket');

/**
 * Helper: Resolve room and verify requesting user is host
 */
async function resolveRoomAndVerifyHost(roomIdOrCode, userId) {
  if (!roomIdOrCode) {
    throw new AppError('Room identifier is required.', 400, 'ROOM_ID_REQUIRED');
  }

  const room = await roomService.findRoomByIdOrCode(roomIdOrCode);
  if (!room) {
    throw new AppError('Room not found.', 404, 'ROOM_NOT_FOUND');
  }

  const isCreator = String(room.created_by) === String(userId);
  if (!isCreator) {
    // Also check if user has host role in room_members
    const { data: member } = await supabaseAdmin
      .from('room_members')
      .select('role')
      .eq('room_id', room.id)
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (member?.role !== 'host') {
      throw new AppError('Only the room host can perform this action.', 403, 'FORBIDDEN');
    }
  }

  return room;
}

/**
 * Helper: Find member by memberId or userId within room
 */
async function findMemberInRoom(roomId, memberId) {
  if (!memberId) {
    throw new AppError('Member ID is required.', 400, 'MEMBER_ID_REQUIRED');
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(memberId).trim());

  let query = supabaseAdmin
    .from('room_members')
    .select(`
      id,
      room_id,
      user_id,
      anonymous_name,
      role,
      can_edit,
      is_muted,
      is_active,
      users:user_id ( id, name, email )
    `)
    .eq('room_id', roomId);

  if (isUuid) {
    query = query.or(`id.eq.${memberId},user_id.eq.${memberId}`);
  } else {
    query = query.or(`anonymous_name.eq.${memberId},anonymous_name.ilike.%${memberId}%`);
  }

  let { data: member } = await query.maybeSingle();

  if (!member) {
    // Return ephemeral mock object for guest user so Socket/in-memory moderation still works
    return {
      id: memberId,
      room_id: roomId,
      user_id: null,
      anonymous_name: memberId,
      role: 'member',
      can_edit: true,
      is_muted: false,
      is_active: true,
    };
  }

  return member;
}

/**
 * Helper: Safe activity logger
 */
async function logRoomActivity(roomId, hostUser, action, targetUserId = null, targetUserName = null, details = {}) {
  try {
    await supabaseAdmin.from('room_activity_log').insert({
      room_id: roomId,
      user_id: hostUser.id,
      user_name: hostUser.name || hostUser.email?.split('@')[0] || 'Host',
      action,
      target_user_id: targetUserId,
      target_user_name: targetUserName,
      details,
    });
  } catch (err) {
    console.warn(`[ActivityLog] Note: ${err.message}`);
  }
}

/**
 * GET /api/rooms/:id/members
 * Get room members list with role, can_edit, is_muted status
 */
router.get('/:id/members', verifyAuth, async (req, res, next) => {
  try {
    const room = await roomService.findRoomByIdOrCode(req.params.id);
    if (!room) {
      throw new AppError('Room not found.', 404, 'ROOM_NOT_FOUND');
    }

    const { data: members, error } = await supabaseAdmin
      .from('room_members')
      .select(`
        id,
        room_id,
        user_id,
        anonymous_name,
        role,
        can_edit,
        is_muted,
        is_active,
        joined_at,
        users:user_id ( id, name, email )
      `)
      .eq('room_id', room.id)
      .eq('is_active', true)
      .order('joined_at', { ascending: true });

    if (error) {
      throw new AppError('Failed to fetch members: ' + error.message, 500, 'DB_ERROR');
    }

    const formatted = (members || []).map((m) => ({
      id: m.id,
      userId: m.user_id,
      name: m.users?.name || m.anonymous_name || m.users?.email?.split('@')[0] || 'Collaborator',
      email: m.users?.email || null,
      avatar: m.users?.avatar || null,
      role: m.role || (room.created_by === m.user_id ? 'host' : 'member'),
      canEdit: m.can_edit !== false,
      isMuted: Boolean(m.is_muted),
      joinedAt: m.joined_at,
      isHost: m.role === 'host' || room.created_by === m.user_id,
    }));

    return res.status(200).json({
      success: true,
      members: formatted,
      roomId: room.id,
      roomCode: room.code,
      isLocked: Boolean(room.is_locked),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 1. POST /api/rooms/:id/lock
 * Set is_locked = true
 */
router.post('/:id/lock', verifyAuth, async (req, res, next) => {
  try {
    const room = await resolveRoomAndVerifyHost(req.params.id, req.user.id);

    const { data: updatedRoom, error } = await supabaseAdmin
      .from('rooms')
      .update({
        is_locked: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', room.id)
      .select()
      .single();

    if (error) {
      throw new AppError('Failed to lock room: ' + error.message, 500, 'DB_ERROR');
    }

    await logRoomActivity(room.id, req.user, 'room_locked', null, null, { is_locked: true });

    const io = getIo();
    if (io) {
      io.to(`room-${room.code}`).emit('room-locked', {
        roomId: room.id,
        roomCode: room.code,
        isLocked: true,
        lockedBy: req.user.id,
        lockedByName: req.user.name || 'Host',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Room locked successfully.',
      is_locked: true,
      room: updatedRoom,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 2. POST /api/rooms/:id/unlock
 * Set is_locked = false
 */
router.post('/:id/unlock', verifyAuth, async (req, res, next) => {
  try {
    const room = await resolveRoomAndVerifyHost(req.params.id, req.user.id);

    const { data: updatedRoom, error } = await supabaseAdmin
      .from('rooms')
      .update({
        is_locked: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', room.id)
      .select()
      .single();

    if (error) {
      throw new AppError('Failed to unlock room: ' + error.message, 500, 'DB_ERROR');
    }

    await logRoomActivity(room.id, req.user, 'room_unlocked', null, null, { is_locked: false });

    const io = getIo();
    if (io) {
      io.to(`room-${room.code}`).emit('room-unlocked', {
        roomId: room.id,
        roomCode: room.code,
        isLocked: false,
        unlockedBy: req.user.id,
        unlockedByName: req.user.name || 'Host',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Room unlocked successfully.',
      is_locked: false,
      room: updatedRoom,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 3. POST /api/rooms/:id/member/:memberId/mute
 * Set is_muted = true
 */
router.post('/:id/member/:memberId/mute', verifyAuth, async (req, res, next) => {
  try {
    const room = await resolveRoomAndVerifyHost(req.params.id, req.user.id);
    const member = await findMemberInRoom(room.id, req.params.memberId);

    if (String(member.user_id) === String(req.user.id)) {
      throw new AppError('Host cannot mute themselves through host controls.', 400, 'CANNOT_RESTRICT_SELF');
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(member.id));
    if (isUuid) {
      const { error } = await supabaseAdmin
        .from('room_members')
        .update({ is_muted: true })
        .eq('id', member.id);
      if (error) {
        console.warn('Failed to mute member in DB:', error.message);
      }
    } else if (member.anonymous_name) {
      await supabaseAdmin
        .from('room_members')
        .update({ is_muted: true })
        .eq('room_id', room.id)
        .eq('anonymous_name', member.anonymous_name);
    }

    const targetName = member.users?.name || member.anonymous_name || 'Member';
    await logRoomActivity(room.id, req.user, 'user_muted', member.user_id || member.id, targetName, {
      member_id: member.id,
    });

    const io = getIo();
    if (io) {
      // Emit both user-muted and mute-user for voice integration
      io.to(`room-${room.code}`).emit('user-muted', {
        roomId: room.id,
        roomCode: room.code,
        memberId: member.id,
        targetUserId: member.user_id || member.id,
        isMuted: true,
        mutedBy: req.user.id,
      });

      io.to(`room-${room.code}`).emit('mute-user', {
        targetUserId: String(member.user_id || member.id),
        roomCode: room.code,
        mutedBy: req.user.name || 'Host',
      });
    }

    return res.status(200).json({
      success: true,
      message: `${targetName} has been muted.`,
      is_muted: true,
      memberId: member.id,
      targetUserId: member.user_id || member.id,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 4. POST /api/rooms/:id/member/:memberId/unmute
 * Set is_muted = false
 */
router.post('/:id/member/:memberId/unmute', verifyAuth, async (req, res, next) => {
  try {
    const room = await resolveRoomAndVerifyHost(req.params.id, req.user.id);
    const member = await findMemberInRoom(room.id, req.params.memberId);

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(member.id));
    if (isUuid) {
      const { error } = await supabaseAdmin
        .from('room_members')
        .update({ is_muted: false })
        .eq('id', member.id);
      if (error) {
        console.warn('Failed to unmute member in DB:', error.message);
      }
    } else if (member.anonymous_name) {
      await supabaseAdmin
        .from('room_members')
        .update({ is_muted: false })
        .eq('room_id', room.id)
        .eq('anonymous_name', member.anonymous_name);
    }

    const targetName = member.users?.name || member.anonymous_name || 'Member';
    await logRoomActivity(room.id, req.user, 'user_unmuted', member.user_id || member.id, targetName, {
      member_id: member.id,
    });

    const io = getIo();
    if (io) {
      io.to(`room-${room.code}`).emit('user-unmuted', {
        roomId: room.id,
        roomCode: room.code,
        memberId: member.id,
        targetUserId: member.user_id || member.id,
        isMuted: false,
        unmutedBy: req.user.id,
      });
    }

    return res.status(200).json({
      success: true,
      message: `${targetName} has been unmuted.`,
      is_muted: false,
      memberId: member.id,
      targetUserId: member.user_id || member.id,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 5. POST /api/rooms/:id/member/:memberId/disable-editor
 * Set can_edit = false
 */
router.post('/:id/member/:memberId/disable-editor', verifyAuth, async (req, res, next) => {
  try {
    const room = await resolveRoomAndVerifyHost(req.params.id, req.user.id);
    const member = await findMemberInRoom(room.id, req.params.memberId);

    if (String(member.user_id) === String(req.user.id)) {
      throw new AppError('Host cannot disable editor for themselves.', 400, 'CANNOT_RESTRICT_SELF');
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(member.id));
    if (isUuid) {
      const { error } = await supabaseAdmin
        .from('room_members')
        .update({ can_edit: false })
        .eq('id', member.id);
      if (error) {
        console.warn('Failed to disable editor in DB:', error.message);
      }
    } else if (member.anonymous_name) {
      await supabaseAdmin
        .from('room_members')
        .update({ can_edit: false })
        .eq('room_id', room.id)
        .eq('anonymous_name', member.anonymous_name);
    }

    const targetName = member.users?.name || member.anonymous_name || 'Member';
    await logRoomActivity(room.id, req.user, 'editor_disabled', member.user_id || member.id, targetName, {
      member_id: member.id,
    });

    const io = getIo();
    if (io) {
      io.to(`room-${room.code}`).emit('editor-disabled', {
        roomId: room.id,
        roomCode: room.code,
        memberId: member.id,
        targetUserId: member.user_id || member.id,
        canEdit: false,
        disabledBy: req.user.id,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Editor disabled for ${targetName}.`,
      can_edit: false,
      memberId: member.id,
      targetUserId: member.user_id || member.id,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 6. POST /api/rooms/:id/member/:memberId/enable-editor
 * Set can_edit = true
 */
router.post('/:id/member/:memberId/enable-editor', verifyAuth, async (req, res, next) => {
  try {
    const room = await resolveRoomAndVerifyHost(req.params.id, req.user.id);
    const member = await findMemberInRoom(room.id, req.params.memberId);

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(member.id));
    if (isUuid) {
      const { error } = await supabaseAdmin
        .from('room_members')
        .update({ can_edit: true })
        .eq('id', member.id);
      if (error) {
        console.warn('Failed to enable editor in DB:', error.message);
      }
    } else if (member.anonymous_name) {
      await supabaseAdmin
        .from('room_members')
        .update({ can_edit: true })
        .eq('room_id', room.id)
        .eq('anonymous_name', member.anonymous_name);
    }

    const targetName = member.users?.name || member.anonymous_name || 'Member';
    await logRoomActivity(room.id, req.user, 'editor_enabled', member.user_id || member.id, targetName, {
      member_id: member.id,
    });

    const io = getIo();
    if (io) {
      io.to(`room-${room.code}`).emit('editor-enabled', {
        roomId: room.id,
        roomCode: room.code,
        memberId: member.id,
        targetUserId: member.user_id || member.id,
        canEdit: true,
        enabledBy: req.user.id,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Editor enabled for ${targetName}.`,
      can_edit: true,
      memberId: member.id,
      targetUserId: member.user_id || member.id,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 7. POST /api/rooms/:id/member/:memberId/kick
 * Set kicked_at = NOW(), is_active = false
 */
router.post('/:id/member/:memberId/kick', verifyAuth, async (req, res, next) => {
  try {
    const room = await resolveRoomAndVerifyHost(req.params.id, req.user.id);
    const member = await findMemberInRoom(room.id, req.params.memberId);

    if (String(member.user_id) === String(req.user.id)) {
      throw new AppError('Host cannot kick themselves.', 400, 'CANNOT_RESTRICT_SELF');
    }

    const now = new Date().toISOString();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(member.id));
    if (isUuid) {
      const { error } = await supabaseAdmin
        .from('room_members')
        .update({
          is_active: false,
          kicked_at: now,
        })
        .eq('id', member.id);
      if (error) {
        console.warn('Failed to kick member in DB:', error.message);
      }
    } else if (member.anonymous_name) {
      await supabaseAdmin
        .from('room_members')
        .update({
          is_active: false,
          kicked_at: now,
        })
        .eq('room_id', room.id)
        .eq('anonymous_name', member.anonymous_name);
    }

    const targetName = member.users?.name || member.anonymous_name || 'Member';
    await logRoomActivity(room.id, req.user, 'user_kicked', member.user_id || member.id, targetName, {
      member_id: member.id,
      kicked_at: now,
    });

    const io = getIo();
    if (io) {
      io.to(`room-${room.code}`).emit('user-kicked', {
        roomId: room.id,
        roomCode: room.code,
        memberId: member.id,
        targetUserId: member.user_id,
        kickedBy: req.user.id,
        kickedByName: req.user.name || 'Host',
        timestamp: now,
      });
    }

    return res.status(200).json({
      success: true,
      message: `${targetName} has been kicked from the room.`,
      memberId: member.id,
      targetUserId: member.user_id,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
