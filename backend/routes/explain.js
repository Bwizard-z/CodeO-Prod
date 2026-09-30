// backend/routes/explain.js - AI Code Explanation Endpoints
const express = require('express');
const router = express.Router();
const geminiService = require('../services/geminiService');
const { optionalAuth } = require('../middleware/verifyAuth');
const { explainLimiter } = require('../middleware/rateLimiter');

/**
 * POST /api/explain
 * Explain code snippet with AI (Gemini)
 * Optional authentication + Rate limited to 10 requests per minute per user/IP
 */
router.post('/', optionalAuth, explainLimiter, async (req, res, next) => {
  try {
    const { code = '', language = 'javascript', prompt = '' } = req.body;

    // Validate code input
    if (!code || typeof code !== 'string' || !code.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Code snippet is required and cannot be empty.',
        code: 'INVALID_CODE_INPUT',
      });
    }

    const result = await geminiService.explainCode({
      code: code.trim(),
      language: language ? String(language).toLowerCase().trim() : 'javascript',
      prompt: typeof prompt === 'string' ? prompt.trim() : '',
    });

    return res.status(200).json({
      success: true,
      explanation: result.explanation,
      language: result.language,
      timestamp: result.timestamp || new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
