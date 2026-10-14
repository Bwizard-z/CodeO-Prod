import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLinkedin } from '@fortawesome/free-brands-svg-icons';
import codeoLogo from '../assets/Logo.png';

export const Footer = () => {
  return (
    <footer className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-5">
      <div className="bg-[#0c1322] border border-white/5 rounded-full px-5 sm:px-8 py-2 sm:py-2.5 grid grid-cols-3 items-center shadow-2xl backdrop-blur-sm">
        {/* Brand Logo */}
        <div className="flex items-center justify-start select-none">
          <img
            src={codeoLogo}
            alt="CodeO"
            className="h-4 sm:h-5 w-auto object-contain brightness-105"
          />
        </div>

        {/* LinkedIn Link (Centered) */}
        <div className="flex items-center justify-center">
          <a
            href="https://www.linkedin.com/in/bharanindra-acharya-229887395?utm_source=share_via&utm_content=profile&utm_medium=member_android"
            target="_blank"
            rel="noreferrer"
            aria-label="Bharanindra Acharya LinkedIn Profile"
            className="text-white hover:text-[#0A66C2] transition-colors duration-200 flex items-center justify-center"
          >
            <FontAwesomeIcon icon={faLinkedin} className="text-lg sm:text-xl" />
          </a>
        </div>

        {/* Project Info */}
        <div className="flex items-center justify-end text-[10px] sm:text-xs font-sans text-neutral-300 font-medium tracking-normal text-right">
          <span>A College Project By Bharanindra Acharya</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

