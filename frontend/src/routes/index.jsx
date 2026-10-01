import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import PublicOnlyRoute from './PublicOnlyRoute';
import { useAuth } from '../hooks/useAuth';

// Pages
import Landing from '../pages/Landing';
import SignIn from '../pages/SignIn';
import SignUp from '../pages/SignUp';
import VerifyEmail from '../pages/VerifyEmail';
import ForgotPassword from '../pages/ForgotPassword';
import ResetPassword from '../pages/ResetPassword';
import Dashboard from '../pages/Dashboard';
import CreateRoom from '../pages/CreateRoom';
import EditorPage from '../pages/EditorPage';
import AuthCallback from '../pages/AuthCallback';
import Features from '../pages/Features';
import Feedback from '../pages/Feedback';
import HonestlyCodeo from '../pages/HonestlyCodeo';
import JoinRoom from '../pages/JoinRoom';

// Catch-all 404 handler that directs logged-in users to dashboard and guests to landing
function CatchAllRoute() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-3 select-none">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  return <Navigate to={isAuthenticated ? '/dashboard' : '/'} replace />;
}

export const AppRoutes = () => {
  return (
    <Routes>
      {/* Public Pages: ONLY accessible when NOT logged in. If logged in, redirects to /dashboard */}
      <Route
        path="/"
        element={
          <PublicOnlyRoute>
            <Landing />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/signin"
        element={
          <PublicOnlyRoute>
            <SignIn />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <PublicOnlyRoute>
            <SignUp />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicOnlyRoute>
            <ForgotPassword />
          </PublicOnlyRoute>
        }
      />

      {/* Verification & Recovery Pages */}
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/auth/callback" element={<AuthCallback />} />

      {/* Pages accessible to both logged-in and logged-out users */}
      <Route path="/features" element={<Features />} />
      <Route path="/feedback" element={<Feedback />} />
      {/* Unlisted route for owner/admin to view all feedback reviews */}
      <Route path="/honestlycodeo" element={<HonestlyCodeo />} />
      <Route path="/join" element={<JoinRoom />} />
      <Route path="/join-room" element={<JoinRoom />} />

      {/* Protected Routes (Auth + Email Verification Required) */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute requireVerified>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/create-room"
        element={
          <ProtectedRoute requireVerified>
            <CreateRoom />
          </ProtectedRoute>
        }
      />

      {/* Semi-Protected Routes (Allows both Authenticated and Anonymous Guests) */}
      <Route path="/room/:code" element={<EditorPage />} />
      <Route path="/editor/:code" element={<EditorPage />} />

      {/* Catch-all route */}
      <Route path="*" element={<CatchAllRoute />} />
    </Routes>
  );
};

export default AppRoutes;

