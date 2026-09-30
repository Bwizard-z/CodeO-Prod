// routes/auth.js - Authentication API Endpoints for CODEO
const express = require('express');
const router = express.Router();
const supabaseAuth = require('../services/supabaseAuth');
const { verifyAuth } = require('../middleware/verifyAuth');
const { authLimiter } = require('../middleware/rateLimiter');
const { AppError } = require('../utils/errorHandler');

// Email regex validation
const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

/**
 * POST /api/auth/signup
 * Register user with email, password, and display name
 */
router.post('/signup', authLimiter, async (req, res, next) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !EMAIL_REGEX.test(email)) {
      throw new AppError('Please provide a valid email address.', 400, 'INVALID_EMAIL');
    }

    if (!password) {
      throw new AppError('Password is required.', 400, 'PASSWORD_REQUIRED');
    }

    const hasMinLength = password.length >= 8;
    const hasUpper = /[A-Z]/.test(password);
    const hasNum = /[0-9]/.test(password);
    if (!hasMinLength || !hasUpper || !hasNum) {
      throw new AppError(
        'Password must be at least 8 characters with at least one uppercase letter and one number.',
        400,
        'WEAK_PASSWORD'
      );
    }

    const cleanName = (name || '').trim();
    if (!cleanName || cleanName.length < 2) {
      throw new AppError('Please provide your name (minimum 2 characters).', 400, 'INVALID_NAME');
    }

    const result = await supabaseAuth.signUpWithEmail(email.toLowerCase().trim(), password, cleanName);

    res.status(201).json({
      success: true,
      message: result.message,
      user: result.user,
      session: result.session,
      isVerified: result.isVerified,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/signin
 * Authenticate user with email and password
 */
router.post('/signin', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new AppError('Email and password are required.', 400, 'MISSING_CREDENTIALS');
    }

    const result = await supabaseAuth.signInWithEmail(email.toLowerCase().trim(), password);

    res.status(200).json({
      success: true,
      message: 'Sign in successful.',
      user: result.user,
      session: result.session,
      isVerified: result.isVerified,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/refresh
 * Refresh session tokens using refresh_token
 */
router.post('/refresh', async (req, res, next) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) {
      throw new AppError('refresh_token is required.', 400, 'REFRESH_TOKEN_REQUIRED');
    }

    const result = await supabaseAuth.refreshSession(refresh_token);

    res.status(200).json({
      success: true,
      message: 'Session refreshed successfully.',
      user: result.user,
      session: result.session,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me (or /api/auth/verify)
 * Retrieve current authenticated user profile
 */
router.get('/me', verifyAuth, (req, res) => {
  res.status(200).json({
    success: true,
    user: req.user,
  });
});

router.get('/verify', verifyAuth, (req, res) => {
  res.status(200).json({
    success: true,
    user: req.user,
  });
});

/**
 * POST /api/auth/logout (or /api/auth/signout)
 * Sign out and clear active session
 */
router.post('/logout', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    const result = await supabaseAuth.signOut(token);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/signout', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    const result = await supabaseAuth.signOut(token);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/google
 * Generate Google OAuth URL
 */
router.get('/google', async (req, res, next) => {
  try {
    const redirectTo = req.query.redirect_to;
    const result = await supabaseAuth.getGoogleOAuthUrl(redirectTo);
    res.status(200).json({
      success: true,
      url: result.url,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/callback
 * Exchange OAuth callback code for tokens
 */
router.post('/callback', async (req, res, next) => {
  try {
    const { code } = req.body;
    if (!code) {
      throw new AppError('OAuth authorization code is required.', 400, 'CODE_REQUIRED');
    }

    const result = await supabaseAuth.exchangeCodeForSession(code);
    res.status(200).json({
      success: true,
      message: 'OAuth authentication successful.',
      user: result.user,
      session: result.session,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/resend-verification
 * Resend account verification email
 */
router.post('/resend-verification', authLimiter, async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      throw new AppError('Email address is required.', 400, 'EMAIL_REQUIRED');
    }

    const result = await supabaseAuth.resendVerification(email.toLowerCase().trim());
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/reset-password
 * Send password reset email
 */
router.post('/reset-password', authLimiter, async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      throw new AppError('Email address is required.', 400, 'EMAIL_REQUIRED');
    }

    const result = await supabaseAuth.resetPasswordForEmail(email.toLowerCase().trim());
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
