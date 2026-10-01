import React, { useState, useMemo } from 'react';
import { CollaboratorsList } from '../CollaboratorsList';
import { generateNumericUid } from '../../hooks/useAudio';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faMicrophone,
  faMicrophoneSlash,
  faVolumeHigh,
  faVolumeXmark,
  faRightFromBracket,
  faLock,
  faUnlock,
  faCopy,
  faCheck,
  faSpinner,
  faTowerBroadcast,
  faHeadphones,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';

export const Sidebar = ({
  connectedUsers = [],
  members = [],
  currentUser,
  isHost = false,
  isLocked = false,
  onToggleLock,
  onCollapse,
  width = 240,
  roomCode = '',
  audio = null,
  roomControl = null,
  hostId = null,
  hostName = null,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Safe extraction of current user credentials and avatar
  const currentUserId = currentUser?.id || 'self';
  const currentUserName = (
    currentUser?.name ||
    currentUser?.user_metadata?.user_name ||
    currentUser?.user_metadata?.name ||
    currentUser?.email?.split('@')[0] ||
    'You'
  ).trim();

  const shouldUseInitials = Boolean(
    currentUser?.use_initials || currentUser?.user_metadata?.use_initials
  );

  const currentUserAvatar = shouldUseInitials
    ? null
    : (currentUser?.avatar ||
      currentUser?.avatar_url ||
      currentUser?.picture ||
      currentUser?.user_metadata?.avatar_url ||
      currentUser?.user_metadata?.picture ||
      null);

  // Audio state extraction
  const isAudioConnected = Boolean(audio?.isConnected);
  const isAudioConnecting = Boolean(audio?.isConnecting);
  const isAudioMuted = Boolean(audio?.isMuted);
  const isAudioDeafened = Boolean(audio?.isDeafened);
  const remoteAudioUsers = audio?.remoteUsers || [];
  const activeSpeakers = audio?.activeSpeakers || [];
  const localVolume = audio?.localVolume || 0;

  // Merge Yjs awareness users, Socket.io members, and Agora RTC participants into a single deduplicated list
  const activeCollaborators = useMemo(() => {
    const userMap = new Map();

    const normSelfName = currentUserName.toLowerCase();
    const normHostName = (hostName || '').trim().toLowerCase();

    // 1. Process Yjs awareness users (authoritative for live editing & cursors)
    if (Array.isArray(connectedUsers) && connectedUsers.length > 0) {
      connectedUsers.forEach((u) => {
        const rawName = u.name || 'Collaborator';
        const normName = rawName.trim().toLowerCase();
        const isSelf = Boolean(u.isLocal) || normName === normSelfName || String(u.id) === String(currentUserId);
        const key = isSelf ? '__self__' : (u.id || normName);

        const avatar =
          u.avatar ||
          (isSelf ? currentUserAvatar : null);

        const userIsHost = Boolean(
          (isHost && isSelf) ||
          u.isHost ||
          (hostId && String(u.id) === String(hostId))
        );

        if (!userMap.has(key)) {
          userMap.set(key, {
            id: isSelf ? currentUserId : (u.id || key),
            name: isSelf ? currentUserName : rawName,
            color: u.color || '#3b82f6',
            colorLight: u.colorLight || 'rgba(59, 130, 246, 0.2)',
            avatar,
            isLocal: isSelf,
            isHost: userIsHost,
            cursor: u.cursor || null,
            voice: u.voice || null,
            isTyping: Boolean(u.isTyping),
          });
        } else {
          const existing = userMap.get(key);
          if (u.cursor) existing.cursor = u.cursor;
          if (u.voice) existing.voice = u.voice;
          if (u.color) existing.color = u.color;
          if (avatar && !existing.avatar) existing.avatar = avatar;
          if (isSelf) existing.isLocal = true;
          if (userIsHost) existing.isHost = true;
        }
      });
    }

    // 2. Process Socket.io members to enrich host info, avatars, or add connecting members
    if (Array.isArray(members) && members.length > 0) {
      members.forEach((m) => {
        const rawName = m.name || m.user_metadata?.user_name || 'Collaborator';
        const normName = rawName.trim().toLowerCase();
        const isSelf = normName === normSelfName || String(m.id) === String(currentUserId);
        const key = isSelf ? '__self__' : (m.id || normName);

        const avatar =
          m.avatar ||
          m.user_metadata?.avatar_url ||
          m.user_metadata?.picture ||
          (isSelf ? currentUserAvatar : null);

        const memberIsHost = Boolean(
          m.role === 'host' ||
          (isHost && isSelf) ||
          (hostId && (String(m.id) === String(hostId) || String(m.userId) === String(hostId) || String(m.user_id) === String(hostId)))
        );

        if (userMap.has(key)) {
          const existing = userMap.get(key);
          if (memberIsHost) existing.isHost = true;
          if (avatar && !existing.avatar) existing.avatar = avatar;
          if (m.canEdit !== undefined) existing.canEdit = m.canEdit;
          if (m.isMuted !== undefined) existing.isMuted = m.isMuted;
          if (m.isInVoice || m.audioEnabled) {
            existing.socketInVoice = true;
            existing.socketMuted = m.isMuted;
          }
        } else {
          userMap.set(key, {
            id: isSelf ? currentUserId : (m.id || m.socketId || key),
            name: isSelf ? currentUserName : rawName,
            color: m.color || '#10b981',
            colorLight: 'rgba(16, 185, 129, 0.2)',
            avatar,
            isLocal: isSelf,
            isHost: memberIsHost,
            canEdit: m.canEdit !== false,
            isMuted: Boolean(m.isMuted),
            cursor: null,
            voice: null,
            socketInVoice: Boolean(m.isInVoice || m.audioEnabled),
            socketMuted: Boolean(m.isMuted),
            isTyping: false,
          });
        }
      });
    }

    // 3. Process roomControl members for authoritative permissions (canEdit, isMuted)
    if (Array.isArray(roomControl?.members) && roomControl.members.length > 0) {
      roomControl.members.forEach((rcm) => {
        const rcmUserId = rcm.userId ? String(rcm.userId).trim().toLowerCase() : null;
        const rcmId = rcm.id ? String(rcm.id).trim().toLowerCase() : null;
        const rcmName = rcm.name ? String(rcm.name).trim().toLowerCase() : null;

        for (const [key, userObj] of userMap.entries()) {
          const uId = userObj.id ? String(userObj.id).trim().toLowerCase() : null;
          const uName = userObj.name ? String(userObj.name).trim().toLowerCase() : null;
          const normKey = String(key).trim().toLowerCase();

          const isMatch =
            (rcmUserId && (uId === rcmUserId || normKey === rcmUserId)) ||
            (rcmId && (uId === rcmId || normKey === rcmId)) ||
            (rcmName && (uName === rcmName || normKey === rcmName)) ||
            (uId && uId.startsWith('guest-') && rcmName && uId === `guest-${rcmName.replace(/[^a-z0-9]/g, '')}`);

          if (isMatch) {
            if (rcm.canEdit !== undefined) {
              userObj.canEdit = rcm.canEdit;
            }
            if (rcm.isMuted !== undefined) {
              userObj.isMuted = rcm.isMuted;
            }
          }
        }
      });
    }

    // 4. Fallback: If map is still empty, ensure local user is represented
    if (!userMap.has('__self__')) {
      userMap.set('__self__', {
        id: currentUserId,
        name: currentUserName,
        color: '#fbff47',
        colorLight: 'rgba(251, 255, 71, 0.2)',
        avatar: currentUserAvatar,
        isLocal: true,
        isHost: Boolean(isHost || (hostId && String(currentUserId) === String(hostId))),
        cursor: null,
        voice: null,
        isTyping: false,
      });
    }

    // 5. Enrich each collaborator with Agora RTC voice state & cursor line
    const userList = Array.from(userMap.values()).map((user) => {
      const isSelf = user.isLocal;
      let isInVoice = false;
      let isMuted = false;

      if (isSelf) {
        isInVoice = isAudioConnected;
        isMuted = isAudioMuted;
      } else {
        // Find corresponding remote Agora user by ID, Name, or deterministic Numeric UID
        const expectedUid1 = generateNumericUid(user.id);
        const expectedUid2 = generateNumericUid(user.name);

        const remoteMatch = remoteAudioUsers.find(
          (r) =>
            String(r.uid) === String(user.id) ||
            String(r.uid) === user.name ||
            String(r.uid) === String(expectedUid1) ||
            String(r.uid) === String(expectedUid2) ||
            (members && members.some((m) => (String(m.id) === String(user.id) || m.name === user.name) && String(m.rtcUid) === String(r.uid)))
        );

        // Triple-layer detection: Yjs awareness voice, Agora remote audio user, Socket.io member presence
        const inVoiceFromAwareness = Boolean(user.voice?.inCall);
        const inVoiceFromSocket = Boolean(user.socketInVoice || (members && members.some((m) => (String(m.id) === String(user.id) || m.name === user.name) && (m.isInVoice || m.audioEnabled))));
        const inVoiceFromAgora = Boolean(remoteMatch);

        isInVoice = inVoiceFromAwareness || inVoiceFromSocket || inVoiceFromAgora;

        if (user.voice && user.voice.inCall) {
          isMuted = Boolean(user.voice.isMuted);
        } else if (remoteMatch) {
          isMuted = !remoteMatch.hasAudio;
        } else if (user.socketMuted !== undefined) {
          isMuted = Boolean(user.socketMuted);
        }
      }

      return {
        ...user,
        isInVoice,
        isMuted,
        isSpeaking: false,
        // Guarantee clean cursor with line number fallback if not initialized
        cursor: user.cursor || { line: 1, lineNumber: 1, column: 1 },
      };
    });

    // Guarantee that if local user is host, their entry is marked as host
    userList.forEach((u) => {
      if (u.isLocal && isHost) u.isHost = true;
    });

    // If still no host is marked in the room, match against room host name/id
    const hasAnyHost = userList.some((u) => u.isHost);
    if (!hasAnyHost && userList.length > 0) {
      const matchingHost = userList.find((u) => (
        (normHostName && (u.name.toLowerCase().includes(normHostName) || normHostName.includes(u.name.toLowerCase()))) ||
        (hostId && (String(u.id) === String(hostId) || String(u.userId) === String(hostId)))
      ));
      if (matchingHost) {
        matchingHost.isHost = true;
      }
    }

    // Sort: Local user first, then host, then alphabetical
    return userList.sort((a, b) => {
      if (a.isLocal) return -1;
      if (b.isLocal) return 1;
      if (a.isHost && !b.isHost) return -1;
      if (!a.isHost && b.isHost) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [
    connectedUsers,
    members,
    roomControl?.members,
    currentUserId,
    currentUserName,
    currentUserAvatar,
    isHost,
    isAudioConnected,
    isAudioMuted,
    remoteAudioUsers,
    activeSpeakers,
    localVolume,
  ]);

  const totalInVoice = useMemo(() => {
    return activeCollaborators.filter((u) => u.isInVoice).length;
  }, [activeCollaborators]);

  return (
    <aside
      style={{ width: `${width}px` }}
      className="bg-[#080c14] text-white border-r border-white/10 flex flex-col justify-between p-3 shrink-0 select-none overflow-hidden h-full font-sans"
    >
      {/* Top Section: Collaborators List */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <CollaboratorsList
          collaborators={activeCollaborators}
          currentUserId={currentUserId}
          isHost={isHost}
          onMuteUser={(targetUserId) => {
            audio?.hostMuteUser?.(targetUserId);
            roomControl?.muteUser?.(targetUserId);
          }}
          onUnmuteUser={(targetUserId) => {
            roomControl?.unmuteUser?.(targetUserId);
          }}
          onKickUser={(targetUserId) => {
            audio?.hostRemoveFromVoice?.(targetUserId);
            roomControl?.kickUser?.(targetUserId);
          }}
          onDisableEditor={(targetUserId) => {
            roomControl?.disableEditor?.(targetUserId);
          }}
          onEnableEditor={(targetUserId) => {
            roomControl?.enableEditor?.(targetUserId);
          }}
          onRemoveFromVoice={(targetUserId) => audio?.hostRemoveFromVoice?.(targetUserId)}
          onToggleMyMic={() => audio?.toggleMute?.()}
          onLeaveVoice={() => audio?.leaveCall?.()}
          onCollapse={onCollapse}
          showHeader={true}
          onMuteAll={() => audio?.hostMuteAll?.()}
          totalInVoice={totalInVoice}
        />
      </div>

      {/* Audio Error Toast / Alert */}
      {audio?.error && (
        <div className="mt-2 p-2 rounded-xl bg-red-950/80 border border-red-500/40 text-red-200 text-xs flex items-center justify-between gap-1.5 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <FontAwesomeIcon icon={faTriangleExclamation} className="text-red-400 text-xs shrink-0" />
            <span className="truncate text-[11px] leading-tight">{audio.error}</span>
          </div>
          <button
            type="button"
            onClick={() => audio?.setError?.(null)}
            className="text-red-400 hover:text-white text-xs font-bold px-1 cursor-pointer shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {/* Bottom Area: Voice Controls + Room Controls */}
      <div className="pt-2.5 border-t border-white/10 space-y-2 mt-2 shrink-0">
        {/* Voice Section: Join Button (if not in voice) OR Compact Control Bar (if in voice) */}
        {!isAudioConnected ? (
          <button
            type="button"
            onClick={() => audio?.joinCall?.(roomCode, currentUserId, 'publisher')}
            disabled={isAudioConnecting}
            className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600/90 to-teal-600/90 hover:from-emerald-500 hover:to-teal-500 text-white font-sans font-semibold text-xs tracking-wide transition-all shadow-[0_0_15px_-3px_rgba(16,185,129,0.3)] active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isAudioConnecting ? (
              <>
                <FontAwesomeIcon icon={faSpinner} className="animate-spin text-xs" />
                <span>Connecting Voice...</span>
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faMicrophone} className="text-xs" />
                <span>Join Voice</span>
              </>
            )}
          </button>
        ) : (
          /* Compact Voice Control Bar */
          <div className="p-2 rounded-xl bg-[#0e1422] border border-white/10 shadow-lg space-y-1.5">
            {/* Connection status header */}
            <div className="flex items-center justify-between text-[10px] text-neutral-400 px-1">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#22c55e]" />
                <span className="text-emerald-400 font-mono font-medium">LIVE AUDIO</span>
              </div>
              <span className="text-[10px] font-mono text-neutral-500">&lt;100ms</span>
            </div>

            {/* Quick action buttons row: Mic | Speaker | Leave */}
            <div className="grid grid-cols-3 gap-1 pt-0.5">
              {/* Mic Toggle Button */}
              <button
                type="button"
                onClick={() => audio?.toggleMute?.()}
                title={isAudioMuted ? 'Unmute Microphone' : 'Mute Microphone'}
                className={`py-1.5 px-2 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all text-xs font-sans cursor-pointer active:scale-95 ${
                  isAudioMuted
                    ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25'
                    : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25'
                }`}
              >
                <FontAwesomeIcon icon={isAudioMuted ? faMicrophoneSlash : faMicrophone} className="text-xs" />
                <span className="text-[9.5px] font-medium">{isAudioMuted ? 'Muted' : 'Mic On'}</span>
              </button>

              {/* Speaker / Deafen Toggle Button */}
              <button
                type="button"
                onClick={() => audio?.toggleSpeaker?.()}
                title={isAudioDeafened ? 'Enable Speaker' : 'Deafen (Mute Speaker)'}
                className={`py-1.5 px-2 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all text-xs font-sans cursor-pointer active:scale-95 ${
                  isAudioDeafened
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25'
                    : 'bg-white/5 text-neutral-300 border border-white/10 hover:text-white hover:bg-white/10'
                }`}
              >
                <FontAwesomeIcon icon={isAudioDeafened ? faVolumeXmark : faVolumeHigh} className="text-xs" />
                <span className="text-[9.5px] font-medium">{isAudioDeafened ? 'Deafened' : 'Speaker'}</span>
              </button>

              {/* Leave Voice Button */}
              <button
                type="button"
                onClick={() => audio?.leaveCall?.()}
                title="Disconnect from Voice Chat"
                className="py-1.5 px-2 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all text-xs font-sans cursor-pointer active:scale-95 bg-white/5 text-neutral-400 border border-white/10 hover:bg-rose-600 hover:text-white hover:border-rose-500"
              >
                <FontAwesomeIcon icon={faRightFromBracket} className="text-xs" />
                <span className="text-[9.5px] font-medium">Leave</span>
              </button>
            </div>
          </div>
        )}

        {/* Invite Code Button */}
        {roomCode && (
          <button
            type="button"
            onClick={handleCopyCode}
            title="Click to copy room code"
            className="w-full py-1.5 px-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-white font-sans text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
          >
            <FontAwesomeIcon
              icon={copied ? faCheck : faCopy}
              className={copied ? 'text-emerald-400' : 'text-neutral-400'}
            />
            <span className="font-mono text-xs">{copied ? 'Code Copied!' : `Invite: ${roomCode}`}</span>
          </button>
        )}

        {/* Host Lock Room Control */}
        {isHost && onToggleLock && (
          <button
            type="button"
            onClick={onToggleLock}
            className={`w-full py-2 px-3 rounded-xl text-white font-sans font-bold text-xs tracking-wide transition-all shadow-md active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer ${
              isLocked
                ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-900/30'
                : 'bg-rose-600 hover:bg-rose-700 shadow-rose-900/30'
            }`}
          >
            <FontAwesomeIcon icon={isLocked ? faUnlock : faLock} className="text-xs" />
            <span className="truncate">{isLocked ? 'Enable Editing' : 'Lock Room (Read-Only)'}</span>
          </button>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
