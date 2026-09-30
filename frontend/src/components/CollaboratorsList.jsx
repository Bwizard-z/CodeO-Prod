// components/CollaboratorsList.jsx - Real-Time Collaborator List with Avatars, Speaking Rings, & Moderation Controls
import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCrown,
  faMicrophone,
  faMicrophoneSlash,
  faEllipsisVertical,
  faUserSlash,
  faRightFromBracket,
  faChevronLeft,
  faVolumeHigh,
  faLock,
  faPen,
} from '@fortawesome/free-solid-svg-icons';
import UserAvatar from './UserAvatar';

/**
 * CollaboratorsList
 * Renders active room collaborators with their profile avatar,
 * real-time Agora RTC speaking ring, distinct voice states,
 * host crown, and context menus for host moderation & self controls.
 */
export function CollaboratorsList({
  collaborators = [],
  currentUserId = null,
  isHost = false,
  onMuteUser = null,
  onUnmuteUser = null,
  onKickUser = null,
  onDisableEditor = null,
  onEnableEditor = null,
  onRemoveFromVoice = null,
  onToggleMyMic = null,
  onLeaveVoice = null,
  onCollapse = null,
  showHeader = true,
  onMuteAll = null,
  totalInVoice = 0,
}) {
  const [activeMenuUserId, setActiveMenuUserId] = useState(null);
  const menuRef = useRef(null);

  // Close context menu on outside click or escape key
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setActiveMenuUserId(null);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setActiveMenuUserId(null);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  if (!Array.isArray(collaborators) || collaborators.length === 0) {
    return (
      <div className="py-8 text-center text-neutral-500 font-sans text-xs italic">
        Connecting collaborators...
      </div>
    );
  }

  return (
    <div className="collaborators flex flex-col h-full font-sans select-none">
      {/* Header with collaborator count & collapse toggle */}
      {showHeader && (
        <div className="collaborators-header flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-sans font-bold text-xs uppercase tracking-wider text-neutral-300">
              Collaborators ({collaborators.length})
            </span>
            <div className="w-2 h-2 rounded-full bg-[#10b981] shadow-[0_0_8px_#10b981] animate-pulse" />
          </div>

          <div className="flex items-center gap-1.5">
            {/* Host Mute All button if more than 1 in voice */}
            {isHost && totalInVoice > 1 && onMuteAll && (
              <button
                type="button"
                onClick={onMuteAll}
                title="Mute all other voice participants"
                className="text-[10px] font-medium text-amber-400/90 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 px-2 py-0.5 rounded transition-colors cursor-pointer flex items-center gap-1"
              >
                <FontAwesomeIcon icon={faMicrophoneSlash} className="text-[9px]" />
                <span>Mute All</span>
              </button>
            )}

            {onCollapse && (
              <button
                type="button"
                onClick={onCollapse}
                title="Collapse collaborator panel"
                className="text-neutral-400 hover:text-white p-1 rounded hover:bg-white/10 transition-colors text-xs flex items-center gap-1 cursor-pointer"
              >
                <FontAwesomeIcon icon={faChevronLeft} className="text-[10px]" />
                <span className="text-[11px]">Collapse</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Collaborator Cards Scrollable Container */}
      <div className="collaborators-list flex-1 space-y-2 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10">
        {collaborators.map((user) => {
          const isSelf = Boolean(user.isLocal) || (currentUserId && String(user.id) === String(currentUserId));
          const isInVoice = Boolean(user.isInVoice);
          const isMuted = Boolean(user.isMuted);
          const isUserHost = Boolean(user.isHost);
          const isMenuOpen = activeMenuUserId === user.id;

          // Extract safe line number (default to line 1 if editing started)
          const lineNum = user.cursor?.line || user.cursor?.lineNumber || 1;

          // Determine Call / Voice State Subtext (Keep text small and compact)
          let callStatusText = 'NOT IN CALL';
          let callStatusColor = 'text-neutral-500';

          if (isInVoice) {
            if (isMuted) {
              callStatusText = 'IN CALL • MUTED';
              callStatusColor = 'text-amber-400 font-medium';
            } else {
              callStatusText = 'IN CALL';
              callStatusColor = 'text-emerald-400/90 font-medium';
            }
          } else if (user.isTyping) {
            callStatusText = 'TYPING...';
            callStatusColor = 'text-emerald-400 font-medium animate-pulse';
          }

          // Show three dots menu if:
          // 1. Current user is host AND this is another collaborator (!isSelf)
          // 2. OR this is current user (isSelf) AND they are in voice call (to toggle mic or leave)
          const canOpenMenu = isSelf ? isInVoice : isHost;

          return (
            <div
              key={user.id}
              className={`collaborator-card relative p-2.5 rounded-xl border transition-all duration-200 group ${
                isInVoice
                  ? 'bg-white/[0.04] border-white/10 hover:border-white/20'
                  : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/10'
              }`}
            >
              <div className="flex items-center justify-between gap-2.5">
                {/* Left: Avatar */}
                <div className="relative shrink-0 flex items-center justify-center">
                  <UserAvatar
                    user={user}
                    size={36}
                    isSpeaking={false}
                    showStatusDot={true}
                    status={isInVoice ? (isMuted ? 'muted' : 'in-audio') : 'viewing'}
                  />
                </div>

                {/* Center: Host H Badge, Name, Tags & Small Status Subtext (Call state + Line) */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* H Badge in FRONT of the name of the host */}
                    {isUserHost && (
                      <span
                        title="Room Host"
                        className="w-4 h-4 rounded bg-[#fbff47] text-black font-mono font-black text-[9.5px] flex items-center justify-center shrink-0 shadow-[0_0_8px_rgba(251,255,71,0.4)]"
                      >
                        H
                      </span>
                    )}

                    <span
                      title={user.name}
                      className="font-sans font-semibold text-xs text-white truncate max-w-[120px]"
                    >
                      {user.name}
                    </span>

                    {/* Self Indicator Tag */}
                    {isSelf && (
                      <span className="text-[9px] uppercase tracking-wider bg-white/10 text-neutral-300 px-1 py-0.2 rounded font-mono">
                        You
                      </span>
                    )}

                    {/* Host Crown */}
                    {isUserHost && (
                      <span
                        title="Room Host"
                        className="text-[#fbff47] text-[10px] inline-flex items-center drop-shadow-[0_0_4px_rgba(251,255,71,0.5)]"
                      >
                        <FontAwesomeIcon icon={faCrown} />
                      </span>
                    )}
                  </div>

                  {/* Small, compact status subtitle: Call status + Active line + Read-only if restricted */}
                  <div className="flex items-center gap-1 mt-0.5 flex-nowrap overflow-hidden">
                    <span className={`text-[9.5px] tracking-wide uppercase font-mono truncate ${callStatusColor}`}>
                      {callStatusText}
                    </span>

                    <span className="text-[9.5px] text-neutral-400 font-mono shrink-0">
                      • LN {lineNum}
                    </span>

                    {user.canEdit === false && (
                      <span className="text-[9px] text-amber-400 font-mono font-medium shrink-0">
                        • READ-ONLY
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Audio State Badge & Actions Menu Trigger */}
                <div className="flex items-center gap-1 shrink-0">
                  {/* Microphone Status Icon */}
                  {isInVoice && (
                    <div
                      title={isMuted ? 'Microphone Muted' : 'Microphone Active'}
                      className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10.5px] transition-colors ${
                        isMuted
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}
                    >
                      <FontAwesomeIcon icon={isMuted ? faMicrophoneSlash : faMicrophone} />
                    </div>
                  )}

                  {/* Context Menu Button: Always rendered on every collaborator card */}
                  <div className="relative" ref={isMenuOpen ? menuRef : null}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuUserId(isMenuOpen ? null : user.id);
                      }}
                      title="Collaborator actions"
                      className="w-6 h-6 rounded-md flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/10 transition-colors text-xs cursor-pointer"
                    >
                      <FontAwesomeIcon icon={faEllipsisVertical} />
                    </button>

                    {/* Dropdown Menu */}
                    {isMenuOpen && (
                      <div className="absolute right-0 top-full mt-1.5 z-50 w-48 bg-[#0e121b] border border-white/15 rounded-xl shadow-2xl p-1.5 text-xs font-sans animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md">
                        <div className="px-2 py-1 border-b border-white/10 mb-1 text-[11px] text-neutral-400 font-medium truncate flex items-center justify-between">
                          <span className="truncate">{user.name} {isSelf ? '(You)' : ''}</span>
                          {isUserHost && <span className="text-[9px] font-mono text-[#fbff47] font-bold">HOST</span>}
                        </div>

                        {/* Self Controls */}
                        {isSelf && (
                          <>
                            {isInVoice ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (onToggleMyMic) onToggleMyMic();
                                    setActiveMenuUserId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 text-neutral-200 hover:text-white transition-colors text-left cursor-pointer"
                                >
                                  <FontAwesomeIcon
                                    icon={isMuted ? faMicrophone : faMicrophoneSlash}
                                    className={isMuted ? 'text-emerald-400 w-3.5' : 'text-amber-400 w-3.5'}
                                  />
                                  <span>{isMuted ? 'Unmute Mic' : 'Mute Mic'}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    if (onLeaveVoice) onLeaveVoice();
                                    setActiveMenuUserId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 transition-colors text-left cursor-pointer"
                                >
                                  <FontAwesomeIcon icon={faRightFromBracket} className="w-3.5" />
                                  <span>Leave Voice</span>
                                </button>
                              </>
                            ) : (
                              <div className="px-2 py-1 text-[10.5px] text-neutral-400 italic">
                                {isUserHost ? 'You are the Room Host' : 'Active Collaborator'}
                              </div>
                            )}
                          </>
                        )}

                        {/* Controls for Other Collaborators */}
                        {!isSelf && (
                          <>
                            {/* Host Moderation Controls (Shown if current user is host) */}
                            {isHost ? (
                              <>
                                {/* Mute / Unmute Participant — Only when in voice call */}
                                {isInVoice && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const targetId = user.userId || user.id;
                                      if (isMuted) {
                                        if (onUnmuteUser) onUnmuteUser(targetId);
                                      } else {
                                        if (onMuteUser) onMuteUser(targetId);
                                      }
                                      setActiveMenuUserId(null);
                                    }}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 text-neutral-200 hover:text-white transition-colors text-left cursor-pointer"
                                  >
                                    <FontAwesomeIcon
                                      icon={isMuted ? faMicrophone : faMicrophoneSlash}
                                      className={isMuted ? 'text-emerald-400 w-3.5' : 'text-amber-400 w-3.5'}
                                    />
                                    <span>{isMuted ? 'Unmute Participant' : 'Mute Participant'}</span>
                                  </button>
                                )}

                                {/* Disable / Enable Editor */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const targetId = user.userId || user.id;
                                    if (user.canEdit === false) {
                                      if (onEnableEditor) onEnableEditor(targetId);
                                    } else {
                                      if (onDisableEditor) onDisableEditor(targetId);
                                    }
                                    setActiveMenuUserId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 text-neutral-200 hover:text-white transition-colors text-left cursor-pointer"
                                >
                                  <FontAwesomeIcon
                                    icon={user.canEdit === false ? faPen : faLock}
                                    className={user.canEdit === false ? 'text-emerald-400 w-3.5' : 'text-amber-400 w-3.5'}
                                  />
                                  <span>{user.canEdit === false ? 'Enable Editor' : 'Disable Editor'}</span>
                                </button>

                                {/* Remove from Voice (if they are in voice) */}
                                {isInVoice && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const targetId = user.userId || user.id;
                                      if (onRemoveFromVoice) onRemoveFromVoice(targetId);
                                      setActiveMenuUserId(null);
                                    }}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 text-neutral-200 hover:text-white transition-colors text-left cursor-pointer"
                                  >
                                    <FontAwesomeIcon icon={faRightFromBracket} className="text-neutral-400 w-3.5" />
                                    <span>Remove from Voice</span>
                                  </button>
                                )}

                                {/* Kick from Room */}
                                <div className="h-[1px] bg-white/10 my-1" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const targetId = user.userId || user.id;
                                    if (onKickUser) onKickUser(targetId);
                                    setActiveMenuUserId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 transition-colors text-left cursor-pointer font-medium"
                                >
                                  <FontAwesomeIcon icon={faUserSlash} className="text-rose-400 w-3.5" />
                                  <span>Kick from Room</span>
                                </button>
                              </>
                            ) : (
                              <div className="px-2 py-1 text-[10.5px] text-neutral-400">
                                {isUserHost ? 'Room Host' : 'Collaborator'} • Line {lineNum}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default CollaboratorsList;
