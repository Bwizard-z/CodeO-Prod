import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUser,
  faCamera,
  faKey,
  faChevronDown,
  faCheck,
  faArrowLeft,
  faCheckCircle,
  faRotateRight,
  faRightFromBracket,
  faTableColumns,
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../../hooks/useAuth';

// Curated preset avatars for instant selection
const PRESET_AVATARS = [
  'https://api.dicebear.com/7.x/bottts/svg?seed=Felix',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Bella',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Shadow',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Jasper',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Luna',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Zoe',
];

export const ProfileDropdown = () => {
  const { user, isEmailVerified, updateProfile, resetPassword, signOut } = useAuth();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [currentView, setCurrentView] = useState('menu'); // 'menu' | 'avatar' | 'name'

  // Edit states
  const username =
    user?.user_metadata?.user_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'User';

  const avatarUrl =
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture ||
    null;

  const initial = (username.charAt(0) || 'U').toUpperCase();

  const [nameInput, setNameInput] = useState(username);
  const [selectedAvatar, setSelectedAvatar] = useState(avatarUrl || PRESET_AVATARS[0]);
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');

  // Status feedback states
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [pwCooldown, setPwCooldown] = useState(0);

  const dropdownRef = useRef(null);

  // Sync inputs when user data updates
  useEffect(() => {
    setNameInput(username);
    if (avatarUrl) setSelectedAvatar(avatarUrl);
  }, [username, avatarUrl]);

  // Outside click listener to smoothly close dropdown
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  // Password reset cooldown timer
  useEffect(() => {
    if (pwCooldown <= 0) return;
    const timer = setInterval(() => {
      setPwCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [pwCooldown]);

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
    setCurrentView('menu');
    setStatusMsg({ type: '', text: '' });
  };

  // Handle Name Update
  const handleSaveName = async (e) => {
    e.preventDefault();
    if (!nameInput.trim()) return;

    setLoading(true);
    setStatusMsg({ type: '', text: '' });

    const result = await updateProfile({ name: nameInput.trim() });
    setLoading(false);

    if (result.success) {
      setStatusMsg({ type: 'success', text: 'Display name updated successfully!' });
      setTimeout(() => {
        setCurrentView('menu');
        setStatusMsg({ type: '', text: '' });
      }, 1500);
    } else {
      setStatusMsg({ type: 'error', text: result.error || 'Failed to update name.' });
    }
  };

  // Handle Avatar Update
  const handleSaveAvatar = async (avatarToSave) => {
    const finalAvatar = avatarToSave || customAvatarUrl.trim() || selectedAvatar;
    if (!finalAvatar) return;

    setLoading(true);
    setStatusMsg({ type: '', text: '' });

    const result = await updateProfile({ avatar_url: finalAvatar });
    setLoading(false);

    if (result.success) {
      setSelectedAvatar(finalAvatar);
      setStatusMsg({ type: 'success', text: 'Avatar updated successfully!' });
      setTimeout(() => {
        setCurrentView('menu');
        setStatusMsg({ type: '', text: '' });
      }, 1500);
    } else {
      setStatusMsg({ type: 'error', text: result.error || 'Failed to update avatar.' });
    }
  };

  // Handle Password Reset Request
  const handleRequestPasswordReset = async () => {
    if (!user?.email || pwCooldown > 0) return;

    setLoading(true);
    setStatusMsg({ type: '', text: '' });

    const result = await resetPassword(user.email);
    setLoading(false);

    if (result.success) {
      setPwCooldown(60);
      setStatusMsg({
        type: 'success',
        text: `Password reset link sent to ${user.email}! Please check your email inbox.`,
      });
    } else {
      setStatusMsg({
        type: 'error',
        text: result.error || 'Failed to send password reset email.',
      });
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger: Profile Pic & Name Capsule */}
      <button
        type="button"
        onClick={handleToggle}
        className={`flex items-center gap-3 bg-[#080c14] border px-3.5 py-1.5 rounded-full transition-all group shadow-md cursor-pointer select-none ${
          isOpen ? 'border-white bg-[#0e1424]' : 'border-white/15 hover:border-white/40 hover:bg-[#0c1220]'
        }`}
        title="Account Options"
      >
        {/* User Avatar with status badge */}
        <div className="relative shrink-0 flex items-center justify-center">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={username}
              className="w-8 h-8 rounded-full object-cover border border-white/30 group-hover:border-white/60 transition-colors"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-[#4ade80] flex items-center justify-center text-black font-sans font-bold text-xs shadow-sm group-hover:scale-105 transition-transform">
              {initial}
            </div>
          )}
          {/* Active Online Indicator */}
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#22c55e] border-2 border-black" />
        </div>

        {/* Username in Playfair Display italic */}
        <span className="font-serif italic text-base md:text-lg text-white group-hover:text-neutral-200 transition-colors pr-0.5 hidden sm:inline-block">
          {username}
        </span>

        {/* Smooth Chevron Indicator */}
        <FontAwesomeIcon
          icon={faChevronDown}
          className={`text-[10px] text-neutral-400 group-hover:text-white transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-white' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu with Smooth Slide & Fade Transition */}
      <div
        className={`absolute right-0 top-full mt-3 w-80 sm:w-96 bg-[#080c14] border border-white/20 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] backdrop-blur-xl z-50 p-5 transition-all duration-200 ease-out origin-top-right select-none ${
          isOpen
            ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
        }`}
      >
        {/* VIEW 1: Main Menu Options */}
        {currentView === 'menu' && (
          <div className="space-y-4">
            {/* User Profile Header Card */}
            <div className="flex items-center gap-3.5 pb-4 border-b border-white/10">
              <div className="relative shrink-0">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={username}
                    className="w-12 h-12 rounded-full object-cover border border-white/30"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-[#4ade80] flex items-center justify-center text-black font-sans font-bold text-lg shadow-sm">
                    {initial}
                  </div>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#22c55e] border-2 border-black" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-serif italic text-xl text-white truncate font-medium">
                    {username}
                  </h4>
                  {isEmailVerified && (
                    <span className="text-[10px] bg-[#22c55e]/20 text-[#4ade80] border border-[#22c55e]/40 px-2 py-0.5 rounded-full font-sans font-semibold shrink-0">
                      Verified
                    </span>
                  )}
                </div>
                <p className="font-sans text-xs text-neutral-400 truncate mt-0.5">
                  {user?.email || 'No email associated'}
                </p>
              </div>
            </div>

            {/* Notification / Status Message if present */}
            {statusMsg.text && (
              <div
                className={`p-3 rounded-xl text-xs font-sans ${
                  statusMsg.type === 'success'
                    ? 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-200'
                    : 'bg-red-950/80 border border-red-500/50 text-red-200'
                }`}
              >
                {statusMsg.text}
              </div>
            )}

            {/* Account Management Options */}
            <div className="space-y-1.5 pt-1">
              <div className="text-[11px] font-sans font-bold uppercase tracking-wider text-neutral-400 px-2 mb-2">
                Profile Settings
              </div>

              {/* Option 1: Change Avatar */}
              <button
                type="button"
                onClick={() => {
                  setCurrentView('avatar');
                  setStatusMsg({ type: '', text: '' });
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-white/10 transition-colors text-left group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-neutral-300 group-hover:text-white group-hover:bg-white/10 transition-colors">
                    <FontAwesomeIcon icon={faCamera} className="text-xs" />
                  </span>
                  <div>
                    <div className="font-sans font-semibold text-sm text-neutral-200 group-hover:text-white">
                      Change Avatar
                    </div>
                    <div className="text-[11px] text-neutral-400 font-sans">
                      Select a preset avatar or custom photo
                    </div>
                  </div>
                </div>
                <span className="text-neutral-500 group-hover:text-neutral-300 text-xs">›</span>
              </button>

              {/* Option 2: Change Display Name */}
              <button
                type="button"
                onClick={() => {
                  setCurrentView('name');
                  setStatusMsg({ type: '', text: '' });
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-white/10 transition-colors text-left group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-neutral-300 group-hover:text-white group-hover:bg-white/10 transition-colors">
                    <FontAwesomeIcon icon={faUser} className="text-xs" />
                  </span>
                  <div>
                    <div className="font-sans font-semibold text-sm text-neutral-200 group-hover:text-white">
                      Change Display Name
                    </div>
                    <div className="text-[11px] text-neutral-400 font-sans">
                      Update your collaborative display name
                    </div>
                  </div>
                </div>
                <span className="text-neutral-500 group-hover:text-neutral-300 text-xs">›</span>
              </button>

              {/* Option 3: Request Password Reset */}
              <button
                type="button"
                onClick={handleRequestPasswordReset}
                disabled={loading || pwCooldown > 0}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-white/10 transition-colors text-left group cursor-pointer disabled:opacity-60"
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-neutral-300 group-hover:text-white group-hover:bg-white/10 transition-colors">
                    <FontAwesomeIcon
                      icon={loading ? faRotateRight : faKey}
                      className={`text-xs ${loading ? 'animate-spin' : ''}`}
                    />
                  </span>
                  <div>
                    <div className="font-sans font-semibold text-sm text-neutral-200 group-hover:text-white">
                      {pwCooldown > 0
                        ? `Reset Email Sent (${pwCooldown}s)`
                        : 'Change Password'}
                    </div>
                    <div className="text-[11px] text-neutral-400 font-sans">
                      Sends a secure reset link to your email
                    </div>
                  </div>
                </div>
                <span className="text-neutral-500 group-hover:text-neutral-300 text-xs">›</span>
              </button>
            </div>

            {/* Quick Links & Sign Out Footer */}
            <div className="pt-3 border-t border-white/10 flex items-center justify-between">
              <Link
                to="/dashboard"
                onClick={() => setIsOpen(false)}
                className="text-xs font-sans text-neutral-400 hover:text-white flex items-center gap-1.5 transition-colors"
              >
                <FontAwesomeIcon icon={faTableColumns} className="text-[10px]" />
                <span>Dashboard</span>
              </Link>

              <button
                type="button"
                onClick={async () => {
                  setIsOpen(false);
                  await signOut();
                  navigate('/');
                }}
                className="text-xs font-sans text-red-400 hover:text-red-300 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <FontAwesomeIcon icon={faRightFromBracket} className="text-[10px]" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}

        {/* VIEW 2: Change Avatar Sub-panel */}
        {currentView === 'avatar' && (
          <div className="space-y-4">
            {/* Sub-panel Navigation Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <button
                type="button"
                onClick={() => {
                  setCurrentView('menu');
                  setStatusMsg({ type: '', text: '' });
                }}
                className="text-neutral-400 hover:text-white text-xs font-sans flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <FontAwesomeIcon icon={faArrowLeft} />
                <span>Back</span>
              </button>
              <h4 className="font-serif italic text-lg text-white font-medium">
                Choose Avatar
              </h4>
              <div className="w-10" />
            </div>

            {/* Status Message */}
            {statusMsg.text && (
              <div
                className={`p-2.5 rounded-xl text-xs font-sans text-center ${
                  statusMsg.type === 'success'
                    ? 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-200'
                    : 'bg-red-950/80 border border-red-500/50 text-red-200'
                }`}
              >
                {statusMsg.text}
              </div>
            )}

            {/* Presets Grid */}
            <div>
              <div className="text-[11px] font-sans font-bold uppercase tracking-wider text-neutral-400 mb-2">
                Preset Avatars
              </div>
              <div className="grid grid-cols-3 gap-3">
                {PRESET_AVATARS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSelectedAvatar(preset);
                      handleSaveAvatar(preset);
                    }}
                    className={`relative p-1.5 rounded-xl border transition-all cursor-pointer bg-white/5 hover:bg-white/10 flex items-center justify-center ${
                      selectedAvatar === preset
                        ? 'border-[#4ade80] ring-2 ring-[#4ade80]/40'
                        : 'border-white/10 hover:border-white/30'
                    }`}
                  >
                    <img
                      src={preset}
                      alt={`Avatar ${idx + 1}`}
                      className="w-12 h-12 rounded-lg object-contain"
                    />
                    {selectedAvatar === preset && (
                      <span className="absolute top-1 right-1 w-4 h-4 bg-[#22c55e] text-black rounded-full flex items-center justify-center text-[9px] font-bold shadow-sm">
                        <FontAwesomeIcon icon={faCheck} />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Image URL Option */}
            <div className="pt-2">
              <div className="text-[11px] font-sans font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                Or Paste Image URL
              </div>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={customAvatarUrl}
                  onChange={(e) => setCustomAvatarUrl(e.target.value)}
                  placeholder="https://example.com/avatar.png"
                  className="flex-1 bg-white text-black px-3 py-1.5 rounded-lg text-xs font-sans placeholder:font-serif placeholder:italic placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-400"
                />
                <button
                  type="button"
                  disabled={loading || !customAvatarUrl.trim()}
                  onClick={() => handleSaveAvatar(customAvatarUrl.trim())}
                  className="bg-white text-black px-3 py-1.5 rounded-lg text-xs font-sans font-semibold hover:bg-neutral-200 transition-colors disabled:opacity-50 cursor-pointer shrink-0"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 3: Change Display Name Sub-panel */}
        {currentView === 'name' && (
          <div className="space-y-4">
            {/* Sub-panel Navigation Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <button
                type="button"
                onClick={() => {
                  setCurrentView('menu');
                  setStatusMsg({ type: '', text: '' });
                }}
                className="text-neutral-400 hover:text-white text-xs font-sans flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <FontAwesomeIcon icon={faArrowLeft} />
                <span>Back</span>
              </button>
              <h4 className="font-serif italic text-lg text-white font-medium">
                Change Name
              </h4>
              <div className="w-10" />
            </div>

            {/* Status Message */}
            {statusMsg.text && (
              <div
                className={`p-2.5 rounded-xl text-xs font-sans text-center ${
                  statusMsg.type === 'success'
                    ? 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-200'
                    : 'bg-red-950/80 border border-red-500/50 text-red-200'
                }`}
              >
                {statusMsg.text}
              </div>
            )}

            <form onSubmit={handleSaveName} className="space-y-4">
              <div>
                <label className="block text-[11px] font-sans font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Enter your name"
                  required
                  autoFocus
                  className="w-full bg-white text-black px-3.5 py-2.5 rounded-lg font-serif italic text-sm placeholder:font-serif placeholder:italic placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-400 shadow-sm"
                />
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setCurrentView('menu')}
                  className="px-4 py-2 rounded-full text-xs font-sans text-neutral-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !nameInput.trim()}
                  className="bg-white text-black px-5 py-2 rounded-full font-sans font-semibold text-xs hover:bg-neutral-200 transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {loading ? 'Saving...' : 'Save Name'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileDropdown;
