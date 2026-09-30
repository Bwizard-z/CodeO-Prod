// components/UiScaleControl.jsx - Icon-only screen scale adjuster with clean sizing presets and portal rendering
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLaptop, faCheck } from '@fortawesome/free-solid-svg-icons';
import { useUiScale } from '../hooks/useUiScale';

export const CLEAN_SCALE_OPTIONS = [
  { id: 'compact', label: 'Compact', percent: '85%' },
  { id: 'small', label: 'Small', percent: '90%' },
  { id: 'normal', label: 'Default', percent: '100%' },
  { id: 'large', label: 'Large', percent: '110%' },
];

export function UiScaleControl({ className = '' }) {
  const { scale, setScale } = useUiScale();
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);
  const [coords, setCoords] = useState({ top: 0, right: 0 });

  // Calculate position relative to viewport so dropdown can never be clipped or hidden inside Monaco
  const updatePosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 6,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
    }
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  // Close on click outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(e.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const dropdownMenu = isOpen && typeof document !== 'undefined' ? (
    createPortal(
      <div
        ref={dropdownRef}
        style={{
          position: 'fixed',
          top: `${coords.top}px`,
          right: `${coords.right}px`,
          zIndex: 99999,
        }}
        className="w-48 bg-[#0c1220]/95 border border-white/20 text-white rounded-xl shadow-2xl shadow-black/80 p-1.5 animate-fade-in backdrop-blur-xl select-none transition-all"
      >
        <div className="px-2.5 py-1.5 border-b border-white/10 mb-1">
          <span className="text-[10px] font-sans font-semibold uppercase tracking-wider text-neutral-400">
            Screen Sizing
          </span>
        </div>

        <div className="space-y-0.5">
          {CLEAN_SCALE_OPTIONS.map((opt) => {
            const active = scale === opt.id || (scale === 'auto' && opt.id === 'small');
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setScale(opt.id);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-sans flex items-center justify-between transition-colors cursor-pointer ${
                  active
                    ? 'bg-white/15 text-white font-semibold'
                    : 'text-neutral-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="text-xs">{opt.label}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-neutral-400">
                    {opt.percent}
                  </span>
                  {active && (
                    <FontAwesomeIcon
                      icon={faCheck}
                      className="text-[10px] text-[#fbff47]"
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>,
      document.body
    )
  ) : null;

  return (
    <div className={`relative inline-block text-left ${className}`}>
      {/* Icon-only Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        title="Adjust Screen Sizing"
        aria-label="Adjust Screen Sizing"
        className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all cursor-pointer select-none active:scale-95 ${
          isOpen
            ? 'border-[#fbff47] bg-[#1a233b] text-[#fbff47] shadow-md ring-1 ring-[#fbff47]/50'
            : 'border-white/10 bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white shadow-sm'
        }`}
      >
        <FontAwesomeIcon
          icon={faLaptop}
          className="text-xs text-[#fbff47]"
        />
      </button>

      {/* Render popover menu into body via Portal to guarantee it is NEVER clipped by Monaco Editor */}
      {dropdownMenu}
    </div>
  );
}

export default UiScaleControl;
