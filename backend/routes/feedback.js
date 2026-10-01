// routes/feedback.js - Feedback API endpoint for user reviews, ratings, and issue reports
const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../services/supabase');
const { optionalAuth, verifyAuth } = require('../middleware/verifyAuth');
const { createRateLimiter } = require('../middleware/rateLimiter');
const { AppError } = require('../utils/errorHandler');

// Anti-spam limiter: 10 feedback submissions per 15 minutes per IP
const feedbackLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  message: 'You have submitted multiple feedback entries. Please wait a few minutes before submitting again.',
});

const VALID_CATEGORIES = new Set([
  'General Experience',
  'Feature Request',
  'UI & Dark Theme',
  'Code Editor & Sandbox',
  'Bug Report',
]);

const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

/**
 * POST /api/feedback (or /feedback)
 * Public endpoint with optional authentication.
 * Guests and authenticated users alike can submit platform feedback.
 */
router.post('/', feedbackLimiter, optionalAuth, async (req, res, next) => {
  try {
    const { name, email, rating, category, feedback, metadata } = req.body;

    // 1. Validation: Name
    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new AppError('Name is required.', 400, 'INVALID_NAME');
    }
    const cleanName = name.trim();
    if (cleanName.length > 255) {
      throw new AppError('Name must be under 255 characters.', 400, 'NAME_TOO_LONG');
    }

    // 2. Validation: Email
    if (!email || typeof email !== 'string' || !email.trim()) {
      throw new AppError('Email address is required.', 400, 'INVALID_EMAIL');
    }
    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(cleanEmail)) {
      throw new AppError('Please provide a valid email address.', 400, 'INVALID_EMAIL_FORMAT');
    }

    // 3. Validation: Rating (1 to 5 stars)
    const numericRating = Number(rating);
    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
      throw new AppError('Rating must be an integer between 1 and 5.', 400, 'INVALID_RATING');
    }

    // 4. Validation: Feedback Text
    if (!feedback || typeof feedback !== 'string' || feedback.trim().length < 5) {
      throw new AppError('Feedback must be at least 5 characters long.', 400, 'FEEDBACK_TOO_SHORT');
    }
    const cleanFeedback = feedback.trim();
    if (cleanFeedback.length > 5000) {
      throw new AppError('Feedback must not exceed 5000 characters.', 400, 'FEEDBACK_TOO_LONG');
    }

    // 5. Category sanitization
    const cleanCategory =
      category && typeof category === 'string' && VALID_CATEGORIES.has(category.trim())
        ? category.trim()
        : 'General Experience';

    // 6. Metadata enrichment (client agent, screen size, client IP)
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || null;
    const clientUserAgent = req.headers['user-agent'] || null;

    const enrichedMetadata = {
      ...(typeof metadata === 'object' && metadata !== null ? metadata : {}),
      ip: clientIp,
      userAgent: clientUserAgent,
      submittedVia: 'web',
    };

    // 7. Insert feedback record into Supabase
    const payload = {
      user_id: req.user?.id || null,
      name: cleanName,
      email: cleanEmail,
      rating: numericRating,
      category: cleanCategory,
      feedback: cleanFeedback,
      status: 'new',
      metadata: enrichedMetadata,
    };

    const { data, error } = await supabaseAdmin
      .from('feedback')
      .insert(payload)
      .select('id, name, email, rating, category, feedback, status, created_at')
      .single();

    if (error) {
      // Graceful error message if table hasn't been created yet in Supabase
      if (error.code === '42P01' || error.message?.includes('Could not find the table')) {
        console.error('[Feedback] Table public.feedback does not exist in Supabase database.');
        throw new AppError(
          'Feedback service database is being initialized. Please run the migration script in Supabase SQL editor.',
          503,
          'TABLE_NOT_FOUND'
        );
      }
      console.error('[Feedback] Database insertion error:', error);
      throw new AppError('Failed to record feedback. Please try again.', 500, 'DATABASE_ERROR');
    }

    return res.status(201).json({
      success: true,
      message: 'Thank you for your valuable feedback! We truly appreciate your support.',
      data,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/feedback
 * Fetch submitted feedbacks with optional filters (pagination, rating, category, status).
 */
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const { rating, category, status } = req.query;

    let query = supabaseAdmin
      .from('feedback')
      .select('id, user_id, name, email, rating, category, feedback, status, created_at', { count: 'exact' });

    // Optional query filters
    if (rating && !isNaN(rating)) {
      query = query.eq('rating', parseInt(rating, 10));
    }
    if (category && typeof category === 'string') {
      query = query.eq('category', category.trim());
    }
    if (status && typeof status === 'string') {
      query = query.eq('status', status.trim());
    }

    // Sort newest first with pagination
    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      if (error.code === '42P01' || error.message?.includes('Could not find the table')) {
        return res.json({ success: true, count: 0, data: [], note: 'Table public.feedback is not yet created.' });
      }
      throw new AppError('Failed to retrieve feedbacks.', 500, 'DATABASE_ERROR');
    }

    return res.json({
      success: true,
      count: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
      data: data || [],
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/feedback/stats
 * Aggregate metrics: Total count, average rating, star distributions
 */
router.get('/stats', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('view_feedback_summary').select('*').maybeSingle();

    if (error || !data) {
      // Fallback manual count if view doesn't exist
      const { data: rows, error: fetchErr } = await supabaseAdmin
        .from('feedback')
        .select('rating, status');

      if (fetchErr || !rows) {
        return res.json({
          success: true,
          stats: {
            total_feedbacks: 0,
            average_rating: 0,
            five_star_count: 0,
            four_star_count: 0,
            three_star_count: 0,
            two_star_count: 0,
            one_star_count: 0,
          },
        });
      }

      const total = rows.length;
      const sum = rows.reduce((acc, r) => acc + (r.rating || 0), 0);
      return res.json({
        success: true,
        stats: {
          total_feedbacks: total,
          average_rating: total ? parseFloat((sum / total).toFixed(2)) : 0,
          five_star_count: rows.filter((r) => r.rating === 5).length,
          four_star_count: rows.filter((r) => r.rating === 4).length,
          three_star_count: rows.filter((r) => r.rating === 3).length,
          two_star_count: rows.filter((r) => r.rating === 2).length,
          one_star_count: rows.filter((r) => r.rating === 1).length,
        },
      });
    }

    return res.json({
      success: true,
      stats: data,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
