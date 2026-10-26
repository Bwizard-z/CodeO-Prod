// components/RoomCard.jsx - Collaborative Room Card Component with 3-Dots Menu & Rename Support
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlay,
  faCopy,
  faCheck,
  faTrash,
  faLock,
  faEllipsisVertical,
  faPenToSquare,
  faAlignLeft,
  faXmark,
  faSpinner,
} from '@fortawesome/free-solid-svg-icons';
import LanguageBadge from './Dashboard/LanguageBadge';

export function RoomCard({
  room,
  onDelete,
  onRename,
  onUpdateDescription,
  onUpdate,
  onCopySuccess,
}) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(room?.title || room?.name || 'Untitled Room');
  const [renaming, setRenaming] = useState(false);

  // Description editing state
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [newDesc, setNewDesc] = useState(room?.description || '');
  const [savingDesc, setSavingDesc] = useState(false);

  const menuRef = useRef(null);

  // Sync state if room changes externally
  useEffect(() => {
    if (!isRenaming) {
      setNewTitle(room?.title || room?.name || 'Untitled Room');
    }
  }, [room?.title, room?.name, isRenaming]);

  useEffect(() => {
    if (!isEditingDesc) {
      setNewDesc(room?.description || '');
    }
  }, [room?.description, isEditingDesc]);

  // Close 3-dots menu on outside click or Escape
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsMenuOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsMenuOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  if (!room) return null;

  const code = room.code || 'CODE';
  const currentTitle = room.title || room.name || 'Untitled Room';
  const description = room.description || 'No description provided.';
  const language = room.language || 'javascript';

  const handleCopyCode = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      if (onCopySuccess) onCopySuccess(code);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenRoom = () => {
    if (isRenaming || isEditingDesc) return;
    navigate(`/editor/${code}`);
  };

  const handleStartRename = (e) => {
    e.stopPropagation();
    setIsMenuOpen(false);
    setIsEditingDesc(false);
    setNewTitle(currentTitle);
    setIsRenaming(true);
  };

  const handleCancelRename = (e) => {
    if (e) e.stopPropagation();
    setIsRenaming(false);
    setNewTitle(currentTitle);
  };

  const handleSaveRename = async (e) => {
    if (e) e.stopPropagation();
    if (e) e.preventDefault();
    const clean = newTitle.trim();
    if (!clean || clean === currentTitle) {
      setIsRenaming(false);
      return;
    }

    try {
      setRenaming(true);
      if (onRename) {
        await onRename(room.id || room.code, clean);
      } else if (onUpdate) {
        await onUpdate(room.id || room.code, { title: clean });
      }
      setIsRenaming(false);
    } catch {
      // error handled in parent
    } finally {
      setRenaming(false);
    }
  };

  const handleStartEditDesc = (e) => {
    e.stopPropagation();
    setIsMenuOpen(false);
    setIsRenaming(false);
    setNewDesc(room?.description || '');
    setIsEditingDesc(true);
  };

  const handleCancelEditDesc = (e) => {
    if (e) e.stopPropagation();
    setIsEditingDesc(false);
    setNewDesc(room?.description || '');
  };

  const handleSaveDesc = async (e) => {
    if (e) e.stopPropagation();
    if (e) e.preventDefault();
    const clean = newDesc.trim();
    if (clean === (room?.description || '').trim()) {
      setIsEditingDesc(false);
      return;
    }

    try {
      setSavingDesc(true);
      if (onUpdateDescription) {
        await onUpdateDescription(room.id || room.code, clean);
      } else if (onUpdate) {
        await onUpdate(room.id || room.code, { description: clean });
      }
      setIsEditingDesc(false);
    } catch {
      // error handled in parent
    } finally {
      setSavingDesc(false);
    }
  };

  const handleDeleteClick = async (e) => {
    e.stopPropagation();
    setIsMenuOpen(false);
    if (deleting) return;
    const confirmed = window.confirm(`Delete room "${currentTitle}"? This action cannot be undone.`);
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
        {/* Header: Language Badge, Room Code, and 3-Dots Menu */}
        <div className="flex items-center justify-between gap-2.5 mb-2.5">
          <div className="flex items-center gap-2">
            <LanguageBadge language={language} />
            {room.is_locked && (
              <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-950/40 border border-amber-500/30 px-2 py-0.5 rounded-full font-mono">
                <FontAwesomeIcon icon={faLock} className="text-[9px]" /> Locked
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5" ref={menuRef}>
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

            {/* Three Dots Menu Button */}
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMenuOpen((prev) => !prev);
                }}
                title="Room Options"
                className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all cursor-pointer ${
                  isMenuOpen
                    ? 'bg-white/20 border-white/30 text-white'
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-neutral-400 hover:text-white'
                }`}
              >
                <FontAwesomeIcon icon={faEllipsisVertical} className="text-xs" />
              </button>

              {/* Three Dots Dropdown Menu */}
              {isMenuOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 top-full mt-1.5 w-44 rounded-xl bg-[#111726] border border-white/15 shadow-2xl z-30 py-1 font-sans text-xs animate-fade-in backdrop-blur-md"
                >
                  <button
                    type="button"
                    onClick={handleStartRename}
                    className="w-full text-left px-3 py-2 flex items-center gap-2 text-neutral-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <FontAwesomeIcon icon={faPenToSquare} className="text-[#fbff47] text-[11px]" />
                    <span>Rename Room</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleStartEditDesc}
                    className="w-full text-left px-3 py-2 flex items-center gap-2 text-neutral-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <FontAwesomeIcon icon={faAlignLeft} className="text-[#fbff47] text-[11px]" />
                    <span>Edit Description</span>
                  </button>

                  {onDelete && (
                    <button
                      type="button"
                      onClick={handleDeleteClick}
                      disabled={deleting}
                      className="w-full text-left px-3 py-2 flex items-center gap-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer border-t border-white/5"
                    >
                      <FontAwesomeIcon icon={faTrash} className="text-[11px]" />
                      <span>Delete Room</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Title or Inline Rename Form */}
        {isRenaming ? (
          <form
            onSubmit={handleSaveRename}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 mb-2 mt-1"
          >
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') handleCancelRename(e);
              }}
              autoFocus
              maxLength={255}
              placeholder="Enter new room name..."
              className="flex-1 bg-white/10 border border-[#fbff47]/60 rounded-lg px-2.5 py-1 text-sm text-white font-sans focus:outline-none focus:ring-1 focus:ring-[#fbff47] transition-all"
            />
            <button
              type="submit"
              disabled={renaming || !newTitle.trim()}
              title="Save new name"
              className="p-1.5 rounded-lg bg-[#fbff47] text-black hover:bg-yellow-300 transition-colors text-xs font-semibold cursor-pointer disabled:opacity-50 shrink-0"
            >
              {renaming ? (
                <FontAwesomeIcon icon={faSpinner} className="animate-spin text-xs" />
              ) : (
                <FontAwesomeIcon icon={faCheck} className="text-xs" />
              )}
            </button>
            <button
              type="button"
              onClick={handleCancelRename}
              title="Cancel"
              className="p-1.5 rounded-lg bg-white/10 text-neutral-400 hover:text-white hover:bg-white/15 transition-colors text-xs cursor-pointer shrink-0"
            >
              <FontAwesomeIcon icon={faXmark} className="text-xs" />
            </button>
          </form>
        ) : (
          <h3 className="text-base sm:text-lg font-serif italic text-white group-hover:text-[#fbff47] transition-colors line-clamp-1 mb-1">
            {currentTitle}
          </h3>
        )}

        {/* Description or Inline Description Edit Form */}
        {isEditingDesc ? (
          <form
            onSubmit={handleSaveDesc}
            onClick={(e) => e.stopPropagation()}
            className="flex flex-col gap-1.5 mb-3 mt-1"
          >
            <textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') handleCancelEditDesc(e);
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  handleSaveDesc(e);
                }
              }}
              autoFocus
              maxLength={500}
              rows={2}
              placeholder="Enter room description..."
              className="w-full bg-white/10 border border-[#fbff47]/60 rounded-lg p-2 text-xs text-white font-sans focus:outline-none focus:ring-1 focus:ring-[#fbff47] resize-none leading-relaxed transition-all"
            />
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={handleCancelEditDesc}
                className="px-2 py-0.5 rounded-md bg-white/10 text-neutral-400 hover:text-white hover:bg-white/15 transition-colors text-[11px] font-sans cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingDesc}
                className="px-2.5 py-0.5 rounded-md bg-[#fbff47] text-black hover:bg-yellow-300 transition-colors text-[11px] font-semibold font-sans cursor-pointer disabled:opacity-50 flex items-center gap-1"
              >
                {savingDesc ? (
                  <FontAwesomeIcon icon={faSpinner} className="animate-spin text-[10px]" />
                ) : (
                  <FontAwesomeIcon icon={faCheck} className="text-[10px]" />
                )}
                <span>Save</span>
              </button>
            </div>
          </form>
        ) : (
          <p
            className="text-neutral-400 text-xs font-sans line-clamp-2 leading-relaxed mb-3"
            title={description}
          >
            {description}
          </p>
        )}
      </div>

      {/* Footer: Card Actions */}
      <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-2 text-xs">
        <button
          type="button"
          onClick={handleStartRename}
          className="text-neutral-400 hover:text-[#fbff47] transition-colors flex items-center gap-1.5 text-[11px] cursor-pointer"
        >
          <FontAwesomeIcon icon={faPenToSquare} className="text-[10px]" />
          <span>Rename</span>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenRoom();
          }}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white text-black font-semibold text-xs hover:bg-neutral-200 transition-all active:scale-95 shadow-sm cursor-pointer"
        >
          <span>Open</span>
          <FontAwesomeIcon icon={faPlay} className="text-[9px]" />
        </button>
      </div>
    </div>
  );
}

export default RoomCard;
