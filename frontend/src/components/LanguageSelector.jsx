// components/LanguageSelector.jsx - Custom Floating Language Switcher Component
import React, { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faCheck } from '@fortawesome/free-solid-svg-icons';

export const SUPPORTED_LANGUAGES = [
  {
    value: 'javascript',
    label: 'JavaScript',
    monacoId: 'javascript',
    ext: '.js',
    iconUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg',
  },
  {
    value: 'python',
    label: 'Python',
    monacoId: 'python',
    ext: '.py',
    iconUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg',
  },
  {
    value: 'java',
    label: 'Java',
    monacoId: 'java',
    ext: '.java',
    iconUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/java/java-original.svg',
  },
  {
    value: 'cpp',
    label: 'C++',
    monacoId: 'cpp',
    ext: '.cpp',
    iconUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/cplusplus/cplusplus-original.svg',
  },
  {
    value: 'typescript',
    label: 'TypeScript',
    monacoId: 'typescript',
    ext: '.ts',
    iconUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg',
  },
];

export function LanguageSelector({
  language = 'javascript',
  onChange,
  disabled = false,
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const safeLang = (typeof language === 'string' ? language : 'javascript').toLowerCase();
  const currentLang =
    SUPPORTED_LANGUAGES.find((l) => l.value === safeLang || (safeLang === 'c++' && l.value === 'cpp')) ||
    SUPPORTED_LANGUAGES[0];

  const handleSelect = (langValue) => {
    try {
      localStorage.setItem('codeo_preferred_language', langValue);
    } catch {
      // Ignored
    }
    if (onChange) {
      onChange(langValue);
    }
    setIsOpen(false);
  };

  // Close dropdown on click outside or Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={dropdownRef} className={`relative inline-flex items-center shrink-0 ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        disabled={disabled}
        title={disabled ? 'Room is locked' : 'Change programming language'}
        className={`flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-sans text-white transition-all duration-150 select-none ${
          disabled
            ? 'opacity-50 cursor-not-allowed bg-white/5 border-white/5'
            : isOpen
            ? 'bg-white/10 border-white/30 shadow-md ring-1 ring-white/20'
            : 'bg-white/5 hover:bg-white/10 border-white/10 hover:border-white/20 active:scale-95'
        }`}
      >
        <img
          src={currentLang.iconUrl}
          alt={currentLang.label}
          className="w-4 h-4 object-contain shrink-0"
          loading="lazy"
        />
        <span className="font-semibold text-xs tracking-tight text-neutral-100 max-w-[70px] sm:max-w-none truncate">
          {currentLang.label}
        </span>
        <span className="hidden sm:inline text-[10px] text-neutral-400 font-mono">
          ({currentLang.ext})
        </span>
        <FontAwesomeIcon
          icon={faChevronDown}
          className={`text-[9px] text-neutral-400 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-white' : ''
          }`}
        />
      </button>

      {/* Floating Menu */}
      {isOpen && (
        <div className="absolute top-full mt-1.5 right-0 z-50 min-w-[175px] sm:min-w-[190px] rounded-xl bg-[#0c1017]/95 backdrop-blur-xl border border-white/15 p-1.5 shadow-2xl shadow-black/80 flex flex-col gap-0.5 animate-in fade-in duration-150">
          <div className="px-2 py-1 text-[10px] font-sans font-semibold uppercase tracking-wider text-neutral-400 select-none border-b border-white/5 mb-1">
            Language
          </div>
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isSelected = lang.value === currentLang.value;
            return (
              <button
                key={lang.value}
                type="button"
                onClick={() => handleSelect(lang.value)}
                className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-sans text-left transition-all ${
                  isSelected
                    ? 'bg-[#fbff47]/10 text-white font-semibold'
                    : 'text-neutral-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <img
                    src={lang.iconUrl}
                    alt={lang.label}
                    className="w-4 h-4 object-contain shrink-0"
                    loading="lazy"
                  />
                  <span className="truncate">{lang.label}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-mono text-neutral-400">{lang.ext}</span>
                  {isSelected && (
                    <FontAwesomeIcon icon={faCheck} className="text-[#fbff47] text-[10px]" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default LanguageSelector;
