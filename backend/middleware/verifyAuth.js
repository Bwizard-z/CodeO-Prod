// middleware/verifyAuth.js - Supabase JWT verification and Room access middlewares
const { verifyUserToken } = require('../services/supabaseAuth');
const { AppError } = require('../utils/errorHandler');
const { supabaseAdmin } = require('../services/supabase');

/**
 * Standard JWT verification middleware
 * Extracts Bearer token, validates it against Supabase, and attaches req.user
 */
async function verifyAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authorization token required (Bearer <token>)', 401, 'UNAUTHORIZED');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new AppError('Bearer token is missing', 401, 'TOKEN_MISSING');
    }

    const user = await verifyUserToken(token);
    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Middleware to enforce that user has verified their email address
 */
function requireVerified(req, res, next) {
  if (!req.user) {
    return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
  }

  if (!req.user.isVerified) {
    return next(new AppError('Email verification required to access this resource', 403, 'EMAIL_NOT_VERIFIED'));
  }

  next();
}

/**
 * Optional authentication middleware
 * Attaches user to req.user if a valid token is present, but allows guests if not
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (token) {
        try {
          const user = await verifyUserToken(token);
          req.user = user;
          req.token = token;
        } catch {
          // If token verification fails in optional mode, proceed as guest
          req.user = null;
        }
      }
    }
    next();
  } catch {
    next();
  }
}

/**
 * Middleware: Verify that authenticated user is the host of the room
 * Checks room by req.params.id or req.params.code
 */
async function requireRoomHost(req, res, next) {
  try {
    if (!req.user || !req.user.id) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const identifier = req.params.id || req.params.code;
    if (!identifier) {
      throw new AppError('Room identifier is required', 400, 'ROOM_ID_REQUIRED');
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    let query = supabaseAdmin.from('rooms').select('*');
    if (isUuid) {
      query = query.eq('id', identifier);
    } else {
      query = query.eq('code', identifier.toUpperCase().trim());
    }

    const { data: room, error } = await query.maybeSingle();
    if (error || !room) {
      throw new AppError('Room not found', 404, 'ROOM_NOT_FOUND');
    }

    // Check creator or member host role
    const isHost = room.created_by === req.user.id;
    if (!isHost) {
      const { data: member } = await supabaseAdmin
        .from('room_members')
        .select('role')
        .eq('room_id', room.id)
        .eq('user_id', req.user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (member?.role !== 'host') {
        throw new AppError('Only the room host can perform this action', 403, 'FORBIDDEN');
      }
    }

    req.room = room;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Middleware: Verify that user has access to the room (is host or active member)
 */
async function requireRoomAccess(req, res, next) {
  try {
    if (!req.user || !req.user.id) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const identifier = req.params.id || req.params.code;
    if (!identifier) {
      throw new AppError('Room identifier is required', 400, 'ROOM_ID_REQUIRED');
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    let query = supabaseAdmin.from('rooms').select('*');
    if (isUuid) {
      query = query.eq('id', identifier);
    } else {
      query = query.eq('code', identifier.toUpperCase().trim());
    }

    const { data: room, error } = await query.maybeSingle();
    if (error || !room) {
      throw new AppError('Room not found', 404, 'ROOM_NOT_FOUND');
    }

    if (room.created_by === req.user.id) {
      req.room = room;
      return next();
    }

    const { data: member } = await supabaseAdmin
      .from('room_members')
      .select('*')
      .eq('room_id', room.id)
      .eq('user_id', req.user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!member) {
      throw new AppError('You do not have access to this room', 403, 'ACCESS_DENIED');
    }

    req.room = room;
    req.roomMember = member;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  verifyAuth,
  requireVerified,
  optionalAuth,
  requireRoomHost,
  requireRoomAccess,
};
