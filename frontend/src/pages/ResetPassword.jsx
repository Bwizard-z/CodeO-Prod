import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faKey, faArrowRight, faCheckCircle } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../hooks/useAuth';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import codeoLogo from '../assets/Logo.png';

export const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const { updatePassword } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password || !confirmPassword) {
      setErrorMsg('Please enter and confirm your new password.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    // Password strength: min 8 chars, uppercase and number
    const hasMinLength = password.length >= 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    if (!hasMinLength || !hasUpperCase || !hasNumber) {
      setErrorMsg('Password must be at least 8 characters and contain at least one uppercase letter and one number.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg('');
      const result = await updatePassword(password);
      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          navigate('/signin', { replace: true });
        }, 2500);
      } else {
        setErrorMsg(result.error || 'Failed to update password. Your reset link may have expired.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-between selection:bg-[#fbff47] selection:text-black">
      <Navbar />

      <main className="flex-1 flex items-center justify-center py-12 px-4 select-none">
        <div className="w-full max-w-md mx-auto bg-[#080c14] border border-white/10 rounded-2xl p-8 shadow-2xl flex flex-col items-center text-center">
          <div className="mb-6">
            <img
              src={codeoLogo}
              alt="CodeO"
              className="h-12 w-auto mx-auto object-contain brightness-110"
            />
          </div>

          {success ? (
            <div className="space-y-4">
              <div className="w-16 h-16 rounded-full bg-[#22c55e]/20 border border-[#22c55e]/50 flex items-center justify-center mx-auto text-[#22c55e]">
                <FontAwesomeIcon icon={faCheckCircle} className="text-3xl" />
              </div>
              <h1 className="text-3xl font-serif italic text-white tracking-tight">
                Password Updated!
              </h1>
              <p className="text-neutral-300 font-sans text-xs">
                Your password has been reset successfully. Redirecting you to sign in...
              </p>
              <div className="pt-4">
                <Link
                  to="/signin"
                  className="bg-white text-black px-6 py-2.5 rounded-full font-sans font-semibold text-sm inline-flex items-center gap-2 hover:bg-neutral-200 transition-all shadow-md active:scale-95"
                >
                  <span>Sign In Now</span>
                  <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="w-full space-y-5">
              <div>
                <h1 className="text-3xl font-serif italic text-white tracking-tight">
                  Set New Password
                </h1>
                <p className="mt-2 text-neutral-400 font-sans text-xs">
                  Create a new password of at least 8 characters with an uppercase letter and a number.
                </p>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-lg bg-red-950/80 border border-red-500/50 text-red-200 text-xs font-sans text-center">
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5 text-left">
                {/* New Password */}
                <div className="flex items-center gap-3.5 w-full">
                  <div className="text-white shrink-0 w-7 flex justify-center">
                    <FontAwesomeIcon icon={faKey} className="text-2xl" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter New Password"
                    required
                    className="w-full bg-white text-black px-4 py-3 rounded-md font-serif italic placeholder:font-serif placeholder:italic placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-400 text-base shadow-sm"
                  />
                </div>

                {/* Confirm Password */}
                <div className="flex items-center gap-3.5 w-full">
                  <div className="text-white shrink-0 w-7 flex justify-center">
                    <FontAwesomeIcon icon={faKey} className="text-2xl" />
                  </div>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm New Password"
                    required
                    className="w-full bg-white text-black px-4 py-3 rounded-md font-serif italic placeholder:font-serif placeholder:italic placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-400 text-base shadow-sm"
                  />
                </div>

                <div className="flex justify-center pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-white text-black pl-8 pr-2.5 py-2 rounded-full font-sans font-semibold text-base flex items-center gap-3 hover:bg-neutral-200 transition-all active:scale-95 shadow-md disabled:opacity-50 cursor-pointer"
                  >
                    <span>{loading ? 'Updating...' : 'Set New Password'}</span>
                    <span className="w-7 h-7 rounded-full bg-black text-white flex items-center justify-center">
                      <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
                    </span>
                  </button>
                </div>
              </form>

              <div className="pt-2 text-center">
                <Link
                  to="/signin"
                  className="text-xs font-sans text-neutral-400 hover:text-white transition-colors underline underline-offset-4"
                >
                  Back to Sign In
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

export default ResetPassword;
