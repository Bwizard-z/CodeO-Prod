// components/Dashboard/LanguageBadge.jsx - Modern Crisp Language Badge
import React, { useState } from 'react';

const LANGUAGE_ICONS = {
  python: {
    name: 'Python',
    url: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg',
    abbr: 'PY',
    bgColor: 'bg-[#0f1a2e]',
    borderColor: 'border-[#3776ab]/30',
  },
  py: {
    name: 'Python',
    url: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg',
    abbr: 'PY',
    bgColor: 'bg-[#0f1a2e]',
    borderColor: 'border-[#3776ab]/30',
  },
  javascript: {
    name: 'JavaScript',
    url: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg',
    abbr: 'JS',
    bgColor: 'bg-[#1f1d0b]',
    borderColor: 'border-[#f7df1e]/30',
  },
  js: {
    name: 'JavaScript',
    url: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg',
    abbr: 'JS',
    bgColor: 'bg-[#1f1d0b]',
    borderColor: 'border-[#f7df1e]/30',
  },
  typescript: {
    name: 'TypeScript',
    url: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg',
    abbr: 'TS',
    bgColor: 'bg-[#0c182c]',
    borderColor: 'border-[#3178c6]/30',
  },
  ts: {
    name: 'TypeScript',
    url: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg',
    abbr: 'TS',
    bgColor: 'bg-[#0c182c]',
    borderColor: 'border-[#3178c6]/30',
  },
  java: {
    name: 'Java',
    url: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/java/java-original.svg',
    abbr: 'JAVA',
    bgColor: 'bg-[#1e1010]',
    borderColor: 'border-[#e76f00]/30',
  },
  cpp: {
    name: 'C++',
    url: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/cplusplus/cplusplus-original.svg',
    abbr: 'C++',
    bgColor: 'bg-[#0a1728]',
    borderColor: 'border-[#00599c]/30',
  },
  'c++': {
    name: 'C++',
    url: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/cplusplus/cplusplus-original.svg',
    abbr: 'C++',
    bgColor: 'bg-[#0a1728]',
    borderColor: 'border-[#00599c]/30',
  },
  c: {
    name: 'C',
    url: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/c/c-original.svg',
    abbr: 'C',
    bgColor: 'bg-[#0a1728]',
    borderColor: 'border-[#00599c]/30',
  },
  html: {
    name: 'HTML5',
    url: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/html5/html5-original.svg',
    abbr: 'HTML',
    bgColor: 'bg-[#220e09]',
    borderColor: 'border-[#e34f26]/30',
  },
  css: {
    name: 'CSS3',
    url: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/css3/css3-original.svg',
    abbr: 'CSS',
    bgColor: 'bg-[#08182c]',
    borderColor: 'border-[#1572b6]/30',
  },
  react: {
    name: 'React',
    url: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg',
    abbr: 'REACT',
    bgColor: 'bg-[#081b28]',
    borderColor: 'border-[#61dafb]/30',
  },
  node: {
    name: 'Node.js',
    url: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg',
    abbr: 'NODE',
    bgColor: 'bg-[#0e1e12]',
    borderColor: 'border-[#339933]/30',
  },
  go: {
    name: 'Go',
    url: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/go/go-original.svg',
    abbr: 'GO',
    bgColor: 'bg-[#081d28]',
    borderColor: 'border-[#00add8]/30',
  },
  rust: {
    name: 'Rust',
    url: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/rust/rust-original.svg',
    abbr: 'RS',
    bgColor: 'bg-[#1e130c]',
    borderColor: 'border-[#dea584]/30',
  },
};

export const LanguageBadge = ({ language = 'javascript', className = '' }) => {
  const [imgError, setImgError] = useState(false);
  const normalized = (language || 'javascript').toLowerCase().trim();
  const config = LANGUAGE_ICONS[normalized] || {
    name: language || 'Code',
    url: null,
    abbr: (language || 'DEV').substring(0, 3).toUpperCase(),
    bgColor: 'bg-white/5',
    borderColor: 'border-white/10',
  };

  return (
    <div
      title={config.name}
      className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl ${config.bgColor} border ${config.borderColor} flex items-center justify-center p-2.5 shadow-md shadow-black/40 transition-all select-none shrink-0 ${className}`}
    >
      {config.url && !imgError ? (
        <img
          src={config.url}
          alt={config.name}
          onError={() => setImgError(true)}
          className="w-full h-full object-contain filter drop-shadow select-none pointer-events-none"
          loading="lazy"
        />
      ) : (
        <span className="font-mono font-black text-xs sm:text-sm text-neutral-300 tracking-wider">
          {config.abbr}
        </span>
      )}
    </div>
  );
};

export default LanguageBadge;
