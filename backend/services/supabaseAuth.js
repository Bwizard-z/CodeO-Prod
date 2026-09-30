// services/supabaseAuth.js - Supabase Authentication Service
const { supabase, supabaseAdmin } = require('./supabase');
const { AppError, formatAuthError } = require('../utils/errorHandler');

/**
 * Register a new user with Email and Password
 * Supports display name metadata and syncs into public.users
 */
async function signUpWithEmail(email, password, name = '') {
  try {
    const redirectUrl = process.env.VITE_APP_URL
      ? `${process.env.VITE_APP_URL.replace(/\/+$/, '')}/verify-email`
      : 'http://localhost:5173/verify-email';

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          user_name: name,
          name: name,
        },
        emailRedirectTo: redirectUrl,
      },
    });

    if (error) {
      throw new AppError(formatAuthError(error), 400, 'SIGNUP_FAILED');
    }

    // Ensure user record exists in public.users (in case DB trigger is bypassed)
    if (data?.user) {
      try {
        await supabaseAdmin.from('users').upsert({
          id: data.user.id,
          email: data.user.email,
          name: name || data.user.email.split('@')[0],
          updated_at: new Date().toISOString(),
        }, { onConflict: 'email' });
      } catch (upsertErr) {
        console.warn('Note: public.users upsert fallback note:', upsertErr.message);
      }
    }

    const isVerified = Boolean(
      data?.user?.email_confirmed_at ||
      data?.user?.confirmed_at ||
      data?.session
    );

    return {
      user: data.user,
      session: data.session,
      isVerified,
      message: isVerified
        ? 'Account created successfully.'
        : 'Account created. Please check your email to verify your account.',
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(formatAuthError(err), 400, 'SIGNUP_ERROR');
  }
}

/**
 * Sign in an existing user with Email and Password
 */
async function signInWithEmail(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new AppError(formatAuthError(error), 401, 'INVALID_CREDENTIALS');
    }

    const isVerified = Boolean(
      data.user?.email_confirmed_at ||
      data.user?.confirmed_at ||
      data.user?.user_metadata?.email_verified === true
    );

    // Fetch database profile if available
    let dbUser = null;
    try {
      const { data: profile } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single();
      dbUser = profile;
    } catch {
      // Ignored
    }

    return {
      user: {
        ...data.user,
        profile: dbUser,
      },
      session: data.session,
      isVerified,
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(formatAuthError(err), 401, 'SIGNIN_ERROR');
  }
}

/**
 * Generate Google OAuth URL for browser login
 */
async function getGoogleOAuthUrl(redirectTo) {
  try {
    const targetUrl = redirectTo || (
      process.env.VITE_APP_URL
        ? `${process.env.VITE_APP_URL.replace(/\/+$/, '')}/auth/callback`
        : 'http://localhost:5173/auth/callback'
    );

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: targetUrl,
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      throw new AppError(formatAuthError(error), 400, 'OAUTH_URL_ERROR');
    }

    return { url: data.url };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(formatAuthError(err), 400, 'OAUTH_ERROR');
  }
}

/**
 * Exchange OAuth callback code for session tokens
 */
async function exchangeCodeForSession(code) {
  try {
    if (!code) {
      throw new AppError('Authorization code is required', 400, 'CODE_REQUIRED');
    }

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      throw new AppError(formatAuthError(error), 400, 'CODE_EXCHANGE_FAILED');
    }

    // Sync OAuth user into public.users
    if (data?.user) {
      try {
        const name = data.user.user_metadata?.user_name ||
                     data.user.user_metadata?.name ||
                     data.user.user_metadata?.full_name ||
                     data.user.email?.split('@')[0];

        await supabaseAdmin.from('users').upsert({
          id: data.user.id,
          email: data.user.email,
          name: name,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'email' });
      } catch (upsertErr) {
        console.warn('Note: OAuth public.users upsert note:', upsertErr.message);
      }
    }

    return {
      user: data.user,
      session: data.session,
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(formatAuthError(err), 400, 'OAUTH_EXCHANGE_ERROR');
  }
}

/**
 * Verify JWT token and retrieve the corresponding user
 */
async function verifyUserToken(token) {
  try {
    if (!token) {
      throw new AppError('Authentication token is required', 401, 'TOKEN_REQUIRED');
    }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      throw new AppError('Invalid or expired authentication token', 401, 'INVALID_TOKEN');
    }

    // Fetch database profile, auto-creating in public.users if missing
    let dbUser = null;
    try {
      const { data: profile } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      dbUser = profile;

      if (!dbUser && user.id && user.email) {
        const name = user.user_metadata?.user_name ||
                     user.user_metadata?.name ||
                     user.user_metadata?.full_name ||
                     user.email.split('@')[0] ||
                     'User';
        const { data: createdProfile } = await supabaseAdmin
          .from('users')
          .upsert({
            id: user.id,
            email: user.email,
            name: name,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' })
          .select()
          .single();
        dbUser = createdProfile;
      }
    } catch (syncErr) {
      console.warn('Auto-sync user profile warning:', syncErr.message);
    }

    return {
      ...user,
      profile: dbUser,
      isVerified: Boolean(
        user.email_confirmed_at ||
        user.confirmed_at ||
        user.user_metadata?.email_verified === true ||
        user.app_metadata?.provider === 'google'
      ),
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(formatAuthError(err), 401, 'TOKEN_VERIFICATION_FAILED');
  }
}

/**
 * Refresh an expired access token using refresh_token
 */
async function refreshSession(refreshToken) {
  try {
    if (!refreshToken) {
      throw new AppError('Refresh token is required', 400, 'REFRESH_TOKEN_REQUIRED');
    }

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data?.session) {
      throw new AppError('Failed to refresh session. Please sign in again.', 401, 'REFRESH_FAILED');
    }

    return {
      user: data.user,
      session: data.session,
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(formatAuthError(err), 401, 'REFRESH_ERROR');
  }
}

/**
 * Sign out / invalidate user session
 */
async function signOut(token) {
  try {
    if (token) {
      try {
        await supabaseAdmin.auth.admin.signOut(token);
      } catch {
        // Fallback
        await supabase.auth.signOut();
      }
    } else {
      await supabase.auth.signOut();
    }
    return { success: true, message: 'Logged out successfully.' };
  } catch (err) {
    console.warn('SignOut note:', err.message);
    return { success: true, message: 'Session cleared.' };
  }
}

/**
 * Resend email confirmation
 */
async function resendVerification(email) {
  try {
    if (!email) {
      throw new AppError('Email address is required', 400, 'EMAIL_REQUIRED');
    }

    const redirectUrl = process.env.VITE_APP_URL
      ? `${process.env.VITE_APP_URL.replace(/\/+$/, '')}/verify-email`
      : 'http://localhost:5173/verify-email';

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });

    if (error) {
      throw new AppError(formatAuthError(error), 400, 'RESEND_FAILED');
    }

    return { success: true, message: 'Verification email resent successfully.' };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(formatAuthError(err), 400, 'RESEND_ERROR');
  }
}

/**
 * Send password reset email
 */
async function resetPasswordForEmail(email) {
  try {
    if (!email) {
      throw new AppError('Email address is required', 400, 'EMAIL_REQUIRED');
    }

    const redirectUrl = process.env.VITE_APP_URL
      ? `${process.env.VITE_APP_URL.replace(/\/+$/, '')}/reset-password`
      : 'http://localhost:5173/reset-password';

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });

    if (error) {
      throw new AppError(formatAuthError(error), 400, 'RESET_FAILED');
    }

    return { success: true, message: 'Password reset link sent to your email.' };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(formatAuthError(err), 400, 'RESET_ERROR');
  }
}

module.exports = {
  signUpWithEmail,
  signInWithEmail,
  getGoogleOAuthUrl,
  exchangeCodeForSession,
  verifyUserToken,
  refreshSession,
  signOut,
  resendVerification,
  resetPasswordForEmail,
};
