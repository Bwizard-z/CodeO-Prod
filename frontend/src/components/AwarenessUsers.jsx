// components/AwarenessUsers.jsx - Real-Time Collaborator List with Live Cursors & Typing Presence
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCrown, faPenNib, faMicrophone, faMicrophoneSlash } from '@fortawesome/free-solid-svg-icons';

import UserAvatar from './UserAvatar';

/**
 * AwarenessUsers
 * Renders deduplicated list of active room collaborators with their live cursor position,
 * assigned color badges, host crowns, and typing activity.
 *
 * @param {Array} users - Deduplicated list of collaborators
 * @param {object} micStates - Map of user ID to microphone toggle state
 * @param {function} onToggleMic - Function to toggle mic
 */
export function AwarenessUsers({ users = [], micStates = {}, onToggleMic }) {
  if (!Array.isArray(users) || users.length === 0) {
    return (
      <div className="py-6 text-center text-neutral-500 font-sans text-xs italic">
        Connecting collaborators...
      </div>
    );
  }

  return (
    <div className="space-y-2 overflow-y-auto pr-0.5">
      {users.map((user, idx) => {
        const isMicOn = micStates[user.id] ?? false;
        const lineNum = user.cursor?.line || user.cursor?.lineNumber;
        const colNum = user.cursor?.column;

        return (
          <div
            key={user.id || idx}
            className="flex items-center justify-between p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 transition-all group"
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              {/* User Avatar with Profile Picture & Initials Fallback */}
              <UserAvatar
                user={user}
                size={32}
                showStatusDot
                status={user.isTyping ? 'typing' : user.cursor ? 'in-editor' : 'viewing'}
              />

              <div className="min-w-0 flex-1">
                {/* User Name & Badges */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-sans font-semibold text-xs tracking-wide truncate text-neutral-100 max-w-[110px]">
                    {user.name}
                  </span>

                  {user.isLocal && (
                    <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[9px] font-sans font-medium">
                      You
                    </span>
                  )}

                  {user.isHost && (
                    <span
                      className="w-3.5 h-3.5 rounded-full bg-amber-400 text-black font-sans font-bold text-[8px] flex items-center justify-center shadow-sm"
                      title="Room Host"
                    >
                      <FontAwesomeIcon icon={faCrown} />
                    </span>
                  )}
                </div>

                {/* Real-time Line & Column Indicator / Typing status */}
                <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 font-mono mt-0.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: user.color || '#3b82f6' }}
                  />
                  {user.isTyping ? (
                    <span className="text-emerald-400 font-medium truncate flex items-center gap-1">
                      <FontAwesomeIcon icon={faPenNib} className="text-[9px] animate-bounce" />
                      Typing...
                    </span>
                  ) : lineNum ? (
                    <span className="text-[#fbff47] font-medium truncate">
                      Line {lineNum}
                      {colNum ? `, Col ${colNum}` : ''}
                    </span>
                  ) : (
                    <span className="text-neutral-500 italic truncate">
                      {user.isLocal ? 'In Editor' : 'Viewing'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Audio / Mic Toggle button */}
            {onToggleMic && (
              <button
                type="button"
                onClick={() => onToggleMic(user.id)}
                className="text-neutral-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors w-7 h-7 flex items-center justify-center shrink-0 ml-1 cursor-pointer"
                title={isMicOn ? 'Mute' : 'Unmute'}
              >
                <FontAwesomeIcon
                  icon={isMicOn ? faMicrophone : faMicrophoneSlash}
                  className={`text-xs ${isMicOn ? 'text-[#34d399]' : 'text-neutral-500'}`}
                />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default AwarenessUsers;
