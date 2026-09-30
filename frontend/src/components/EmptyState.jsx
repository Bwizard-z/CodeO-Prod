// components/EmptyState.jsx - Clean empty state when no rooms are present
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faFolderOpen } from '@fortawesome/free-solid-svg-icons';

export function EmptyState({
  title = 'No rooms yet. Create one to get started!',
  description = 'Create a real-time room to collaborate, edit code, and compile together.',
  actionText = 'Create New Room',
  onAction,
}) {
  return (
    <div className="w-full py-16 px-6 rounded-2xl border border-dashed border-white/10 bg-[#080b10] flex flex-col items-center justify-center text-center select-none">
      <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-neutral-400 mb-4 shadow-inner">
        <FontAwesomeIcon icon={faFolderOpen} className="text-2xl" />
      </div>

      <h3 className="text-xl font-serif italic text-white mb-2">
        {title}
      </h3>

      <p className="text-neutral-400 text-xs font-sans max-w-md leading-relaxed mb-6">
        {description}
      </p>

      {onAction && (
        <button
          type="button"
          onClick={onAction}
          className="bg-white text-black px-6 py-2.5 rounded-full font-sans font-semibold text-sm flex items-center gap-2 hover:bg-neutral-200 transition-all shadow-md active:scale-95 cursor-pointer"
        >
          <FontAwesomeIcon icon={faPlus} className="text-xs" />
          <span>{actionText}</span>
        </button>
      )}
    </div>
  );
}

export default EmptyState;
