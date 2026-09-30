import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';

export const AuthContext = createContext(null);

// Convert technical Supabase error strings to friendly UI messages
export function formatAuthError(err) {
  if (!err) return '';
  const message = typeof err === 'string' ? err : err.message || '';
  const lower = message.toLowerCase();

  if (lower.includes('invalid login credentials') || lower.includes('invalid grant')) {
    return 'Invalid email or password.';
  }
  if (lower.includes('user already registered') || lower.includes('already exists')) {
    return 'This email is already registered. Please sign in instead.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Your email has not been verified yet. Please check your inbox.';
  }
  if (lower.includes('password should be at least') || lower.includes('weak password')) {
    return 'Password must be at least 8 characters with uppercase and number.';
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'Too many attempts. Please wait a few moments and try again.';
  }
  if (lower.includes('network') || lower.includes('fetch')) {
    return 'Network connection issue. Please check your connection and try again.';
  }
  return message || 'An unexpected error occurred. Please try again.';
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Restore session on mount and listen to state changes
  useEffect(() => {
    let mounted = true;

    const restoreSession = async () => {
      try {
        const { data, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr) throw sessionErr;

        if (mounted) {
          setSession(data.session);
          setUser(data.session?.user ?? null);
        }
      } catch (err) {
        if (mounted) {
          console.warn('Session restoration note:', err.message);
          setError(formatAuthError(err));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    restoreSession();

    // Listen for auth state changes (sign in, sign out, token refresh, email confirm)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        if (mounted) {
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  // Compute email verification status
  const isEmailVerified = useMemo(() => {
    if (!user) return false;
    return Boolean(
      user.email_confirmed_at ||
      user.confirmed_at ||
      user.user_metadata?.email_verified === true ||
      user.app_metadata?.provider === 'google'
    );
  }, [user]);

  // Auth Methods
  const signUp = async (email, password, name = '') => {
    setError(null);
    try {
      const redirectUrl = `${import.meta.env.VITE_APP_URL || window.location.origin}/verify-email`;
      const { data, error: signErr } = await supabase.auth.signUp({
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

      if (signErr) throw signErr;
      return { success: true, data };
    } catch (err) {
      const friendly = formatAuthError(err);
      setError(friendly);
      return { success: false, error: friendly };
    }
  };

  const signIn = async (email, password) => {
    setError(null);
    try {
      const { data, error: signErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signErr) throw signErr;
      return { success: true, data };
    } catch (err) {
      const friendly = formatAuthError(err);
      setError(friendly);
      return { success: false, error: friendly };
    }
  };

  const signInWithGoogle = async () => {
    setError(null);
    try {
      const redirectUrl = `${import.meta.env.VITE_APP_URL || window.location.origin}/auth/callback`;
      const { data, error: oAuthErr } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (oAuthErr) throw oAuthErr;
      return { success: true, data };
    } catch (err) {
      const friendly = formatAuthError(err);
      setError(friendly);
      return { success: false, error: friendly };
    }
  };

  const signOut = async () => {
    setError(null);
    try {
      const { error: signErr } = await supabase.auth.signOut();
      if (signErr) throw signErr;
      setUser(null);
      setSession(null);
      return { success: true };
    } catch (err) {
      const friendly = formatAuthError(err);
      setError(friendly);
      return { success: false, error: friendly };
    }
  };

  const resendVerificationEmail = async (targetEmail) => {
    setError(null);
    const emailToUse = targetEmail || user?.email;
    if (!emailToUse) {
      return { success: false, error: 'No email address available to resend.' };
    }

    try {
      const redirectUrl = `${import.meta.env.VITE_APP_URL || window.location.origin}/verify-email`;
      // Supabase v2 resend verification method
      const { data, error: resendErr } = await supabase.auth.resend({
        type: 'signup',
        email: emailToUse,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (resendErr) throw resendErr;
      return { success: true, data };
    } catch (err) {
      const friendly = formatAuthError(err);
      setError(friendly);
      return { success: false, error: friendly };
    }
  };

  const resetPassword = async (email) => {
    setError(null);
    try {
      const redirectUrl = `${import.meta.env.VITE_APP_URL || window.location.origin}/reset-password`;
      const { data, error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (resetErr) throw resetErr;
      return { success: true, data };
    } catch (err) {
      const friendly = formatAuthError(err);
      setError(friendly);
      return { success: false, error: friendly };
    }
  };

  const updatePassword = async (newPassword) => {
    setError(null);
    try {
      const { data, error: updateErr } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateErr) throw updateErr;
      return { success: true, data };
    } catch (err) {
      const friendly = formatAuthError(err);
      setError(friendly);
      return { success: false, error: friendly };
    }
  };

  const updateProfile = async ({ name, avatar_url }) => {
    setError(null);
    try {
      const updates = {};
      if (name !== undefined) {
        updates.user_name = name;
        updates.name = name;
      }
      if (avatar_url !== undefined) {
        updates.avatar_url = avatar_url;
        updates.picture = avatar_url;
      }

      const { data, error: updateErr } = await supabase.auth.updateUser({
        data: updates,
      });

      if (updateErr) throw updateErr;
      if (data?.user) {
        setUser(data.user);
      }
      return { success: true, data };
    } catch (err) {
      const friendly = formatAuthError(err);
      setError(friendly);
      return { success: false, error: friendly };
    }
  };

  const value = {
    user,
    session,
    loading,
    error,
    isAuthenticated: Boolean(session || user),
    isEmailVerified,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    resendVerificationEmail,
    resetPassword,
    updatePassword,
    updateProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
