// components/JoinRoomForm.jsx - Component to join an existing room via code or invite token
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight, faSpinner, faTriangleExclamation, faDoorOpen } from '@fortawesome/free-solid-svg-icons';
import { useRoom } from '../hooks/useRoom';

export function JoinRoomForm({
  onSuccess,
  onCancel,
  compact = false,
}) {
  const navigate = useNavigate();
  const { joinRoom, actionLoading, error: hookError } = useRoom();

  const [code, setCode] = useState('');
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      setLocalError('Please enter a room code.');
      return;
    }

    const result = await joinRoom(cleanCode);

    if (result.success && result.code) {
      if (onSuccess) onSuccess(result.room);
      navigate(`/editor/${result.code}`);
    } else {
      setLocalError(result.error || 'Room not found or could not be joined.');
    }
  };

  const displayError = localError || hookError;

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4 select-none">
      {displayError && (
        <div className="p-3 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs font-sans flex items-start gap-2">
          <FontAwesomeIcon icon={faTriangleExclamation} className="mt-0.5 shrink-0 text-red-400" />
          <span>{displayError}</span>
        </div>
      )}

      <div>
        <label className="block text-xs font-sans font-semibold text-neutral-300 mb-1.5">
          Enter 6-Character Room Code or Invite Token
        </label>
        <div className="relative flex items-center">
          <input
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              if (localError) setLocalError('');
            }}
            placeholder="e.g. ABC123"
            maxLength={36}
            required
            disabled={actionLoading}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-500 font-mono uppercase tracking-wider focus:outline-none focus:border-[#fbff47] focus:ring-1 focus:ring-[#fbff47] transition-all"
          />
        </div>
      </div>

      <div className="pt-2 flex items-center justify-end gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={actionLoading}
            className="px-4 py-2.5 rounded-full text-xs font-sans font-semibold text-neutral-400 hover:text-white hover:bg-white/5 transition-all"
          >
            Cancel
          </button>
        )}

        <button
          type="submit"
          disabled={actionLoading || !code.trim()}
          className="bg-white text-black px-6 py-2.5 rounded-full font-sans font-semibold text-sm flex items-center gap-2 hover:bg-neutral-200 transition-all active:scale-95 shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {actionLoading ? (
            <>
              <FontAwesomeIcon icon={faSpinner} className="animate-spin text-xs" />
              <span>Joining Room...</span>
            </>
          ) : (
            <>
              <span>Join Room</span>
              <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}

export default JoinRoomForm;
