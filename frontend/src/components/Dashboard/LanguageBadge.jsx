import React from 'react';

export const LanguageBadge = ({ language = 'javascript' }) => {
  const normalized = (language || '').toLowerCase();

  if (normalized.includes('python') || normalized === 'py') {
    return (
      <div className="w-12 h-12 rounded-xl bg-[#0f1f38] border border-[#3874a4]/40 flex items-center justify-center p-2.5 shadow-md">
        <svg viewBox="0 0 256 256" className="w-full h-full object-contain">
          <defs>
            <linearGradient id="pyBlue" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3874a4" />
              <stop offset="100%" stopColor="#25557c" />
            </linearGradient>
            <linearGradient id="pyYellow" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffd845" />
              <stop offset="100%" stopColor="#f5b820" />
            </linearGradient>
          </defs>
          <path
            fill="url(#pyBlue)"
            d="M126.9 8.2c-47.5 0-44.5 20.6-44.5 20.6l.1 21.4h45.2v6.4H65.8C18.6 56.6 22 97.4 22 97.4s-3.7 24.3 22 24.3h13.1v-18.4c0-21 17.5-19.8 17.5-19.8h45.4c17.5 0 16.3-16.7 16.3-16.7V25.2c0-17-9.4-17-9.4-17zm-25.1 13.7c4.6 0 8.3 3.7 8.3 8.3s-3.7 8.3-8.3 8.3-8.3-3.7-8.3-8.3 3.7-8.3 8.3-8.3z"
          />
          <path
            fill="url(#pyYellow)"
            d="M129.1 247.8c47.5 0 44.5-20.6 44.5-20.6l-.1-21.4h-45.2v-6.4h61.9c47.2 0 43.8-40.8 43.8-40.8s3.7-24.3-22-24.3h-13.1v18.4c0 21-17.5 19.8-17.5 19.8H136c-17.5 0-16.3 16.7-16.3 16.7v41.6c0 17 9.4 17 9.4 17zm25.1-13.7c-4.6 0-8.3-3.7-8.3-8.3s3.7-8.3 8.3-8.3 8.3 3.7 8.3 8.3-3.7 8.3-8.3 8.3z"
          />
        </svg>
      </div>
    );
  }

  if (normalized.includes('javascript') || normalized === 'js') {
    return (
      <div className="w-12 h-12 rounded-xl bg-[#f7df1e] flex items-center justify-center p-2 shadow-md">
        <span className="font-sans font-black text-black text-xl tracking-tighter select-none">
          JS
        </span>
      </div>
    );
  }

  if (normalized.includes('c++') || normalized.includes('cpp')) {
    return (
      <div className="w-12 h-12 rounded-xl bg-[#00599c] flex items-center justify-center p-1.5 shadow-md border border-[#007cdb]">
        <span className="font-sans font-black text-white text-lg tracking-tight select-none">
          C++
        </span>
      </div>
    );
  }

  if (normalized.includes('java') && !normalized.includes('script')) {
    return (
      <div className="w-12 h-12 rounded-xl bg-[#2b1010] border border-[#ea2d2e]/50 flex items-center justify-center p-2 shadow-md">
        <svg viewBox="0 0 24 24" className="w-8 h-8 fill-[#ea2d2e]">
          <path d="M4 19h16v1H4v-1zm14.5-9c.3 0 .5.1.7.3.2.2.3.4.3.7 0 .8-.5 1.5-1.2 1.8-.2.8-.7 1.4-1.3 1.9-.8.7-1.8 1.1-2.9 1.2-.5.5-1.1.8-1.8 1-.9.2-1.8.3-2.7.2-.6 0-1.2-.1-1.8-.3-.6-.2-1.1-.5-1.5-.9-.4-.4-.7-.9-.8-1.4-.2-.5-.2-1-.2-1.6 0-.6.1-1.2.3-1.8.2-.5.5-1 .8-1.5.3-.4.8-.8 1.3-1.1.5-.3 1.1-.5 1.7-.7.6-.2 1.3-.2 1.9-.2.5 0 1 .1 1.5.2.5.1.9.3 1.3.6.4.2.8.5 1.1.9.3.4.5.8.6 1.3.7.1 1.3.4 1.7.8.2.2.4.4.4.7zm-2.8 1.7c-.1-.7-.4-1.3-.9-1.7-.5-.4-1.1-.6-1.8-.6-.6 0-1.2.2-1.7.5-.5.3-.9.7-1.2 1.2-.3.5-.5 1-.6 1.5-.1.5-.1 1 0 1.5.1.4.3.8.6 1.1.3.3.7.5 1.1.6.5.1 1 .1 1.4 0 .5-.1.9-.3 1.3-.6.5-.4.8-.9 1-1.5.4-.1.7-.3.9-.6.2-.3.2-.6.1-.9-.1-.2-.4-.4-.7-.4-.2-.1-.4-.1-.5-.1z" />
          <path d="M9 3c.5.8.5 1.8 0 2.5-.5.8-1.5 1.2-2 2-.5.8-.5 1.8 0 2.5.2.3.4.6.7.8-.5-.8-.5-1.8 0-2.5.5-.8 1.5-1.2 2-2 .5-.8.5-1.8 0-2.5-.2-.3-.4-.6-.7-.8z" />
        </svg>
      </div>
    );
  }

  if (normalized.includes('react')) {
    return (
      <div className="w-12 h-12 rounded-xl bg-[#0d2238] border border-[#61dafb]/40 flex items-center justify-center p-2 shadow-md">
        <svg viewBox="-11.5 -10.23174 23 20.46348" className="w-8 h-8 fill-none stroke-[#61dafb]">
          <circle cx="0" cy="0" r="2.05" fill="#61dafb" />
          <g strokeWidth="1">
            <ellipse rx="11" ry="4.2" />
            <ellipse rx="11" ry="4.2" transform="rotate(60)" />
            <ellipse rx="11" ry="4.2" transform="rotate(120)" />
          </g>
        </svg>
      </div>
    );
  }

  if (normalized.includes('node')) {
    return (
      <div className="w-12 h-12 rounded-xl bg-[#0e2716] border border-[#539e43]/40 flex items-center justify-center p-2 shadow-md">
        <svg viewBox="0 0 24 24" className="w-8 h-8 fill-[#539e43]">
          <path d="M12 2L3 7.2v10.4L12 22.8l9-5.2V7.2L12 2zm0 2.3l6.9 4v7.9L12 20.2l-6.9-4V8.3L12 4.3zm-1 3.7v8h2v-8h-2z" />
        </svg>
      </div>
    );
  }

  if (normalized.includes('html')) {
    return (
      <div className="w-12 h-12 rounded-xl bg-[#e34f26] flex items-center justify-center p-2 shadow-md">
        <span className="font-sans font-black text-white text-xl tracking-tight select-none">
          5
        </span>
      </div>
    );
  }

  if (normalized.includes('css')) {
    return (
      <div className="w-12 h-12 rounded-xl bg-[#1572b6] flex items-center justify-center p-2 shadow-md">
        <span className="font-sans font-black text-white text-xl tracking-tight select-none">
          3
        </span>
      </div>
    );
  }

  if (normalized.includes('typescript') || normalized === 'ts') {
    return (
      <div className="w-12 h-12 rounded-xl bg-[#3178c6] flex items-center justify-center p-2 shadow-md">
        <span className="font-sans font-black text-white text-xl tracking-tight select-none">
          TS
        </span>
      </div>
    );
  }

  // Default Code Icon Badge
  return (
    <div className="w-12 h-12 rounded-xl bg-[#1e293b] border border-white/20 flex items-center justify-center p-2 shadow-md">
      <span className="font-mono font-bold text-white text-base select-none">&lt;/&gt;</span>
    </div>
  );
};

export default LanguageBadge;
