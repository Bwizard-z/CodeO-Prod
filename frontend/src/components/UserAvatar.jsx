// components/UserAvatar.jsx - User Avatar with Profile Picture & Initials Fallback
import React, { useState } from 'react';
import { generateUserColor } from '../hooks/useUserColor';

export const UserAvatar = React.memo(function UserAvatar({
  user,
  size = 36,
  showStatusDot = false,
  status = null,
  isSpeaking = false,
  className = '',
}) {
  const [imgError, setImgError] = useState(false);

  const name = (user?.name || user?.user_metadata?.user_name || 'Collaborator').trim();
  const shouldUseInitials = Boolean(user?.use_initials || user?.user_metadata?.use_initials);
  const avatarUrl =
    !imgError &&
    !shouldUseInitials &&
    (user?.avatar ||
      user?.avatar_url ||
      user?.picture ||
      user?.user_metadata?.avatar_url ||
      user?.user_metadata?.picture);

  // Unicode-safe initial extraction (handles Hindi, Chinese, emojis, multi-byte chars)
  const initial = (Array.from(name)[0] || 'U').toUpperCase();

  const userColor = user?.color || generateUserColor(user?.id || name);

  return (
    <div
      className={`relative shrink-0 select-none flex items-center justify-center font-sans font-semibold rounded-full transition-all duration-300 ${
        isSpeaking ? 'speaking-ring ring-2 ring-emerald-400' : ''
      } ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        minWidth: `${size}px`,
      }}
      title={name}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          onError={() => setImgError(true)}
          className={`w-full h-full rounded-full object-cover shadow-sm ring-1 ${
            isSpeaking ? 'ring-emerald-400' : 'ring-white/10'
          }`}
        />
      ) : (
        <div
          className={`w-full h-full rounded-full flex items-center justify-center text-white text-xs sm:text-sm font-semibold shadow-inner ${
            isSpeaking ? 'ring-2 ring-emerald-400' : ''
          }`}
          style={{ backgroundColor: userColor }}
        >
          {initial}
        </div>
      )}

      {/* Online / Active status dot */}
      {showStatusDot && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#080c14] ${
            isSpeaking
              ? 'bg-emerald-400 shadow-[0_0_8px_#22c55e]'
              : status === 'in-call' || status === 'in-audio'
              ? 'bg-emerald-500'
              : status === 'muted'
              ? 'bg-amber-400'
              : status === 'typing'
              ? 'bg-emerald-400 animate-ping'
              : status === 'viewing'
              ? 'bg-neutral-500'
              : 'bg-emerald-400'
          }`}
        />
      )}
    </div>
  );
});

export default UserAvatar;
