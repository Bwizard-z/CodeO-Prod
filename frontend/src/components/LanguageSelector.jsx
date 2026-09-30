// components/LanguageSelector.jsx - Language Switcher Component
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCode } from '@fortawesome/free-solid-svg-icons';

export const SUPPORTED_LANGUAGES = [
  { value: 'javascript', label: 'JavaScript', monacoId: 'javascript', ext: '.js' },
  { value: 'python', label: 'Python', monacoId: 'python', ext: '.py' },
  { value: 'java', label: 'Java', monacoId: 'java', ext: '.java' },
  { value: 'cpp', label: 'C++', monacoId: 'cpp', ext: '.cpp' },
  { value: 'typescript', label: 'TypeScript', monacoId: 'typescript', ext: '.ts' },
];

export function LanguageSelector({ language = 'javascript', onChange, disabled = false }) {
  const handleChange = (e) => {
    const selected = e.target.value;
    try {
      localStorage.setItem('codeo_preferred_language', selected);
    } catch {
      // Ignored
    }
    if (onChange) {
      onChange(selected);
    }
  };

  const safeLang = (typeof language === 'string' ? language : 'javascript').toLowerCase();
  const currentLang = SUPPORTED_LANGUAGES.find((l) => l.value === safeLang) || SUPPORTED_LANGUAGES[0];

  return (
    <div className="relative inline-flex items-center">
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-sans text-white transition-all">
        <FontAwesomeIcon icon={faCode} className="text-[#fbff47] text-xs" />
        <select
          value={currentLang.value}
          onChange={handleChange}
          disabled={disabled}
          title="Select programming language"
          className="bg-transparent text-white font-medium text-xs focus:outline-none cursor-pointer pr-1 appearance-none"
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value} className="bg-[#0e121a] text-white">
              {lang.label}
            </option>
          ))}
        </select>
        <span className="text-[10px] text-neutral-400 font-mono">({currentLang.ext})</span>
      </div>
    </div>
  );
}

export default LanguageSelector;
