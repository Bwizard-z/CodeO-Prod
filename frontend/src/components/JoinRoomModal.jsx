// components/JoinRoomModal.jsx - Modal for joining a room
import React, { useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faDoorOpen } from '@fortawesome/free-solid-svg-icons';
import JoinRoomForm from './JoinRoomForm';

export function JoinRoomModal({
  isOpen,
  onClose,
  onSuccess,
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in select-none">
      <div
        className="relative w-full max-w-md bg-[#0a0d14] border border-white/15 rounded-2xl p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white text-xs">
              <FontAwesomeIcon icon={faDoorOpen} />
            </div>
            <div>
              <h2 className="text-xl font-serif italic text-white tracking-tight">
                Join Collaborative Room
              </h2>
              <p className="text-xs font-sans text-neutral-400">
                Enter a room code or invite link to join the workspace.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <FontAwesomeIcon icon={faXmark} className="text-sm" />
          </button>
        </div>

        <JoinRoomForm
          onSuccess={(room) => {
            if (onSuccess) onSuccess(room);
            onClose();
          }}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}

export default JoinRoomModal;
