import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faKey, faUser, faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../../hooks/useAuth';
import GoogleSigninButton from './GoogleSigninButton';
import codeoLogo from '../../assets/Logo.png';

export const AuthCard = ({
  defaultMode = 'signin',
  onSignIn,
  onSignUp,
}) => {
  const [mode, setMode] = useState(defaultMode); // 'signin' or 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const { signIn: authSignIn, signUp: authSignUp } = useAuth();
  const signIn = onSignIn || authSignIn;
  const signUp = onSignUp || authSignUp;
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect parameter (e.g. ?redirect=/dashboard)
  const searchParams = new URLSearchParams(location.search);
  const redirectTarget = searchParams.get('redirect') || '/dashboard';

  // Synchronize mode when location.pathname or defaultMode changes
  useEffect(() => {
    if (location.pathname === '/signup') {
      setMode('signup');
    } else if (location.pathname === '/signin') {
      setMode('signin');
    } else if (defaultMode) {
      setMode(defaultMode);
    }
  }, [location.pathname, defaultMode]);

  const handleTabSwitch = (newMode) => {
    setMode(newMode);
    setErrorMsg('');
    const currentRedirect = searchParams.get('redirect');
    const query = currentRedirect ? `?redirect=${encodeURIComponent(currentRedirect)}` : '';
    if (newMode === 'signup' && location.pathname !== '/signup') {
      navigate(`/signup${query}`, { replace: true });
    } else if (newMode === 'signin' && location.pathname !== '/signin') {
      navigate(`/signin${query}`, { replace: true });
    }
  };

  const validateForm = () => {
    if (!email || !email.includes('@') || !email.includes('.')) {
      setErrorMsg('Please enter a valid email address.');
      return false;
    }

    if (!password) {
      setErrorMsg('Please enter your password.');
      return false;
    }

    if (mode === 'signup') {
      if (!confirmPassword) {
        setErrorMsg('Please confirm your password.');
        return false;
      }

      if (password !== confirmPassword) {
        setErrorMsg('Passwords do not match.');
        return false;
      }

      // Password strength: min 8 chars, uppercase, number
      const hasLength = password.length >= 8;
      const hasUpper = /[A-Z]/.test(password);
      const hasNum = /[0-9]/.test(password);
      if (!hasLength || !hasUpper || !hasNum) {
        setErrorMsg('Password must be at least 8 characters with at least one uppercase letter and one number.');
        return false;
      }

      if (!name.trim() || name.trim().length < 2) {
        setErrorMsg('Please enter your name (minimum 2 characters).');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setLoading(true);
      setErrorMsg('');

      if (mode === 'signin') {
        const result = await signIn(email, password);
        if (!result.success) {
          setErrorMsg(result.error || 'Invalid email or password.');
          return;
        }

        const signedUser = result.data?.user;
        const isVerified = Boolean(
          signedUser?.email_confirmed_at ||
          signedUser?.confirmed_at ||
          signedUser?.user_metadata?.email_verified === true ||
          signedUser?.app_metadata?.provider === 'google'
        );

        if (isVerified) {
          navigate(redirectTarget, { replace: true });
        } else {
          navigate('/verify-email', { state: { email }, replace: true });
        }
      } else {
        const result = await signUp(email, password, name.trim());
        if (!result.success) {
          setErrorMsg(result.error || 'Unable to create account. Please try again.');
          return;
        }

        navigate('/verify-email', { state: { email }, replace: true });
      }
    } catch (err) {
      setErrorMsg(err.message || 'Authentication failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center justify-center py-4 sm:py-6 px-4 select-none">
      {/* Brand Header */}
      <div className="mb-5 sm:mb-6 select-none">
        <img
          src={codeoLogo}
          alt="CodeO"
          className="h-10 sm:h-12 w-auto mx-auto object-contain brightness-110 drop-shadow-md"
        />
      </div>

      {/* Tabs Switcher: [ sign in | sign up ] */}
      <div className="flex items-center w-full max-w-sm mb-5 sm:mb-6 border border-white rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => handleTabSwitch('signin')}
          className={`flex-1 py-2 sm:py-2.5 text-center font-serif italic text-lg sm:text-xl transition-all cursor-pointer ${
            mode === 'signin'
              ? 'bg-white text-black font-semibold'
              : 'bg-black text-white hover:bg-neutral-900'
          }`}
        >
          sign in
        </button>
        <button
          type="button"
          onClick={() => handleTabSwitch('signup')}
          className={`flex-1 py-2 sm:py-2.5 text-center font-serif italic text-lg sm:text-xl transition-all cursor-pointer ${
            mode === 'signup'
              ? 'bg-white text-black font-semibold'
              : 'bg-black text-white hover:bg-neutral-900'
          }`}
        >
          sign up
        </button>
      </div>

      {errorMsg && (
        <div className="w-full max-w-sm mb-3 px-3.5 py-2 rounded bg-red-950/80 border border-red-500/50 text-red-200 text-xs text-center font-sans">
          {errorMsg}
        </div>
      )}

      {/* Auth Form */}
      <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-3.5 sm:gap-4">
        {/* Email Input with Font Awesome Envelope */}
        <div className="flex items-center gap-3 w-full">
          <div className="text-white shrink-0 w-6 flex justify-center">
            <FontAwesomeIcon icon={faEnvelope} className="text-lg sm:text-xl" />
          </div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter Your Email"
            required
            className="w-full bg-white text-black px-3.5 py-2 sm:py-2.5 rounded-md font-serif italic placeholder:font-serif placeholder:italic placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-400 text-sm shadow-sm"
          />
        </div>

        {/* Password Input with Font Awesome Key */}
        <div className="flex items-center gap-3 w-full">
          <div className="text-white shrink-0 w-6 flex justify-center">
            <FontAwesomeIcon icon={faKey} className="text-lg sm:text-xl" />
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter Your Password"
            required
            className="w-full bg-white text-black px-3.5 py-2 sm:py-2.5 rounded-md font-serif italic placeholder:font-serif placeholder:italic placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-400 text-sm shadow-sm"
          />
        </div>

        {/* Confirm Password - Only when Sign Up is selected */}
        {mode === 'signup' && (
          <div className="flex items-center gap-3 w-full">
            <div className="text-white shrink-0 w-6 flex justify-center">
              <FontAwesomeIcon icon={faKey} className="text-lg sm:text-xl" />
            </div>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm Your Password"
              required
              className="w-full bg-white text-black px-3.5 py-2 sm:py-2.5 rounded-md font-serif italic placeholder:font-serif placeholder:italic placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-400 text-sm shadow-sm"
            />
          </div>
        )}

        {/* Name Input - Only when Sign Up is selected */}
        {mode === 'signup' && (
          <div className="flex items-center gap-3 w-full">
            <div className="text-white shrink-0 w-6 flex justify-center">
              <FontAwesomeIcon icon={faUser} className="text-lg sm:text-xl" />
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter Your Name"
              required
              className="w-full bg-white text-black px-3.5 py-2 sm:py-2.5 rounded-md font-serif italic placeholder:font-serif placeholder:italic placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-400 text-sm shadow-sm"
            />
          </div>
        )}

        {/* Action Button: Sign In / Sign Up */}
        <div className="flex justify-center mt-1">
          <button
            type="submit"
            disabled={loading}
            className="bg-white text-black pl-6 pr-2 py-1.5 sm:py-2 rounded-full font-sans font-semibold text-xs sm:text-sm flex items-center gap-2.5 hover:bg-neutral-200 transition-all active:scale-95 shadow-md disabled:opacity-50 cursor-pointer"
          >
            <span>{loading ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Sign Up'}</span>
            <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-black text-white flex items-center justify-center">
              <FontAwesomeIcon icon={faArrowRight} className="text-[10px]" />
            </span>
          </button>
        </div>

        {/* Forgot Password Link - Only for Sign In */}
        {mode === 'signin' && (
          <div className="text-center mt-1">
            <Link
              to="/forgot-password"
              className="text-white hover:text-neutral-300 text-sm font-sans font-semibold transition-colors"
            >
              Forgot Your Password Reset ?
            </Link>
          </div>
        )}

        {/* Divider text before Google button */}
        <div className="relative flex items-center justify-center my-1">
          <div className="border-t border-white/20 w-full" />
          <span className="bg-black px-3 text-xs font-sans text-neutral-400 uppercase tracking-wider">
            or continue with
          </span>
          <div className="border-t border-white/20 w-full" />
        </div>

        {/* Google OAuth Button */}
        <div>
          <GoogleSigninButton
            text={mode === 'signin' ? 'Sign in with Google' : 'Sign up with Google'}
            onError={(msg) => setErrorMsg(msg)}
          />
        </div>
      </form>
    </div>
  );
};

export default AuthCard;
