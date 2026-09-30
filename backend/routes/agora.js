// routes/agora.js - Agora Audio RTC Token Routes
const express = require('express');
const router = express.Router();
const agoraService = require('../services/agoraService');
const roomService = require('../services/roomService');
const { optionalAuth } = require('../middleware/verifyAuth');
const { AppError } = require('../utils/errorHandler');

/**
 * POST & GET /api/agora/token & /api/agora/token/generate
 * Require: Optional Authentication (supports authenticated users & anonymous room collaborators)
 * Accept: roomCode (or channel/channelName), userId (or uid), role ('publisher' | 'audience')
 * Call: agoraService.generateToken()
 * Return: { success: true, token, roomCode, userId, appId, channelName }
 */
router.all(['/token', '/token/generate'], optionalAuth, async (req, res, next) => {
  try {
    // 1. Extract room/channel identifier from body or query
    const roomCodeInput =
      req.body?.roomCode ||
      req.body?.channelName ||
      req.body?.channel ||
      req.query?.roomCode ||
      req.query?.channelName ||
      req.query?.channel;

    if (!roomCodeInput || typeof roomCodeInput !== 'string' || !roomCodeInput.trim()) {
      throw new AppError('Room code / channel name is required.', 400, 'ROOM_CODE_REQUIRED');
    }

    let cleanCode = roomCodeInput.trim().toUpperCase();
    if (cleanCode.startsWith('CODEO-')) {
      cleanCode = cleanCode.replace(/^CODEO-/, '');
    }

    // 2. Extract or generate user identifier
    const targetUid = req.body?.uid || req.query?.uid;
    const targetUserId =
      targetUid ||
      req.body?.userId ||
      req.query?.userId ||
      req.user?.id ||
      `guest-${Math.random().toString(36).substring(2, 7)}`;

    // Default to publisher so voice call participants can speak
    const roleInput = req.body?.role || req.query?.role || 'publisher';

    // 3. Verify room exists in database
    const room = await roomService.findRoomByIdOrCode(cleanCode);
    if (!room) {
      throw new AppError('Room not found.', 404, 'ROOM_NOT_FOUND');
    }
    const roomCodeActual = (room.code ? room.code.toUpperCase() : cleanCode).trim();

    // Use clean uppercase room code as Agora channel name
    const channelName = roomCodeActual;

    // 4. Generate Agora RTC Token
    const token = agoraService.generateToken(channelName, targetUserId, roleInput);

    // 5. Return response
    return res.status(200).json({
      success: true,
      token,
      roomCode: roomCodeActual,
      userId: String(req.body?.userId || targetUserId),
      uid: targetUid || targetUserId,
      appId: agoraService.AGORA_APP_ID,
      channelName,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/agora/config
 * Returns public Agora App ID for client SDK initialization
 */
router.get('/config', (req, res) => {
  res.status(200).json({
    success: true,
    appId: agoraService.AGORA_APP_ID,
  });
});

module.exports = router;
