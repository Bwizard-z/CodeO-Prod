// components/CreateRoomModal.jsx - Modal dialog for creating a collaborative room
import React, { useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faPlus } from '@fortawesome/free-solid-svg-icons';
import CreateRoomForm from './CreateRoomForm';

export function CreateRoomModal({
  isOpen,
  onClose,
  onSuccess,
  roomCount = 0,
  roomLimit = 10,
}) {
  // Close on Escape key press
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
      {/* Modal Dialog */}
      <div
        className="relative w-full max-w-lg bg-[#0a0d14] border border-white/15 rounded-2xl p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white text-xs">
              <FontAwesomeIcon icon={faPlus} />
            </div>
            <div>
              <h2 className="text-xl font-serif italic text-white tracking-tight">
                Create Collaborative Room
              </h2>
              <p className="text-xs font-sans text-neutral-400">
                Setup your workspace and invite team members to code live.
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

        {/* Body Form */}
        <CreateRoomForm
          onSuccess={(room) => {
            if (onSuccess) onSuccess(room);
            onClose();
          }}
          onCancel={onClose}
          roomCount={roomCount}
          roomLimit={roomLimit}
        />
      </div>
    </div>
  );
}

export default CreateRoomModal;
