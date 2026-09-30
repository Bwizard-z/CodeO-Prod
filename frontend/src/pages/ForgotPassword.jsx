import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faArrowRight, faCheckCircle } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../hooks/useAuth';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import codeoLogo from '../assets/Logo.png';

export const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const { resetPassword } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      setErrorMsg('Please enter your email address.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg('');
      const result = await resetPassword(email);
      if (result.success) {
        setSuccess(true);
      } else {
        setErrorMsg(result.error || 'Unable to send password reset email.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Unable to send password reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-between selection:bg-[#fbff47] selection:text-black">
      <Navbar />

      <main className="flex-1 flex items-center justify-center py-12 px-4 select-none">
        <div className="w-full max-w-md mx-auto bg-[#080c14] border border-white/10 rounded-2xl p-8 shadow-2xl flex flex-col items-center text-center">
          {/* Brand Logo */}
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
                Reset Link Sent!
              </h1>
              <p className="text-neutral-300 font-sans text-xs leading-relaxed">
                If an account exists for <span className="text-[#fbff47] font-mono">{email}</span>, you will receive an email with instructions to reset your password.
              </p>
              <div className="pt-4">
                <Link
                  to="/signin"
                  className="bg-white text-black px-6 py-2.5 rounded-full font-sans font-semibold text-sm inline-flex items-center gap-2 hover:bg-neutral-200 transition-all shadow-md active:scale-95"
                >
                  <span>Back to Sign In</span>
                  <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="w-full space-y-5">
              <div>
                <h1 className="text-3xl font-serif italic text-white tracking-tight">
                  Reset Password
                </h1>
                <p className="mt-2 text-neutral-400 font-sans text-xs">
                  Enter your email address to receive a secure password reset link.
                </p>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-lg bg-red-950/80 border border-red-500/50 text-red-200 text-xs font-sans text-center">
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5 text-left">
                <div className="flex items-center gap-3.5 w-full">
                  <div className="text-white shrink-0 w-7 flex justify-center">
                    <FontAwesomeIcon icon={faEnvelope} className="text-2xl" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter Your Email"
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
                    <span>{loading ? 'Sending...' : 'Send Reset Email'}</span>
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
                  Remember your password? Sign in
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

export default ForgotPassword;
