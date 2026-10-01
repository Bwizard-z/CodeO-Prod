// components/AudioCall.jsx - Simple & Clean Agora Audio Call Controller & Speaker Indicator
import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faMicrophone,
  faMicrophoneSlash,
  faPhoneSlash,
  faUsers,
  faTriangleExclamation,
  faSpinner,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { useAudio } from '../hooks/useAudio';

function AudioCallView({
  isConnected = false,
  isConnecting = false,
  isMuted = false,
  remoteUsers = [],
  localVolume = 0,
  error = null,
  setError = () => {},
  joinCall = () => {},
  leaveCall = () => {},
  toggleMute = () => {},
  roomCode = '',
  userId = null,
  userName = 'You',
  members = [],
  className = '',
}) {
  const [showErrorToast, setShowErrorToast] = useState(false);

  // Auto-dismiss or show error toast
  useEffect(() => {
    if (error) {
      setShowErrorToast(true);
      const timer = setTimeout(() => setShowErrorToast(false), 5000);
      return () => clearTimeout(timer);
    } else {
      setShowErrorToast(false);
    }
  }, [error]);

  const totalInCall = isConnected ? 1 + remoteUsers.length : 0;

  return (
    <div className={`relative flex items-center gap-2 select-none shrink-0 ${className}`}>
      {/* Error Floating Toast */}
      {showErrorToast && error && (
        <div className="absolute top-full mt-2 right-0 z-50 min-w-[240px] max-w-xs bg-red-950/95 border border-red-500/40 text-red-200 text-xs px-3 py-2 rounded-lg shadow-xl flex items-center justify-between gap-2 animate-fade-in backdrop-blur-md">
          <div className="flex items-center gap-2">
            <FontAwesomeIcon icon={faTriangleExclamation} className="text-red-400 text-xs shrink-0" />
            <span className="font-sans leading-tight">{error}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowErrorToast(false);
              setError?.(null);
            }}
            className="text-red-400 hover:text-white p-0.5 cursor-pointer"
          >
            <FontAwesomeIcon icon={faXmark} className="text-xs" />
          </button>
        </div>
      )}

      {/* When NOT Connected: Simple Join Voice Button */}
      {!isConnected ? (
        <button
          type="button"
          onClick={() => joinCall(roomCode, userId, 'publisher')}
          disabled={isConnecting}
          title="Join voice chat"
          className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white transition-colors text-xs font-medium cursor-pointer disabled:opacity-50 shadow-sm shrink-0"
        >
          {isConnecting ? (
            <>
              <FontAwesomeIcon icon={faSpinner} className="animate-spin text-xs text-amber-400 shrink-0" />
              <span className="hidden sm:inline">Connecting...</span>
            </>
          ) : (
            <>
              <FontAwesomeIcon icon={faMicrophone} className="text-xs text-neutral-400 shrink-0" />
              <span className="hidden sm:inline">Voice</span>
            </>
          )}
        </button>
      ) : (
        /* When CONNECTED: Minimal, Clean Voice Bar (No Emojis) */
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-xs font-sans shadow-sm shrink-0">
          {/* Status Dot + Text */}
          <div
            className="flex items-center gap-1.5"
            title={isMuted ? 'Microphone muted' : 'Voice connected'}
          >
            <span
              className={`w-2 h-2 rounded-full transition-colors ${
                isMuted ? 'bg-amber-400' : 'bg-emerald-500 animate-pulse'
              }`}
            />
            <span className="text-neutral-300 font-medium hidden sm:inline">
              {isMuted ? 'Muted' : 'Live'}
            </span>
          </div>

          {/* Voice Participant Count */}
          <div
            className="flex items-center gap-1 text-neutral-400 text-xs px-0.5"
            title={`${totalInCall} participant${totalInCall === 1 ? '' : 's'} in voice`}
          >
            <FontAwesomeIcon icon={faUsers} className="text-[11px]" />
            <span className="font-mono text-neutral-300 text-[11px]">{totalInCall}</span>
          </div>

          <div className="h-3.5 w-px bg-neutral-800 mx-0.5" />

          {/* Mute / Unmute Button */}
          <button
            type="button"
            onClick={toggleMute}
            title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            className={`p-1.5 rounded-md transition-colors cursor-pointer flex items-center justify-center ${
              isMuted
                ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <FontAwesomeIcon
              icon={isMuted ? faMicrophoneSlash : faMicrophone}
              className="text-xs"
            />
          </button>

          {/* Leave Voice Button */}
          <button
            type="button"
            onClick={leaveCall}
            title="Leave voice"
            className="p-1.5 rounded-md text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer flex items-center justify-center"
          >
            <FontAwesomeIcon icon={faPhoneSlash} className="text-xs" />
          </button>
        </div>
      )}
    </div>
  );
}

function AudioCallWithHook(props) {
  const audio = useAudio({
    roomCode: props.roomCode,
    userId: props.userId,
    userName: props.userName,
    socket: props.socket,
    autoJoin: props.autoJoin,
  });

  return <AudioCallView {...props} {...audio} />;
}

export function AudioCall(props) {
  if (props.audio) {
    return <AudioCallView {...props} {...props.audio} />;
  }
  return <AudioCallWithHook {...props} />;
}

export default AudioCall;
