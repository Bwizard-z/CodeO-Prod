// backend/routes/ai.js - AI Code Assistant Chat & History Endpoints
const express = require('express');
const router = express.Router();
const geminiService = require('../services/geminiService');
const { optionalAuth } = require('../middleware/verifyAuth');
const { createRateLimiter } = require('../middleware/rateLimiter');
const { supabaseAdmin } = require('../services/supabase');

// In-memory fallback history if database table is initializing or offline
const inMemoryHistory = new Map();

// Rate limiter: 20 AI chat requests per minute per user/IP
const aiChatLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 20,
  message: 'Too many AI assistant requests. Please wait a minute and try again.',
  keyGenerator: (req) => req.user?.id || req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown',
});

/**
 * Helper to resolve room ID from either UUID or room Code.
 */
async function resolveRoom(roomIdOrCode) {
  if (!roomIdOrCode) return { roomId: null, roomTitle: 'CodeO Room' };

  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roomIdOrCode);
    let query = supabaseAdmin.from('rooms').select('id, title');
    if (isUuid) {
      query = query.eq('id', roomIdOrCode);
    } else {
      query = query.eq('code', String(roomIdOrCode).toUpperCase().trim());
    }

    const { data: room, error } = await query.maybeSingle();
    if (room && !error) {
      return { roomId: room.id, roomTitle: room.title || 'CodeO Room' };
    }
  } catch (err) {
    console.warn('[AI Route] Room lookup warning:', err.message);
  }

  return { roomId: roomIdOrCode, roomTitle: 'CodeO Room' };
}

/**
 * POST /api/ai/chat
 * Send message to AI assistant and receive context-aware response
 */
router.post('/chat', optionalAuth, aiChatLimiter, async (req, res, next) => {
  try {
    const {
      message = '',
      selectedCode = '',
      code = '',
      language = 'javascript',
      roomId = null,
      chatHistory = [],
      history = [],
    } = req.body;

    const activeHistory = Array.isArray(chatHistory) && chatHistory.length > 0
      ? chatHistory
      : (Array.isArray(history) ? history : []);

    const activeCode = selectedCode || code || '';

    // Validate input
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Message required',
        isCodingRelated: false,
      });
    }

    if (!language) {
      return res.status(400).json({
        success: false,
        error: 'Language required',
        isCodingRelated: false,
      });
    }

    // Resolve room metadata for context
    const { roomId: resolvedRoomId, roomTitle } = await resolveRoom(roomId);

    // Generate AI response
    const response = await geminiService.generateAIResponse(
      message.trim(),
      activeCode ? String(activeCode).trim() : '',
      language ? String(language).toLowerCase().trim() : 'javascript',
      activeHistory,
      roomTitle
    );

    if (!response.success || response.isCodingRelated === false) {
      return res.status(400).json(response);
    }

    // Save chat interaction to database / in-memory history
    const userId = req.user?.id || null;
    const userName =
      req.user?.name ||
      req.user?.user_metadata?.user_name ||
      req.user?.user_metadata?.name ||
      req.user?.email?.split('@')[0] ||
      req.body.userName ||
      'Collaborator';

    const historyItem = {
      id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      room_id: resolvedRoomId || roomId || 'global',
      user_id: userId,
      user_name: userName,
      message: message.trim(),
      response: response.message,
      created_at: new Date().toISOString(),
    };

    // 1. In-memory store (instant fallback across room peers)
    const roomKey = String(resolvedRoomId || roomId || 'global');
    if (!inMemoryHistory.has(roomKey)) {
      inMemoryHistory.set(roomKey, []);
    }
    const memList = inMemoryHistory.get(roomKey);
    memList.push(historyItem);
    if (memList.length > 100) {
      memList.shift();
    }

    // 2. Supabase persistent store in room_ai_chat
    if (resolvedRoomId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resolvedRoomId)) {
      try {
        const { error: dbError } = await supabaseAdmin.from('room_ai_chat').insert([
          {
            room_id: resolvedRoomId,
            user_id: userId,
            user_name: userName,
            message: message.trim(),
            response: response.message,
            created_at: historyItem.created_at,
          },
        ]);
        if (dbError) {
          console.warn('[AI Route] DB room_ai_chat insert note:', dbError.message);
        }
      } catch (dbErr) {
        console.warn('[AI Route] DB persistence error:', dbErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: response.message,
      response: response.message,
      explanation: response.message,
      isCodingRelated: true,
      timestamp: response.timestamp || historyItem.created_at,
      tokens: response.tokens || 100,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/ai/history/:roomId
 * Load chat history for a given room
 */
router.get('/history/:roomId', optionalAuth, async (req, res, next) => {
  try {
    const { roomId } = req.params;
    if (!roomId) {
      return res.status(200).json({ success: true, history: [] });
    }

    const { roomId: resolvedRoomId } = await resolveRoom(roomId);
    const roomKey = String(resolvedRoomId || roomId);

    // Try Supabase first if valid UUID
    if (resolvedRoomId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resolvedRoomId)) {
      try {
        const { data, error } = await supabaseAdmin
          .from('room_ai_chat')
          .select('*')
          .eq('room_id', resolvedRoomId)
          .order('created_at', { ascending: true })
          .limit(100);

        if (!error && Array.isArray(data) && data.length > 0) {
          return res.status(200).json({ success: true, history: data });
        }
      } catch (err) {
        console.warn('[AI Route] room_ai_chat fetch note:', err.message);
      }
    }

    // Fallback to in-memory history
    const list = inMemoryHistory.get(roomKey) || inMemoryHistory.get(String(roomId)) || [];
    return res.status(200).json({ success: true, history: list });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ai/validate
 * Check if a question is coding-related
 */
router.post('/validate', optionalAuth, async (req, res, next) => {
  try {
    const { question = '' } = req.body;
    if (!question || typeof question !== 'string') {
      return res.status(400).json({
        isCodingRelated: false,
        error: 'Question string is required.',
      });
    }

    const isCoding = await geminiService.isCodingQuestion(question);
    return res.status(200).json({
      isCodingRelated: isCoding,
      question: question.trim(),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
