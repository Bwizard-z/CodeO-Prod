// components/HostPanel.jsx - Comprehensive Host Moderation Panel
import React, { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCrown,
  faLock,
  faUnlock,
  faMicrophone,
  faMicrophoneSlash,
  faPen,
  faBan,
  faUserSlash,
  faXmark,
  faSpinner,
  faChevronDown,
  faTriangleExclamation,
  faShieldHalved,
  faCheck,
} from '@fortawesome/free-solid-svg-icons';
import UserAvatar from './UserAvatar';

export function HostPanel({
  isHost = false,
  roomId = null,
  roomCode = null,
  roomControl = null,
  members = [],
  currentUserId = null,
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [kickConfirmMember, setKickConfirmMember] = useState(null);
  const [feedbackToast, setFeedbackToast] = useState(null);
  const [editOverrides, setEditOverrides] = useState({}); // { memberId: boolean } for instant UI
  const panelRef = useRef(null);

  // If user is not the host, do not render host controls
  if (!isHost) return null;

  const {
    isLocked = false,
    lockRoom = () => {},
    unlockRoom = () => {},
    toggleLock = () => {},
    muteUser = () => {},
    unmuteUser = () => {},
    disableEditor = () => {},
    enableEditor = () => {},
    kickUser = () => {},
    actionLoading = {},
    members: controlMembers = [],
  } = roomControl || {};

  // Merge backend control members with passed members with robust deduplication
  const displayMembers = React.useMemo(() => {
    const list = [];

    const addOrMerge = (m) => {
      if (!m) return;
      const rawId = m.id ? String(m.id).trim() : null;
      const rawUserId = m.userId ? String(m.userId).trim() : null;
      const rawName = m.name ? String(m.name).trim().toLowerCase() : null;

      const existingIdx = list.findIndex((item) => {
        const itemRawId = item.id ? String(item.id).trim() : null;
        const itemUserId = item.userId ? String(item.userId).trim() : null;
        const itemName = item.name ? String(item.name).trim().toLowerCase() : null;

        if (rawUserId && (itemUserId === rawUserId || itemRawId === rawUserId)) return true;
        if (rawId && (itemUserId === rawId || itemRawId === rawId)) return true;
        if (rawName && itemName && rawName === itemName && rawName !== 'collaborator' && rawName !== 'guest' && rawName !== 'anonymous') {
          return true;
        }
        return false;
      });

      if (existingIdx >= 0) {
        const old = list[existingIdx];
        list[existingIdx] = {
          ...old,
          ...m,
          id: old.id || m.id,
          userId: old.userId || m.userId,
          name: m.name || old.name,
          avatar: m.avatar || old.avatar,
          canEdit: m.canEdit !== undefined ? m.canEdit : old.canEdit,
          isMuted: m.isMuted !== undefined ? m.isMuted : old.isMuted,
          role: m.role || old.role,
          isHost: Boolean(m.isHost || old.isHost || m.role === 'host' || old.role === 'host'),
        };
      } else {
        list.push({
          ...m,
          canEdit: m.canEdit !== undefined ? m.canEdit : true,
          isMuted: Boolean(m.isMuted),
          isHost: Boolean(m.isHost || m.role === 'host'),
        });
      }
    };

    if (Array.isArray(members)) members.forEach(addOrMerge);
    if (Array.isArray(controlMembers)) controlMembers.forEach(addOrMerge);

    // Apply local editOverrides for instant UI feedback
    for (const item of list) {
      const itemKey = String(item.userId || item.id || '').trim().toLowerCase();
      const itemNameKey = String(item.name || '').trim().toLowerCase();
      if (itemKey && editOverrides[itemKey] !== undefined) {
        item.canEdit = editOverrides[itemKey];
      } else if (itemNameKey && editOverrides[itemNameKey] !== undefined) {
        item.canEdit = editOverrides[itemNameKey];
      }
    }

    return list;
  }, [members, controlMembers, editOverrides]);

  // Close panel on outside click or Escape key
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (kickConfirmMember) {
          setKickConfirmMember(null);
        } else {
          setIsOpen(false);
        }
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, kickConfirmMember]);

  const showToast = (message, type = 'success') => {
    setFeedbackToast({ message, type });
    setTimeout(() => setFeedbackToast(null), 3500);
  };

  const handleToggleLock = async () => {
    const success = await toggleLock();
    if (success) {
      showToast(isLocked ? 'Room unlocked. Members can now edit.' : 'Room locked. Editing restricted to read-only.');
    }
  };

  const handleToggleMute = async (member) => {
    const memberId = member.userId || member.id;
    if (member.isMuted) {
      await unmuteUser(memberId);
      showToast(`${member.name || 'Member'} unmuted.`);
    } else {
      await muteUser(memberId);
      showToast(`${member.name || 'Member'} muted.`);
    }
  };

  const handleToggleEditor = async (member) => {
    const memberId = member.userId || member.id;
    const memberKey = String(memberId).trim().toLowerCase();
    if (member.canEdit === false) {
      // Instant local override for UI
      setEditOverrides((prev) => ({ ...prev, [memberKey]: true }));
      await enableEditor(memberId);
      showToast(`Editor enabled for ${member.name || 'Member'}.`);
    } else {
      // Instant local override for UI
      setEditOverrides((prev) => ({ ...prev, [memberKey]: false }));
      await disableEditor(memberId);
      showToast(`Editor disabled for ${member.name || 'Member'}.`);
    }
  };

  const handleConfirmKick = async () => {
    if (!kickConfirmMember) return;
    const memberId = kickConfirmMember.userId || kickConfirmMember.id;
    const memberName = kickConfirmMember.name || 'Member';
    setKickConfirmMember(null);

    await kickUser(memberId);
    showToast(`${memberName} kicked from room.`, 'danger');
  };

  return (
    <div className={`relative ${className}`} ref={panelRef}>
      {/* Host Controls Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title="Host Moderation Controls"
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-sans font-medium transition-all cursor-pointer shadow-sm ${
          isOpen
            ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
            : isLocked
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
            : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-700'
        }`}
      >
        <FontAwesomeIcon icon={faShieldHalved} className="text-amber-400 text-xs" />
        <span className="hidden sm:inline">Host Controls</span>
        {isLocked && (
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" title="Room is Locked" />
        )}
        <FontAwesomeIcon
          icon={faChevronDown}
          className={`text-[10px] text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Host Controls Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-xl bg-neutral-900/95 border border-neutral-800 shadow-2xl backdrop-blur-xl z-50 overflow-hidden animate-fade-in font-sans">
          {/* Header */}
          <div className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 text-xs">
                <FontAwesomeIcon icon={faCrown} />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white tracking-wide uppercase">Host Controls</h3>
                <p className="text-[10.5px] text-neutral-400">Room: {roomCode || roomId}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-neutral-400 hover:text-white p-1 rounded-md hover:bg-white/5 transition-colors cursor-pointer"
            >
              <FontAwesomeIcon icon={faXmark} className="text-xs" />
            </button>
          </div>

          {/* Feedback Toast Banner */}
          {feedbackToast && (
            <div
              className={`px-3 py-1.5 text-xs flex items-center gap-2 animate-fade-in ${
                feedbackToast.type === 'danger'
                  ? 'bg-rose-950/80 text-rose-200 border-b border-rose-500/30'
                  : 'bg-emerald-950/80 text-emerald-200 border-b border-emerald-500/30'
              }`}
            >
              <FontAwesomeIcon
                icon={feedbackToast.type === 'danger' ? faTriangleExclamation : faCheck}
                className="text-xs shrink-0"
              />
              <span className="truncate">{feedbackToast.message}</span>
            </div>
          )}

          {/* Section 1: Room Lock Toggle */}
          <div className="p-3.5 border-b border-neutral-800 bg-neutral-900/40">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-white">Room Lock</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-medium ${
                      isLocked
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {isLocked ? 'Locked' : 'Unlocked'}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  {isLocked
                    ? 'All members are restricted to read-only mode.'
                    : 'All members can actively edit code.'}
                </p>
              </div>

              <button
                type="button"
                onClick={handleToggleLock}
                disabled={actionLoading?.lock}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shrink-0 ${
                  isLocked
                    ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30'
                }`}
              >
                {actionLoading?.lock ? (
                  <FontAwesomeIcon icon={faSpinner} className="animate-spin text-xs" />
                ) : (
                  <FontAwesomeIcon icon={isLocked ? faUnlock : faLock} className="text-xs" />
                )}
                <span>{isLocked ? 'Unlock' : 'Lock Room'}</span>
              </button>
            </div>
          </div>

          {/* Section 2: Members List & Individual Moderation */}
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                Members ({displayMembers.length})
              </span>
              <span className="text-[10px] text-neutral-500">Mute • Restrict • Kick</span>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-neutral-700">
              {displayMembers.length === 0 ? (
                <div className="py-6 text-center text-xs text-neutral-500 italic">
                  No active members found.
                </div>
              ) : (
                displayMembers.map((member) => {
                  const memberId = member.userId || member.id;
                  const isSelf =
                    Boolean(currentUserId && (
                      String(member.userId) === String(currentUserId) ||
                      String(member.id) === String(currentUserId)
                    ));
                  const isMemberHost = Boolean(member.role === 'host' || member.isHost || (isHost && isSelf));
                  const isMuted = Boolean(member.isMuted);
                  const canEdit = member.canEdit !== false;
                  const isInVoice = Boolean(member.isInVoice || member.audioEnabled);

                  const isMuteLoading = actionLoading[`mute_${memberId}`];
                  const isEditLoading = actionLoading[`edit_${memberId}`];
                  const isKickLoading = actionLoading[`kick_${memberId}`];

                  return (
                    <div
                      key={memberId}
                      className="p-2 rounded-lg bg-neutral-950/50 border border-neutral-800/80 flex items-center justify-between gap-2 hover:border-neutral-700 transition-colors"
                    >
                      {/* Member Info */}
                      <div className="flex items-center gap-2 min-w-0">
                        <UserAvatar user={member} size={28} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium text-white truncate max-w-[100px]">
                              {member.name || 'Member'}
                            </span>
                            {isMemberHost && (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 font-mono">
                                Host
                              </span>
                            )}
                          </div>
                          {/* Status Tags */}
                          <div className="flex items-center gap-1 mt-0.5">
                            {!canEdit && (
                              <span className="text-[9px] px-1 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                Read-only
                              </span>
                            )}
                            {isMuted && isInVoice && (
                              <span className="text-[9px] px-1 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                Muted
                              </span>
                            )}
                            {!isInVoice && (
                              <span className="text-[9px] px-1 rounded bg-neutral-800 text-neutral-500 border border-neutral-700">
                                Not in call
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Member Actions (Hidden for host self) */}
                      {!isMemberHost && (
                        <div className="flex items-center gap-1 shrink-0">
                          {/* Mute/Unmute Toggle — Only shown when member is in voice call */}
                          {isInVoice && (
                            <button
                              type="button"
                              onClick={() => handleToggleMute(member)}
                              disabled={isMuteLoading}
                              title={isMuted ? 'Unmute member' : 'Mute member'}
                              className={`p-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                                isMuted
                                  ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30'
                                  : 'bg-neutral-800 text-neutral-400 hover:text-amber-400 hover:bg-amber-500/10'
                              }`}
                            >
                              <FontAwesomeIcon
                                icon={isMuteLoading ? faSpinner : isMuted ? faMicrophoneSlash : faMicrophone}
                                className={isMuteLoading ? 'animate-spin' : ''}
                              />
                            </button>
                          )}

                          {/* Editor Enable/Disable Toggle (Orange for restriction, faLock when disabled) */}
                          <button
                            type="button"
                            onClick={() => handleToggleEditor(member)}
                            disabled={isEditLoading}
                            title={canEdit ? 'Disable editor (make read-only)' : 'Enable editor (allow editing)'}
                            className={`p-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                              !canEdit
                                ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30'
                                : 'bg-neutral-800 text-neutral-400 hover:text-amber-400 hover:bg-amber-500/10'
                            }`}
                          >
                            <FontAwesomeIcon
                              icon={isEditLoading ? faSpinner : canEdit ? faPen : faLock}
                              className={isEditLoading ? 'animate-spin' : ''}
                            />
                          </button>

                          {/* Kick User Button (Red for danger) */}
                          <button
                            type="button"
                            onClick={() => setKickConfirmMember(member)}
                            disabled={isKickLoading}
                            title="Kick member from room"
                            className="p-1.5 rounded-md bg-neutral-800 text-neutral-400 hover:text-rose-400 hover:bg-rose-500/15 transition-colors cursor-pointer"
                          >
                            <FontAwesomeIcon
                              icon={isKickLoading ? faSpinner : faUserSlash}
                              className={isKickLoading ? 'animate-spin' : ''}
                            />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Danger Confirmation Modal: Kick User */}
      {kickConfirmMember && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in font-sans">
          <div className="w-full max-w-sm rounded-xl bg-neutral-900 border border-neutral-800 shadow-2xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <FontAwesomeIcon icon={faTriangleExclamation} className="text-base" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Kick Member</h4>
                <p className="text-xs text-neutral-400">Confirm member removal</p>
              </div>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed">
              Are you sure you want to kick{' '}
              <span className="font-semibold text-white">
                {kickConfirmMember.name || 'this member'}
              </span>
              ? They will be immediately disconnected from the room.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setKickConfirmMember(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmKick}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer flex items-center gap-1.5 shadow-lg shadow-rose-950/50"
              >
                <FontAwesomeIcon icon={faUserSlash} className="text-xs" />
                <span>Kick Member</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HostPanel;
