// services/roomService.js - CODEO Room Management Service
const crypto = require('crypto');
const { supabaseAdmin } = require('./supabase');
const { AppError } = require('../utils/errorHandler');

/**
 * Generate a 6-character uppercase alphanumeric room code (e.g., 'ABC123')
 * Format matches DB constraint: ^[A-Z0-9]{6}$
 */
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Upper alphanumeric avoiding ambiguous characters
  let code = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

/**
 * Ensure room code is globally unique across active and archived rooms
 */
async function getUniqueRoomCode() {
  let attempts = 0;
  while (attempts < 15) {
    const code = generateRoomCode();
    const { data } = await supabaseAdmin
      .from('rooms')
      .select('id')
      .eq('code', code)
      .maybeSingle();

    if (!data) return code;
    attempts++;
  }
  throw new AppError('Unable to generate unique room code. Please try again.', 500, 'CODE_GEN_FAILED');
}

/**
 * Generate a 32-character unique invite token
 */
function generateInviteToken() {
  return crypto.randomBytes(16).toString('hex'); // 32 characters hex
}

/**
 * Ensure invite token is globally unique
 */
async function getUniqueInviteToken() {
  let attempts = 0;
  while (attempts < 15) {
    const token = generateInviteToken();
    const { data } = await supabaseAdmin
      .from('rooms')
      .select('id')
      .eq('invite_token', token)
      .maybeSingle();

    if (!data) return token;
    attempts++;
  }
  throw new AppError('Unable to generate unique invite token. Please try again.', 500, 'TOKEN_GEN_FAILED');
}

/**
 * Check if the user has reached the active room limit (max 10 non-archived rooms)
 * Throws AppError if limit is reached
 */
async function checkUserRoomLimit(userId) {
  if (!userId) {
    throw new AppError('User ID is required to check room limit.', 400, 'USER_ID_REQUIRED');
  }

  const { count, error } = await supabaseAdmin
    .from('rooms')
    .select('id', { count: 'exact', head: true })
    .eq('created_by', userId);

  if (error) {
    throw new AppError('Database error checking room limit: ' + error.message, 500, 'DB_ERROR');
  }

  const roomCount = count || 0;
  const limit = 10;
  const remaining = Math.max(0, limit - roomCount);

  if (roomCount >= limit) {
    throw new AppError(
      `You have reached the limit of ${limit} rooms. Please delete an existing room to create a new one.`,
      400,
      'ROOM_LIMIT_REACHED'
    );
  }

  return { count: roomCount, limit, remaining };
}

/**
 * Retrieve all non-archived rooms created by the user (max 10)
 * Returns { rooms, count, limit, remaining }
 */
async function getAllUserRooms(userId) {
  if (!userId) {
    throw new AppError('User ID is required.', 401, 'UNAUTHORIZED');
  }

  const limit = 10;

  const { data: rooms, error } = await supabaseAdmin
    .from('rooms')
    .select(`
      id,
      code,
      invite_token,
      title,
      description,
      language,
      code_content,
      is_locked,
      created_at,
      updated_at,
      created_by,
      room_members (
        id,
        user_id,
        role,
        is_active
      )
    `)
    .eq('created_by', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new AppError('Failed to fetch user rooms: ' + error.message, 500, 'DB_ERROR');
  }

  const roomList = rooms || [];
  const count = roomList.length;
  const remaining = Math.max(0, limit - count);

  const formattedRooms = roomList.map((r) => {
    const activeMembers = (r.room_members || []).filter((m) => m.is_active);
    const { room_members, ...rest } = r;
    return {
      ...rest,
      active_members_count: activeMembers.length,
      members_count: activeMembers.length,
    };
  });

  return {
    rooms: formattedRooms,
    count,
    limit,
    remaining,
  };
}

/**
 * Helper: Find room by UUID or 6-character Code
 */
async function findRoomByIdOrCode(identifier) {
  if (!identifier) return null;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

  let query = supabaseAdmin.from('rooms').select('*');
  if (isUuid) {
    query = query.eq('id', identifier);
  } else {
    query = query.eq('code', identifier.toUpperCase().trim());
  }

  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;
  return data;
}

/**
 * Validate if a user has access to a room (is creator or active member)
 */
async function validateRoomAccess(userId, roomId) {
  if (!userId || !roomId) return false;

  const room = await findRoomByIdOrCode(roomId);
  if (!room) return false;
  if (room.created_by === userId) return true;

  const { data: member } = await supabaseAdmin
    .from('room_members')
    .select('id')
    .eq('room_id', room.id)
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  return Boolean(member);
}

/**
 * Ensure user exists in public.users before DB operations with foreign keys
 */
async function ensureUserInPublicTable(userId, fallbackUser = null) {
  if (!userId) return;
  try {
    const { data: userExists } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (!userExists) {
      let email = fallbackUser?.email;
      let name = fallbackUser?.user_metadata?.name ||
                 fallbackUser?.user_metadata?.user_name ||
                 fallbackUser?.user_metadata?.full_name ||
                 fallbackUser?.email?.split('@')[0];

      if (!email) {
        const { data: authUserData } = await supabaseAdmin.auth.admin.getUserById(userId);
        email = authUserData?.user?.email || `user_${userId.slice(0, 8)}@codeo.dev`;
        name = name || authUserData?.user?.user_metadata?.name ||
               authUserData?.user?.user_metadata?.user_name ||
               authUserData?.user?.user_metadata?.full_name ||
               email.split('@')[0];
      }

      await supabaseAdmin.from('users').upsert({
        id: userId,
        email,
        name: name || 'User',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
    }
  } catch (err) {
    console.warn('ensureUserInPublicTable note:', err.message);
  }
}

/**
 * Create a new room in the database
 * Validates user room limit (< 10), generates unique code + invite token, and adds user as host
 */
async function createRoom({ title, description, language = 'javascript', userId }) {
  if (!userId) {
    throw new AppError('Authentication required to create a room.', 401, 'UNAUTHORIZED');
  }

  const cleanTitle = (title || '').trim();
  if (!cleanTitle) {
    throw new AppError('Room title is required.', 400, 'INVALID_TITLE');
  }
  if (cleanTitle.length > 255) {
    throw new AppError('Room title must be 255 characters or less.', 400, 'TITLE_TOO_LONG');
  }

  // Ensure user exists in public.users to satisfy rooms_created_by_fkey
  await ensureUserInPublicTable(userId);

  // Validate room limit (throws if >= 10)
  await checkUserRoomLimit(userId);

  const code = await getUniqueRoomCode();
  const inviteToken = await getUniqueInviteToken();

  const { data: room, error: roomError } = await supabaseAdmin
    .from('rooms')
    .insert({
      code,
      invite_token: inviteToken,
      title: cleanTitle,
      description: (description || '').trim() || null,
      language: (language || 'javascript').toLowerCase().trim(),
      created_by: userId,
      code_content: '',
      is_locked: false,
      is_archived: false,
    })
    .select()
    .single();

  if (roomError || !room) {
    throw new AppError('Failed to create room: ' + (roomError?.message || 'Database error'), 500, 'ROOM_CREATION_FAILED');
  }

  // Add creator to room_members as 'host'
  const { error: memberError } = await supabaseAdmin
    .from('room_members')
    .insert({
      room_id: room.id,
      user_id: userId,
      role: 'host',
      can_edit: true,
      is_muted: false,
      is_active: true,
    });

  if (memberError) {
    console.warn('Warning: Failed to add host to room_members:', memberError.message);
  }

  // Log activity
  try {
    await supabaseAdmin.from('room_activity_log').insert({
      room_id: room.id,
      user_id: userId,
      action: 'room_created',
      details: { title: cleanTitle, language: room.language },
    });
  } catch (logErr) {
    console.warn('Activity log note:', logErr.message);
  }

  return {
    ...room,
    code: room.code,
    invite_token: room.invite_token,
  };
}

/**
 * Retrieve public room information and active members list by 6-char code, invite token, or UUID
 */
async function getRoomByCode(code) {
  if (!code) {
    throw new AppError('Room code is required.', 400, 'CODE_REQUIRED');
  }

  const cleanInput = String(code).trim();
  const upperCode = cleanInput.toUpperCase();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanInput);

  let query = supabaseAdmin
    .from('rooms')
    .select(`
      id,
      code,
      invite_token,
      title,
      description,
      language,
      code_content,
      is_locked,
      created_at,
      updated_at,
      created_by
    `);

  if (isUuid) {
    query = query.eq('id', cleanInput);
  } else if (cleanInput.length === 32) {
    query = query.eq('invite_token', cleanInput);
  } else {
    query = query.eq('code', upperCode);
  }

  let { data: room, error } = await query.maybeSingle();

  // If not found by primary branch, try fallback across code and invite_token
  if (!room && !isUuid) {
    const { data: fallbackRoom } = await supabaseAdmin
      .from('rooms')
      .select(`
        id,
        code,
        invite_token,
        title,
        description,
        language,
        code_content,
        is_locked,
        created_at,
        updated_at,
        created_by
      `)
      .or(`code.eq.${upperCode},invite_token.eq.${cleanInput}`)
      .maybeSingle();
    room = fallbackRoom;
  }

  if (error || !room) {
    throw new AppError('Room not found.', 404, 'ROOM_NOT_FOUND');
  }

  // Fetch host user details
  const { data: hostUser } = await supabaseAdmin
    .from('users')
    .select('id, name, email')
    .eq('id', room.created_by)
    .maybeSingle();

  // Fetch active members list
  const { data: members } = await supabaseAdmin
    .from('room_members')
    .select(`
      id,
      user_id,
      anonymous_name,
      role,
      can_edit,
      is_muted,
      is_active,
      joined_at,
      users (
        id,
        name,
        email
      )
    `)
    .eq('room_id', room.id)
    .eq('is_active', true)
    .order('joined_at', { ascending: true });

  const formattedMembers = (members || []).map((m) => ({
    id: m.id,
    user_id: m.user_id,
    name: m.users?.name || m.anonymous_name || 'Coder',
    email: m.users?.email || null,
    role: m.role,
    can_edit: m.can_edit,
    is_muted: m.is_muted,
    joined_at: m.joined_at,
  }));

  return {
    ...room,
    host: hostUser || { id: room.created_by, name: 'Host' },
    members: formattedMembers,
  };
}

/**
 * Add an authenticated user as a member to a room by room code, invite token, or UUID
 * Validates user is not already an active member/host
 */
async function joinRoom(code, user) {
  if (!user || !user.id) {
    throw new AppError('Authentication required to join room.', 401, 'UNAUTHORIZED');
  }

  if (!code) {
    throw new AppError('Room code is required.', 400, 'CODE_REQUIRED');
  }

  const cleanInput = String(code).trim();
  const upperCode = cleanInput.toUpperCase();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanInput);

  let query = supabaseAdmin.from('rooms').select('*');
  if (isUuid) {
    query = query.eq('id', cleanInput);
  } else if (cleanInput.length === 32) {
    query = query.eq('invite_token', cleanInput);
  } else {
    query = query.eq('code', upperCode);
  }

  let { data: room, error } = await query.maybeSingle();

  if (!room && !isUuid) {
    const { data: fallbackRoom } = await supabaseAdmin
      .from('rooms')
      .select('*')
      .or(`code.eq.${upperCode},invite_token.eq.${cleanInput}`)
      .maybeSingle();
    room = fallbackRoom;
  }

  if (error || !room) {
    throw new AppError('Room not found.', 404, 'ROOM_NOT_FOUND');
  }

  if (room.is_locked) {
    throw new AppError('This room is currently locked and not accepting new members.', 403, 'ROOM_LOCKED');
  }

  // Ensure user exists in public.users to satisfy room_members_user_id_fkey
  await ensureUserInPublicTable(user.id, user);

  // Validate user is not already active member or host
  const { data: existingMember } = await supabaseAdmin
    .from('room_members')
    .select('*')
    .eq('room_id', room.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existingMember) {
    if (existingMember.is_active) {
      throw new AppError('User already host/member of room.', 400, 'ALREADY_MEMBER');
    }

    // Reactivate previous membership
    const { error: updateErr } = await supabaseAdmin
      .from('room_members')
      .update({
        is_active: true,
        kicked_at: null,
        joined_at: new Date().toISOString(),
      })
      .eq('id', existingMember.id);

    if (updateErr) {
      throw new AppError('Failed to rejoin room: ' + updateErr.message, 500, 'DB_ERROR');
    }
  } else {
    // Add new member
    const { error: insertErr } = await supabaseAdmin
      .from('room_members')
      .insert({
        room_id: room.id,
        user_id: user.id,
        role: room.created_by === user.id ? 'host' : 'member',
        can_edit: true,
        is_active: true,
      });

    if (insertErr) {
      throw new AppError('Failed to join room: ' + insertErr.message, 500, 'DB_ERROR');
    }
  }

  // Log activity
  try {
    await supabaseAdmin.from('room_activity_log').insert({
      room_id: room.id,
      user_id: user.id,
      user_name: user.profile?.name || user.email?.split('@')[0] || 'User',
      action: 'user_joined',
    });
  } catch (logErr) {
    console.warn('Activity log note:', logErr.message);
  }

  return await getRoomByCode(room.code);
}

/**
 * Remove an authenticated user from a room
 * If host leaves: transfers host role to the first other active member
 */
async function leaveRoom(identifier, userId) {
  if (!userId) {
    throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
  }

  const room = await findRoomByIdOrCode(identifier);
  if (!room) {
    throw new AppError('Room not found.', 404, 'ROOM_NOT_FOUND');
  }

  // Find user's active membership
  const { data: member } = await supabaseAdmin
    .from('room_members')
    .select('*')
    .eq('room_id', room.id)
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (!member) {
    throw new AppError('User is not an active member of this room.', 400, 'NOT_A_MEMBER');
  }

  const isHost = member.role === 'host' || room.created_by === userId;

  if (isHost) {
    // Find the first other active member ordered by joined_at ASC
    const { data: nextMembers } = await supabaseAdmin
      .from('room_members')
      .select('*')
      .eq('room_id', room.id)
      .eq('is_active', true)
      .neq('user_id', userId)
      .order('joined_at', { ascending: true })
      .limit(1);

    if (nextMembers && nextMembers.length > 0) {
      const nextHost = nextMembers[0];
      // Transfer host role to the next member
      await supabaseAdmin
        .from('room_members')
        .update({ role: 'host' })
        .eq('id', nextHost.id);

      if (nextHost.user_id) {
        await supabaseAdmin
          .from('rooms')
          .update({ created_by: nextHost.user_id })
          .eq('id', room.id);
      }

      try {
        await supabaseAdmin.from('room_activity_log').insert({
          room_id: room.id,
          user_id: userId,
          action: 'host_transferred',
          target_user_id: nextHost.user_id,
          details: { new_host: nextHost.user_id },
        });
      } catch (logErr) {
        console.warn('Activity log note:', logErr.message);
      }
    }
  }

  // Deactivate leaving member
  await supabaseAdmin
    .from('room_members')
    .update({
      is_active: false,
      kicked_at: new Date().toISOString(),
    })
    .eq('id', member.id);

  // Log activity
  try {
    await supabaseAdmin.from('room_activity_log').insert({
      room_id: room.id,
      user_id: userId,
      action: 'user_left',
    });
  } catch (logErr) {
    console.warn('Activity log note:', logErr.message);
  }

  return { success: true, message: 'Successfully left room.' };
}

/**
 * Delete a room permanently (requires user to be the host)
 */
async function deleteRoom(identifier, userId) {
  if (!userId) {
    throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
  }

  const room = await findRoomByIdOrCode(identifier);
  if (!room) {
    throw new AppError('Room not found.', 404, 'ROOM_NOT_FOUND');
  }

  // Verify host ownership
  const isHost = room.created_by === userId;
  if (!isHost) {
    const { data: member } = await supabaseAdmin
      .from('room_members')
      .select('role')
      .eq('room_id', room.id)
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (member?.role !== 'host') {
      throw new AppError('Only the room host can delete this room.', 403, 'FORBIDDEN');
    }
  }

  // 1. Explicitly cascade delete all associated records to ensure clean deletion
  try {
    await supabaseAdmin.from('room_members').delete().eq('room_id', room.id);
  } catch (e) {
    console.warn('[deleteRoom] Note deleting room_members:', e.message);
  }

  try {
    await supabaseAdmin.from('room_activity_log').delete().eq('room_id', room.id);
  } catch (e) {
    console.warn('[deleteRoom] Note deleting room_activity_log:', e.message);
  }

  try {
    await supabaseAdmin.from('code_history').delete().eq('room_id', room.id);
  } catch (e) {
    console.warn('[deleteRoom] Note deleting code_history:', e.message);
  }

  try {
    await supabaseAdmin.from('ai_chat_history').delete().eq('room_id', room.id);
  } catch (e) {
    console.warn('[deleteRoom] Note deleting ai_chat_history:', e.message);
  }

  try {
    await supabaseAdmin.from('room_ai_chat').delete().eq('room_id', room.id);
  } catch (e) {
    // Optional table
  }

  // 2. Finally delete the room itself
  const { error } = await supabaseAdmin
    .from('rooms')
    .delete()
    .eq('id', room.id);

  if (error) {
    throw new AppError('Failed to delete room: ' + error.message, 500, 'DB_ERROR');
  }

  return { success: true, message: 'Room and all associated data deleted successfully.' };
}

/**
 * Update room metadata or content (requires host)
 */
async function updateRoom(identifier, userId, updates = {}) {
  if (!userId) {
    throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
  }

  const room = await findRoomByIdOrCode(identifier);
  if (!room) {
    throw new AppError('Room not found.', 404, 'ROOM_NOT_FOUND');
  }

  // Verify host ownership
  const isHost = room.created_by === userId;
  if (!isHost) {
    const { data: member } = await supabaseAdmin
      .from('room_members')
      .select('role')
      .eq('room_id', room.id)
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (member?.role !== 'host') {
      throw new AppError('Only the room host can update this room.', 403, 'FORBIDDEN');
    }
  }

  const allowedUpdates = {};
  if (updates.title !== undefined) {
    const cleanTitle = (updates.title || '').trim();
    if (!cleanTitle) {
      throw new AppError('Room title cannot be empty.', 400, 'INVALID_TITLE');
    }
    if (cleanTitle.length > 255) {
      throw new AppError('Room title must be 255 characters or less.', 400, 'TITLE_TOO_LONG');
    }
    allowedUpdates.title = cleanTitle;
  }

  if (updates.description !== undefined) {
    allowedUpdates.description = updates.description ? updates.description.trim() : null;
  }

  if (updates.language !== undefined) {
    allowedUpdates.language = updates.language.toLowerCase().trim();
  }

  if (updates.code_content !== undefined) {
    allowedUpdates.code_content = updates.code_content;
  }

  if (updates.is_locked !== undefined) {
    allowedUpdates.is_locked = Boolean(updates.is_locked);
  }

  if (Object.keys(allowedUpdates).length === 0) {
    throw new AppError('No valid fields provided for update.', 400, 'NO_UPDATES');
  }

  allowedUpdates.updated_at = new Date().toISOString();

  const { data: updatedRoom, error } = await supabaseAdmin
    .from('rooms')
    .update(allowedUpdates)
    .eq('id', room.id)
    .select()
    .single();

  if (error || !updatedRoom) {
    throw new AppError('Failed to update room: ' + error.message, 500, 'DB_ERROR');
  }

  return updatedRoom;
}

module.exports = {
  generateRoomCode,
  generateInviteToken,
  getUniqueRoomCode,
  getUniqueInviteToken,
  checkUserRoomLimit,
  getAllUserRooms,
  findRoomByIdOrCode,
  validateRoomAccess,
  createRoom,
  getRoomByCode,
  joinRoom,
  leaveRoom,
  deleteRoom,
  updateRoom,
};
