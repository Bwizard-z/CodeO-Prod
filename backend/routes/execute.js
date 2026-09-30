// routes/execute.js - Code execution routes with Judge0 integration
const express = require('express');
const router = express.Router();
const judge0Service = require('../services/judge0Service');
const { optionalAuth } = require('../middleware/verifyAuth');
const { supabaseAdmin } = require('../services/supabase');
const { broadcastCodeExecuted } = require('../socket');
const { executeLimiter } = require('../middleware/rateLimiter');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/execute
 * Executes code via Judge0, saves to code_history, and broadcasts to room via Socket.io
 */
router.post('/', executeLimiter, optionalAuth, async (req, res, next) => {
  const startTime = Date.now();
  try {
    const { code, language, roomId, stdin = '', userName: customUserName, anonymousSessionId } = req.body;

    // 1. Validate Code
    if (code === undefined || code === null || typeof code !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Code string is required for execution.',
      });
    }

    if (!code.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Code buffer cannot be empty.',
      });
    }

    // 2. Validate Language
    if (!language) {
      return res.status(400).json({
        success: false,
        error: 'Language parameter is required. Supported: JavaScript, Python, Java, C++',
      });
    }

    let langId = null;
    let canonicalLang = '';

    if (typeof language === 'number') {
      if (judge0Service.SUPPORTED_LANGUAGES[language]) {
        langId = language;
        canonicalLang = judge0Service.SUPPORTED_LANGUAGES[language];
      }
    } else if (typeof language === 'string') {
      const normalized = language.toLowerCase().trim();
      langId = judge0Service.LANGUAGE_MAP[normalized];
      if (langId) {
        canonicalLang = judge0Service.SUPPORTED_LANGUAGES[langId];
      }
    }

    if (!langId) {
      const supportedList = Object.values(judge0Service.SUPPORTED_LANGUAGES).join(', ');
      return res.status(400).json({
        success: false,
        error: `Language '${language}' is not supported. Supported languages: ${supportedList}`,
        code: 'LANGUAGE_NOT_SUPPORTED',
      });
    }

    // 3. User Identity
    const userId = req.user?.id || null;
    const userName =
      req.user?.name ||
      req.user?.user_metadata?.user_name ||
      customUserName ||
      (userId ? `User-${userId.slice(0, 5)}` : 'Anonymous');
    const timestamp = new Date().toISOString();

    // 4. Execute Code via Judge0
    const execResult = await judge0Service.submitCode(code, langId, stdin);
    const executionTimeMs = execResult.execution_time_ms || Math.max(1, Date.now() - startTime);

    // Map execution status for DB
    let executionStatus = 'success';
    if (execResult.status_id === 5) {
      executionStatus = 'timeout';
    } else if (execResult.status_id >= 7 && execResult.status_id <= 12) {
      executionStatus = 'runtime_error';
    } else if (execResult.error) {
      executionStatus = 'error';
    }

    // 5. Room Resolution & Save to code_history
    let resolvedRoomId = null;
    let cleanRoomCode = null;

    if (roomId && typeof roomId === 'string' && roomId.trim()) {
      const trimmedRoom = roomId.trim();
      if (UUID_REGEX.test(trimmedRoom)) {
        resolvedRoomId = trimmedRoom;
        try {
          const { data: roomData } = await supabaseAdmin
            .from('rooms')
            .select('id, code')
            .eq('id', resolvedRoomId)
            .maybeSingle();
          if (roomData) {
            cleanRoomCode = roomData.code;
          }
        } catch {}
      } else {
        // Room code lookup (e.g. 'ASRH8V')
        try {
          const { data: roomData } = await supabaseAdmin
            .from('rooms')
            .select('id, code')
            .eq('code', trimmedRoom.toUpperCase())
            .maybeSingle();
          if (roomData) {
            resolvedRoomId = roomData.id;
            cleanRoomCode = roomData.code;
          } else {
            cleanRoomCode = trimmedRoom.toUpperCase();
          }
        } catch {}
      }
    }

    // Persist to code_history table if room resolved
    if (resolvedRoomId) {
      try {
        await supabaseAdmin.from('code_history').insert({
          room_id: resolvedRoomId,
          user_id: userId,
          anonymous_session_id: anonymousSessionId || null,
          user_name: userName,
          code_content: code,
          language: canonicalLang,
          stdin: stdin || '',
          execution_output: execResult.output || '',
          execution_status: executionStatus,
          error_message: execResult.stderr || execResult.compile_output || null,
          execution_time_ms: executionTimeMs,
        });
      } catch (dbErr) {
        console.warn('[Execute Route] Failed to save code_history:', dbErr.message);
      }
    }

    // 6. Broadcast to room via Socket.io
    const broadcastTarget = cleanRoomCode || (roomId && roomId.length === 6 ? roomId.toUpperCase().trim() : null);
    if (broadcastTarget) {
      broadcastCodeExecuted(broadcastTarget, {
        output: execResult.output,
        language: canonicalLang,
        userName,
        timestamp,
        executionTime: executionTimeMs,
        error: execResult.error,
        userId,
      });
    }

    // 7. Return Response per requirements
    return res.status(200).json({
      success: !execResult.error,
      output: execResult.output,
      stderr: execResult.stderr,
      compile_output: execResult.compile_output,
      status_id: execResult.status_id,
      status_description: execResult.status_description,
      language: canonicalLang,
      timestamp,
      userId,
      executionTime: executionTimeMs,
      error: execResult.error,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/execute/languages
 * Returns supported languages and Judge0 IDs
 */
router.get('/languages', async (req, res, next) => {
  try {
    const languages = await judge0Service.getLanguages();
    const supported = [
      { id: 63, name: 'JavaScript', key: 'javascript' },
      { id: 71, name: 'Python', key: 'python' },
      { id: 62, name: 'Java', key: 'java' },
      { id: 54, name: 'C++', key: 'cpp' },
    ];

    return res.status(200).json({
      success: true,
      languages,
      supported,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/execute/history/:roomId
 * Returns last 10 code executions for the room
 */
router.get('/history/:roomId', optionalAuth, async (req, res, next) => {
  try {
    const { roomId } = req.params;

    if (!roomId) {
      return res.status(400).json({
        success: false,
        error: 'Room ID is required',
      });
    }

    let targetRoomId = roomId.trim();

    // If roomId is a 6-char code, find room UUID
    if (!UUID_REGEX.test(targetRoomId)) {
      const { data: room, error: roomErr } = await supabaseAdmin
        .from('rooms')
        .select('id')
        .eq('code', targetRoomId.toUpperCase())
        .maybeSingle();

      if (roomErr || !room) {
        return res.status(200).json({
          success: true,
          history: [],
        });
      }
      targetRoomId = room.id;
    }

    // Fetch last 10 executions
    const { data: historyRows, error: histErr } = await supabaseAdmin
      .from('code_history')
      .select('id, room_id, user_id, user_name, code_content, language, execution_output, execution_status, error_message, execution_time_ms, created_at')
      .eq('room_id', targetRoomId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (histErr) {
      return res.status(500).json({
        success: false,
        error: `Failed to fetch history: ${histErr.message}`,
      });
    }

    const history = (historyRows || []).map((row) => ({
      id: row.id,
      code: row.code_content,
      language: row.language,
      output: row.execution_output,
      status: row.execution_status,
      errorMessage: row.error_message,
      executionTimeMs: row.execution_time_ms,
      timestamp: row.created_at,
      userId: row.user_id,
      userName: row.user_name,
    }));

    return res.status(200).json({
      success: true,
      roomId: targetRoomId,
      count: history.length,
      history,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
