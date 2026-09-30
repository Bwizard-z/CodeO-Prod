// services/agoraService.js - Agora RTC Token Service for Real-time Audio
const { RtcTokenBuilder, RtcRole } = require('agora-token');
const { AppError } = require('../utils/errorHandler');

// Agora Configuration from Environment Variables
const AGORA_APP_ID = process.env.AGORA_APP_ID || '';
const AGORA_APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE || '';
const DEFAULT_EXPIRATION_SECONDS = parseInt(process.env.AGORA_TOKEN_EXPIRATION || '3600', 10);

/**
 * Generate an Agora RTC token for real-time audio communication.
 * 
 * @param {string} roomCode - Room code / channel name
 * @param {string|number} userId - Unique identifier of the user (UUID, username, or integer UID)
 * @param {string} [role='audience'] - RTC role: 'publisher' | 'host' | 'audience' | 'subscriber'
 * @param {number} [expirationSeconds=3600] - Token expiration in seconds
 * @returns {string} RTC Token string
 */
function generateToken(roomCodeOrChannel, userId, role = 'publisher', expirationSeconds = DEFAULT_EXPIRATION_SECONDS) {
  // 1. Validate Channel / Room Code
  if (!roomCodeOrChannel || typeof roomCodeOrChannel !== 'string' || !roomCodeOrChannel.trim()) {
    throw new AppError('Channel name / room code is required to generate Agora token.', 400, 'ROOM_CODE_REQUIRED');
  }

  // 2. Validate User ID
  if (userId === undefined || userId === null || String(userId).trim() === '') {
    throw new AppError('User ID is required to generate Agora token.', 400, 'USER_ID_REQUIRED');
  }

  // 3. Validate Server Configuration
  if (!AGORA_APP_ID || !AGORA_APP_CERTIFICATE) {
    throw new AppError(
      'Agora credentials (AGORA_APP_ID and AGORA_APP_CERTIFICATE) are not configured on the server.',
      500,
      'AGORA_CONFIG_MISSING'
    );
  }

  const channelName = String(roomCodeOrChannel).trim();
  const uidStr = String(userId).trim();

  // 4. Determine RTC Role
  // 'publisher' / 'host' allows broadcasting audio; 'audience' / 'subscriber' is listen-only
  const normalizedRole = typeof role === 'string' ? role.toLowerCase().trim() : '';
  let rtcRole = RtcRole.PUBLISHER; // default to publisher for interactive voice
  if (normalizedRole === 'audience' || normalizedRole === 'subscriber' || role === 2) {
    rtcRole = RtcRole.SUBSCRIBER;
  }

  // 5. Expiration in seconds relative to current time (e.g. 3600 seconds = 1 hour)
  // IMPORTANT: agora-token buildTokenWithUid takes seconds-from-now (not a Unix epoch timestamp)
  const expireSeconds = Number.isInteger(Number(expirationSeconds)) && Number(expirationSeconds) > 0
    ? Number(expirationSeconds)
    : DEFAULT_EXPIRATION_SECONDS;

  try {
    // In Agora RTC Web SDK, client joins with an unsigned 32-bit integer (1 to 4294967295)
    // or 0 as wildcard.
    const isPureInteger = /^\d+$/.test(uidStr) && Number(uidStr) >= 0 && Number(uidStr) <= 4294967295;
    const numUid = isPureInteger ? Number(uidStr) : 0;

    const token = RtcTokenBuilder.buildTokenWithUid(
      AGORA_APP_ID,
      AGORA_APP_CERTIFICATE,
      channelName,
      numUid,
      rtcRole,
      expireSeconds,
      expireSeconds
    );

    if (!token) {
      throw new Error('Agora token generation returned an empty result.');
    }

    return token;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(`Failed to generate Agora token: ${err.message}`, 500, 'AGORA_TOKEN_FAILED');
  }
}

module.exports = {
  AGORA_APP_ID,
  AGORA_APP_CERTIFICATE,
  generateToken,
};
