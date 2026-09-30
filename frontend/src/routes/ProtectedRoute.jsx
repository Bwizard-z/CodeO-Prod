import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function ProtectedRoute({ children, requireVerified = false }) {
  const { isAuthenticated, isEmailVerified, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-3 select-none">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
        <p className="font-serif italic text-sm text-neutral-400">Loading session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={`/signin?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }

  if (requireVerified && !isEmailVerified) {
    return <Navigate to="/verify-email" replace />;
  }

  return children ? children : <Outlet />;
}

export default ProtectedRoute;
