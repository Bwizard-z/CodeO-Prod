// components/RoomCard.jsx - Collaborative Room Card Component
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlay,
  faCopy,
  faCheck,
  faTrash,
  faUsers,
  faClock,
  faCode,
  faLock,
} from '@fortawesome/free-solid-svg-icons';
import LanguageBadge from './Dashboard/LanguageBadge';

export function formatRelativeTime(dateString) {
  if (!dateString) return 'Recently';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Recently';

  const diffSec = Math.floor((new Date() - date) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays} days ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  return `${Math.floor(diffMonths / 12)}y ago`;
}

export function RoomCard({
  room,
  onDelete,
  onCopySuccess,
}) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!room) return null;

  const code = room.code || 'CODE';
  const title = room.title || room.name || 'Untitled Room';
  const description = room.description || 'No description provided.';
  const language = room.language || 'javascript';
  const memberCount = room.active_members_count ?? room.members_count ?? 1;
  const relativeDate = formatRelativeTime(room.created_at || room.updated_at);

  const handleCopyCode = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      if (onCopySuccess) onCopySuccess(code);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenRoom = () => {
    navigate(`/editor/${code}`);
  };

  const handleDeleteClick = async (e) => {
    e.stopPropagation();
    if (deleting) return;
    const confirmed = window.confirm(`Delete room "${title}"? This action cannot be undone.`);
    if (!confirmed) return;

    try {
      setDeleting(true);
      if (onDelete) {
        await onDelete(room.id || room.code);
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      onClick={handleOpenRoom}
      className="group relative rounded-2xl p-4 sm:p-5 border transition-all duration-300 cursor-pointer select-none flex flex-col justify-between bg-[#0b0e14] border-white/10 hover:border-white/30 hover:shadow-xl hover:shadow-yellow-500/5 hover:-translate-y-0.5"
    >
      <div>
        {/* Header: Language Badge & Room Code */}
        <div className="flex items-center justify-between gap-2.5 mb-2.5">
          <div className="flex items-center gap-2">
            <LanguageBadge language={language} />
            {room.is_locked && (
              <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-950/40 border border-amber-500/30 px-2 py-0.5 rounded-full font-mono">
                <FontAwesomeIcon icon={faLock} className="text-[9px]" /> Locked
              </span>
            )}
          </div>

          {/* Copyable Code Pill */}
          <button
            type="button"
            onClick={handleCopyCode}
            title="Click to copy room code"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-white transition-all text-xs font-mono tracking-wider active:scale-95"
          >
            <span>{code}</span>
            <FontAwesomeIcon
              icon={copied ? faCheck : faCopy}
              className={`text-[11px] ${copied ? 'text-emerald-400' : 'text-neutral-400'}`}
            />
          </button>
        </div>

        {/* Title */}
        <h3 className="text-base sm:text-lg font-serif italic text-white group-hover:text-[#fbff47] transition-colors line-clamp-1 mb-1">
          {title}
        </h3>

        {/* Description */}
        <p className="text-neutral-400 text-xs font-sans line-clamp-2 leading-relaxed mb-3">
          {description}
        </p>
      </div>

      {/* Footer: Metadata & Actions */}
      <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs text-neutral-400">
        <div className="flex items-center gap-3 font-sans">
          <span className="flex items-center gap-1.5">
            <FontAwesomeIcon icon={faUsers} className="text-[11px] text-neutral-500" />
            <span>{memberCount} {memberCount === 1 ? 'member' : 'members'}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <FontAwesomeIcon icon={faClock} className="text-[11px] text-neutral-500" />
            <span>{relativeDate}</span>
          </span>
        </div>

        {/* Card Actions: [Delete] [Open] */}
        <div className="flex items-center gap-2">
          {onDelete && (
            <button
              type="button"
              onClick={handleDeleteClick}
              disabled={deleting}
              title="Delete room"
              className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-red-950/30 transition-all active:scale-95 disabled:opacity-50"
            >
              <FontAwesomeIcon icon={faTrash} className="text-xs" />
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenRoom();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-black font-semibold text-xs hover:bg-neutral-200 transition-all active:scale-95 shadow-sm"
          >
            <span>Open</span>
            <FontAwesomeIcon icon={faPlay} className="text-[9px]" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default RoomCard;
