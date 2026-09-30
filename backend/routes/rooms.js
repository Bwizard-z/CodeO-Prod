const express = require('express');
const router = express.Router();
const roomService = require('../services/roomService');
const { verifyAuth, optionalAuth } = require('../middleware/verifyAuth');
const { AppError } = require('../utils/errorHandler');

// Reserved words that must never be treated as 6-character room codes
const RESERVED_ROOM_CODES = new Set([
  'user',
  'users',
  'my',
  'mine',
  'all',
  'list',
  'create',
  'join',
  'leave',
  'health',
]);

/**
 * 1. POST /api/rooms & /api/rooms/create
 * Requires: Authentication
 * Accept: title, description (optional), language
 * Validate: User has < 10 rooms
 * Action: Create room in DB, add user as host
 * Return: room object + code + invite_token
 */
router.post(['/', '/create'], verifyAuth, async (req, res, next) => {
  try {
    const { title, description, language } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      throw new AppError('Room title is required.', 400, 'INVALID_TITLE');
    }

    const room = await roomService.createRoom({
      title: title.trim(),
      description: description ? description.trim() : null,
      language: language || 'javascript',
      userId: req.user.id,
    });

    res.status(201).json({
      success: true,
      message: 'Room created successfully.',
      room,
      code: room.code,
      invite_token: room.invite_token,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 2. GET /api/rooms/user/rooms, /user, /my/rooms, /my-rooms, /my, /mine
 * (Defined before /:code so 'user'/'my' are not treated as room codes)
 * Uses optionalAuth: If authenticated, returns user's rooms.
 * If not authenticated, returns empty rooms array instead of failing.
 */
router.get(['/user/rooms', '/user', '/my/rooms', '/my-rooms', '/my', '/mine'], optionalAuth, async (req, res, next) => {
  try {
    if (!req.user?.id) {
      return res.status(200).json({
        success: true,
        rooms: [],
        count: 0,
        limit: 10,
        remaining: 10,
        authenticated: false,
      });
    }

    const result = await roomService.getAllUserRooms(req.user.id);
    res.status(200).json({
      success: true,
      rooms: result.rooms,
      count: result.count,
      limit: result.limit,
      remaining: result.remaining,
      authenticated: true,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 3. POST /api/rooms/:code/join & /api/rooms/join
 * Requires: Authentication
 * Accept: code in params or body
 * Validate: User not already member
 * Action: Add to room_members as 'member'
 * Return: room object
 */
router.post(['/:code/join', '/join'], verifyAuth, async (req, res, next) => {
  try {
    const code = req.params.code || req.body.code || req.body.roomCode || req.body.invite_token;
    if (!code) {
      throw new AppError('Room code is required to join.', 400, 'CODE_REQUIRED');
    }

    const room = await roomService.joinRoom(code, req.user);

    res.status(200).json({
      success: true,
      message: 'Joined room successfully.',
      room,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 4. POST /api/rooms/:id/leave & /api/rooms/leave
 * Requires: Authentication
 * Action: Remove from room_members
 * If host: Transfer host to first member
 * Return: success
 */
router.post(['/:id/leave', '/leave'], verifyAuth, async (req, res, next) => {
  try {
    const identifier = req.params.id || req.body.id || req.body.roomId || req.body.code;
    if (!identifier) {
      throw new AppError('Room ID or code is required.', 400, 'ROOM_ID_REQUIRED');
    }

    const result = await roomService.leaveRoom(identifier, req.user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * 5. DELETE /api/rooms/:id & /api/rooms/
 * Requires: Authentication + must be host
 * Action: Delete room permanently
 * Return: success
 */
router.delete(['/:id', '/'], verifyAuth, async (req, res, next) => {
  try {
    const identifier =
      req.params.id ||
      req.body.id ||
      req.body.roomId ||
      req.body.code ||
      req.query.id ||
      req.query.code;

    if (!identifier) {
      throw new AppError('Room ID or code is required.', 400, 'ROOM_ID_REQUIRED');
    }

    const result = await roomService.deleteRoom(identifier, req.user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * 6. PUT /api/rooms/:id & /api/rooms/
 * Requires: Authentication + must be host
 * Accept: title, description, language, code_content, is_locked
 * Action: Update room
 * Return: updated room
 */
router.put(['/:id', '/'], verifyAuth, async (req, res, next) => {
  try {
    const identifier =
      req.params.id ||
      req.body.id ||
      req.body.roomId ||
      req.body.code;

    if (!identifier) {
      throw new AppError('Room ID or code is required.', 400, 'ROOM_ID_REQUIRED');
    }

    const { title, description, language, code_content, is_locked } = req.body;
    const updatedRoom = await roomService.updateRoom(identifier, req.user.id, {
      title,
      description,
      language,
      code_content,
      is_locked,
    });

    res.status(200).json({
      success: true,
      message: 'Room updated successfully.',
      room: updatedRoom,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 7. GET /api/rooms/:code
 * No auth required (anyone can get room info)
 * Accept: room code, invite token, or UUID
 * Return: room info + members list
 * Error: 404 if not found
 */
router.get('/:code', async (req, res, next) => {
  try {
    const code = req.params.code;
    if (!code) {
      throw new AppError('Room code is required.', 400, 'CODE_REQUIRED');
    }

    // Bypass reserved keywords so they don't trigger room lookup
    if (RESERVED_ROOM_CODES.has(String(code).toLowerCase())) {
      return next();
    }

    const room = await roomService.getRoomByCode(code);

    res.status(200).json({
      success: true,
      room,
      members: room.members,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

