import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelopeCircleCheck, faRotateRight, faArrowRight, faCheckCircle } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import codeoLogo from '../assets/Logo.png';

export const VerifyEmail = () => {
  const { user, isEmailVerified, resendVerificationEmail, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Email may come from auth state or navigation state from signup
  const emailParam = location.state?.email || user?.email || '';

  const [cooldown, setCooldown] = useState(0);
  const [resendStatus, setResendStatus] = useState({ type: '', message: '' });
  const [verifiedNow, setVerifiedNow] = useState(false);

  // If already verified on initial load, redirect immediately to dashboard
  useEffect(() => {
    if (!loading && isEmailVerified && !verifiedNow) {
      navigate('/dashboard', { replace: true });
    }
  }, [loading, isEmailVerified, verifiedNow, navigate]);

  // If newly verified via polling during this session, show success message then navigate
  useEffect(() => {
    if (verifiedNow) {
      const timer = setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [verifiedNow, navigate]);

  // If not authenticated and no email passed from signup, redirect to signin
  useEffect(() => {
    if (!loading && !isAuthenticated && !emailParam) {
      navigate('/signin', { replace: true });
    }
  }, [loading, isAuthenticated, emailParam, navigate]);

  // Periodic poll to check if user clicked confirmation link in email
  useEffect(() => {
    if (isEmailVerified || verifiedNow) return;

    const interval = setInterval(async () => {
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser?.email_confirmed_at || currentUser?.confirmed_at) {
          setVerifiedNow(true);
        }
      } catch {
        // Ignored during background polling
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [isEmailVerified, verifiedNow]);

  // Cooldown countdown timer for resend button
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleResend = async () => {
    if (cooldown > 0) return;
    setResendStatus({ type: '', message: '' });

    const result = await resendVerificationEmail(emailParam);
    if (result.success) {
      setResendStatus({
        type: 'success',
        message: 'Verification email resent! Please check your inbox and spam folder.',
      });
      setCooldown(60);
    } else {
      setResendStatus({
        type: 'error',
        message: result.error || 'Failed to resend verification email.',
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-3 select-none">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
        <p className="font-serif italic text-sm text-neutral-400">Loading CodeO...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-between selection:bg-[#fbff47] selection:text-black">
      <Navbar />

      <main className="flex-1 flex items-center justify-center py-12 px-4 select-none">
        <div className="w-full max-w-md mx-auto bg-[#080c14] border border-white/10 rounded-2xl p-8 shadow-2xl flex flex-col items-center text-center">
          {/* Logo */}
          <div className="mb-6">
            <img
              src={codeoLogo}
              alt="CodeO"
              className="h-12 w-auto mx-auto object-contain brightness-110"
            />
          </div>

          {verifiedNow ? (
            /* Email Confirmed State */
            <div className="space-y-4">
              <div className="w-16 h-16 rounded-full bg-[#22c55e]/20 border border-[#22c55e]/50 flex items-center justify-center mx-auto text-[#22c55e]">
                <FontAwesomeIcon icon={faCheckCircle} className="text-3xl" />
              </div>
              <h1 className="text-3xl font-serif italic text-white tracking-tight">
                Email Verified!
              </h1>
              <p className="text-neutral-300 font-sans text-sm">
                Your email has been confirmed successfully. Redirecting you to the dashboard...
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="bg-white text-black px-6 py-2.5 rounded-full font-sans font-semibold text-sm flex items-center gap-2 mx-auto hover:bg-neutral-200 transition-all shadow-md active:scale-95"
                >
                  <span>Go to Dashboard</span>
                  <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
                </button>
              </div>
            </div>
          ) : (
            /* Pending Verification State */
            <div className="space-y-5 w-full">
              <div className="w-16 h-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center mx-auto text-white">
                <FontAwesomeIcon icon={faEnvelopeCircleCheck} className="text-3xl" />
              </div>

              <div>
                <h1 className="text-3xl font-serif italic text-white tracking-tight">
                  Verify Your Email
                </h1>
                <p className="mt-2 text-neutral-400 font-sans text-xs">
                  We sent a verification link to:
                </p>
                <div className="mt-1 font-mono font-medium text-sm text-[#fbff47] break-all px-3 py-1 bg-white/5 rounded-lg border border-white/10">
                  {emailParam || 'your registered email'}
                </div>
              </div>

              <p className="text-neutral-300 font-sans text-xs leading-relaxed">
                Click the confirmation link inside the email to complete your setup and unlock full room creation capabilities.
              </p>

              {resendStatus.message && (
                <div
                  className={`p-3 rounded-lg text-xs font-sans ${
                    resendStatus.type === 'success'
                      ? 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-200'
                      : 'bg-red-950/80 border border-red-500/50 text-red-200'
                  }`}
                >
                  {resendStatus.message}
                </div>
              )}

              {/* Action: Resend Button */}
              <div className="pt-2 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0}
                  className="w-full bg-white text-black py-2.5 px-4 rounded-full font-sans font-semibold text-sm flex items-center justify-center gap-2 hover:bg-neutral-200 transition-all active:scale-95 shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <FontAwesomeIcon icon={faRotateRight} className={cooldown > 0 ? 'animate-spin' : ''} />
                  <span>
                    {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Verification Email'}
                  </span>
                </button>

                <Link
                  to="/signin"
                  className="text-xs font-sans text-neutral-400 hover:text-white transition-colors underline underline-offset-4"
                >
                  Not your email? Sign in with another account
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default VerifyEmail;
