// components/CreateRoomForm.jsx - Form to create a collaborative room
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faSpinner, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { useRoom } from '../hooks/useRoom';

const SUPPORTED_LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'python', label: 'Python' },
  { value: 'cpp', label: 'C++' },
  { value: 'java', label: 'Java' },
  { value: 'rust', label: 'Rust' },
  { value: 'go', label: 'Go' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'c', label: 'C' },
  { value: 'php', label: 'PHP' },
  { value: 'html', label: 'HTML/CSS' },
];

export function CreateRoomForm({
  onSuccess,
  onCancel,
  roomCount = 0,
  roomLimit = 10,
}) {
  const navigate = useNavigate();
  const { createRoom, actionLoading, error: hookError } = useRoom();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [localError, setLocalError] = useState('');

  const isAtLimit = roomCount >= roomLimit;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    if (isAtLimit) {
      setLocalError(`You have reached the limit of ${roomLimit} active rooms. Please delete an existing room to create a new one.`);
      return;
    }

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setLocalError('Room title is required.');
      return;
    }

    if (cleanTitle.length < 2) {
      setLocalError('Room title must be at least 2 characters.');
      return;
    }

    const result = await createRoom({
      title: cleanTitle,
      description: description.trim(),
      language,
    });

    if (result.success && result.code) {
      if (onSuccess) {
        onSuccess(result.room);
      }
      navigate(`/editor/${result.code}`);
    } else {
      setLocalError(result.error || 'Failed to create room.');
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

      {/* Room Title */}
      <div>
        <label className="block text-xs font-sans font-semibold text-neutral-300 mb-1.5">
          Room Title <span className="text-[#fbff47]">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (localError) setLocalError('');
          }}
          placeholder="e.g. Graph Algorithms Masterclass"
          required
          maxLength={255}
          disabled={actionLoading}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#fbff47] focus:ring-1 focus:ring-[#fbff47] transition-all font-sans"
        />
      </div>

      {/* Language Selector */}
      <div>
        <label className="block text-xs font-sans font-semibold text-neutral-300 mb-1.5">
          Default Language
        </label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          disabled={actionLoading}
          className="w-full bg-[#111622] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#fbff47] focus:ring-1 focus:ring-[#fbff47] transition-all font-sans cursor-pointer"
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value} className="bg-[#0e121a] text-white">
              {lang.label}
            </option>
          ))}
        </select>
      </div>

      {/* Optional Description */}
      <div>
        <label className="block text-xs font-sans font-semibold text-neutral-300 mb-1.5">
          Description <span className="text-neutral-500 font-normal">(Optional)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of the room's purpose or project..."
          rows={3}
          maxLength={500}
          disabled={actionLoading}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#fbff47] focus:ring-1 focus:ring-[#fbff47] transition-all font-sans resize-none"
        />
      </div>

      {/* Action Buttons */}
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
          disabled={actionLoading || isAtLimit}
          className="bg-white text-black px-6 py-2.5 rounded-full font-sans font-semibold text-sm flex items-center gap-2 hover:bg-neutral-200 transition-all active:scale-95 shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {actionLoading ? (
            <>
              <FontAwesomeIcon icon={faSpinner} className="animate-spin text-xs" />
              <span>Creating Room...</span>
            </>
          ) : (
            <>
              <FontAwesomeIcon icon={faPlus} className="text-xs" />
              <span>Create Room</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}

export default CreateRoomForm;
