import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCopyright } from '@fortawesome/free-solid-svg-icons';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import codeoLogo from '../assets/Logo.png';

export const Footer = () => {
  return (
    <footer className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-5">
      <div className="bg-[#0c1322] border border-white/5 rounded-full px-5 sm:px-8 py-2 sm:py-2.5 flex items-center justify-between shadow-2xl backdrop-blur-sm">
        {/* Brand Logo */}
        <div className="flex items-center select-none">
          <img
            src={codeoLogo}
            alt="CodeO"
            className="h-4 sm:h-5 w-auto object-contain brightness-105"
          />
        </div>

        {/* GitHub link with Font Awesome */}
        <a
          href="https://github.com"
          target="_blank"
          rel="noreferrer"
          aria-label="CodeO GitHub Repository"
          className="text-white hover:text-neutral-300 transition-colors"
        >
          <FontAwesomeIcon icon={faGithub} className="text-lg sm:text-xl" />
        </a>

        {/* Copyright with Font Awesome */}
        <div className="text-[10px] sm:text-xs font-sans text-neutral-300 flex items-center gap-1.5 font-medium">
          <FontAwesomeIcon icon={faCopyright} className="text-[10px] sm:text-[11px]" />
          <span>CodeO 2026 All Rights Reserved.</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

