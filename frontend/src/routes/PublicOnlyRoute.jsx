import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

/**
 * Route guard for routes that should ONLY be accessible when the user is NOT logged in
 * (e.g. Landing /, Sign In /signin, Sign Up /signup, Forgot Password /forgot-password).
 *
 * If the user is logged in:
 * - If their email is not verified: redirect to /verify-email
 * - Otherwise: redirect to /dashboard (or redirect query target if present)
 *
 * While session is loading: renders a dark spinner screen to avoid any flicker.
 */
export function PublicOnlyRoute({ children, allowUnverified = false }) {
  const { isAuthenticated, isEmailVerified, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-3 select-none">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
        <p className="font-serif italic text-sm text-neutral-400">Loading CodeO...</p>
      </div>
    );
  }

  if (isAuthenticated) {
    if (!isEmailVerified && !allowUnverified) {
      return <Navigate to="/verify-email" replace />;
    }

    // Check if there is a redirect target in the query parameters (e.g. ?redirect=/editor/ROOM123)
    const searchParams = new URLSearchParams(location.search);
    const redirectParam = searchParams.get('redirect');

    if (
      redirectParam &&
      redirectParam.startsWith('/') &&
      !redirectParam.startsWith('/signin') &&
      !redirectParam.startsWith('/signup') &&
      redirectParam !== '/'
    ) {
      return <Navigate to={redirectParam} replace />;
    }

    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default PublicOnlyRoute;
