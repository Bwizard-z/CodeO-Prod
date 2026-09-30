import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight, faRightFromBracket } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../hooks/useAuth';
import ProfileDropdown from './Auth/ProfileDropdown';
import UiScaleControl from './UiScaleControl';
import codeoLogo from '../assets/Logo.png';

export const Navbar = () => {
  const { user, isAuthenticated, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isEditor = location.pathname.startsWith('/editor') || location.pathname.startsWith('/room');

  if (isEditor) {
    return null; // The editor page has its own specialized top bar
  }

  return (
    <header className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between z-20 select-none">
      {/* Left Column: Brand Logo */}
      <div className="flex items-center justify-start z-10">
        <Link
          to={isAuthenticated ? "/dashboard" : "/"}
          className="hover:opacity-90 transition-opacity flex items-center select-none shrink-0"
        >
          <img
            src={codeoLogo}
            alt="CodeO"
            className="h-7 sm:h-8 md:h-9 w-auto object-contain brightness-105"
          />
        </Link>
      </div>

      {/* Center Column: Nav Pill (Strictly dead center horizontally on desktop, hidden on split/narrow viewports to prevent collision) */}
      <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 items-center pointer-events-auto z-10">
        <nav className="flex bg-[#0f172a]/90 border border-white/10 rounded-full px-5 sm:px-6 py-1.5 sm:py-2 items-center gap-5 sm:gap-6 shadow-lg backdrop-blur-md">
          {isAuthenticated ? (
            <>
              <Link
                to="/dashboard"
                className={`text-xs sm:text-sm font-sans font-medium transition-colors ${
                  location.pathname === '/dashboard'
                    ? 'text-white font-semibold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Dashboard
              </Link>
              <Link
                to="/features"
                className={`text-xs sm:text-sm font-sans font-medium transition-colors ${
                  location.pathname === '/features'
                    ? 'text-white font-semibold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Features
              </Link>
              <Link
                to="/feedback"
                className={`text-xs sm:text-sm font-sans font-medium transition-colors ${
                  location.pathname === '/feedback'
                    ? 'text-white font-semibold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Feedback
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/features"
                className={`text-xs sm:text-sm font-sans font-medium transition-colors ${
                  location.pathname === '/features'
                    ? 'text-white font-semibold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Features
              </Link>
              <Link
                to="/feedback"
                className={`text-xs sm:text-sm font-sans font-medium transition-colors ${
                  location.pathname === '/feedback'
                    ? 'text-white font-semibold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Feedback
              </Link>
            </>
          )}
        </nav>
      </div>

      {/* Right Column: UI Scale + Auth/Profile */}
      <div className="flex items-center justify-end gap-2 sm:gap-2.5 shrink-0 z-10">
        {/* Screen Sizing Icon Button */}
        <UiScaleControl />

        {isAuthenticated ? (
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Interactive User Profile Dropdown */}
            <ProfileDropdown />

            {/* Sign Out Button */}
            <button
              onClick={async () => {
                await signOut();
                navigate('/');
              }}
              className="bg-black text-white border border-white/20 hover:border-white/60 hover:bg-white/10 pl-3.5 pr-2 py-1 sm:py-1.5 rounded-full font-sans font-medium text-xs flex items-center gap-2 transition-all active:scale-95 shadow-md group cursor-pointer"
              title="Sign Out of CodeO"
            >
              <span className="font-semibold hidden sm:inline">Sign Out</span>
              <span className="w-5 h-5 rounded-full bg-white/15 group-hover:bg-red-500/80 group-hover:text-white text-neutral-300 flex items-center justify-center transition-colors">
                <FontAwesomeIcon icon={faRightFromBracket} className="text-[10px]" />
              </span>
            </button>
          </div>
        ) : (
          <>
            <Link
              to="/signin"
              className="text-xs sm:text-sm font-sans font-medium text-white hover:text-neutral-300 transition-colors"
            >
              Sign In
            </Link>

            <Link
              to="/join"
              className="bg-white text-black pl-4 sm:pl-5 pr-2 py-1 sm:py-1.5 rounded-full font-sans font-semibold text-xs sm:text-sm flex items-center gap-2 hover:bg-neutral-200 transition-all active:scale-95 shadow-md"
            >
              <span>Start Coding</span>
              <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-black text-white flex items-center justify-center">
                <FontAwesomeIcon icon={faArrowRight} className="text-[10px] sm:text-[11px]" />
              </span>
            </Link>
          </>
        )}
      </div>
    </header>
  );
};

export default Navbar;
