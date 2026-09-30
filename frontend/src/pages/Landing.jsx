import React from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight } from '@fortawesome/free-solid-svg-icons';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import codeoLogo from '../assets/Logo.png';

export const Landing = () => {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-between selection:bg-[#fbff47] selection:text-black">
      {/* Top Navigation */}
      <Navbar />

      <main className="flex-1 flex flex-col justify-center items-center px-4 sm:px-6">
        {/* HERO SECTION (Proportionate for 14" laptop & all screen sizes) */}
        <section className="max-w-5xl mx-auto py-6 sm:py-10 md:py-14 text-center flex flex-col items-center">
          {/* Brand Big Logo */}
          <div className="mb-5 sm:mb-8 select-none">
            <img
              src={codeoLogo}
              alt="CodeO"
              className="h-12 sm:h-16 md:h-20 w-auto mx-auto object-contain brightness-110 drop-shadow-[0_0_25px_rgba(255,255,255,0.15)]"
            />
          </div>

          {/* Headline in Playfair Display Italic with Collaborative Cursor & John Doe tag */}
          <h1 className="font-serif italic font-bold text-white tracking-tight leading-[1.18] text-center w-full max-w-5xl xl:max-w-6xl mx-auto">
            {/* Line 1 */}
            <span className="block whitespace-normal sm:whitespace-nowrap text-3xl sm:text-4xl md:text-5xl lg:text-[3.25rem] xl:text-[3.85rem]">
              Code together, instantly.
            </span>

            {/* Line 2 */}
            <span className="block whitespace-normal sm:whitespace-nowrap mt-2 sm:mt-3 text-3xl sm:text-4xl md:text-5xl lg:text-[3.25rem] xl:text-[3.85rem]">
              <span>Connect, collaborate, and </span>
              <span className="relative inline-block align-baseline ml-1 sm:ml-2">
                {/* Yellow Highlight Box for learn. */}
                <span className="bg-[#fbfd75] text-black font-serif italic font-bold px-2 sm:px-2.5 py-0.5 rounded-[2px] inline-flex items-center select-none shadow-sm">
                  learn.
                </span>

                {/* Vertical collaborative cursor line connected to John Doe */}
                <span className="absolute right-0 bottom-0 top-[-8px] sm:top-[-12px] w-[2px] bg-[#fbff00] pointer-events-none" />

                {/* Floating Collaborator Tag: John Doe */}
                <span className="absolute bottom-[calc(100%+8px)] sm:bottom-[calc(100%+12px)] left-1/2 -translate-x-1/2 sm:left-full sm:translate-x-0 bg-[#fbff00] text-black font-sans font-bold text-[9px] sm:text-xs px-2 py-0.5 rounded-[3px] shadow-md pointer-events-none select-none tracking-normal whitespace-nowrap">
                  John Doe
                </span>
              </span>
            </span>
          </h1>

          {/* Subtitle in Inter font */}
          <p className="mt-5 sm:mt-7 text-neutral-300 text-xs sm:text-sm md:text-base max-w-xl font-sans font-normal leading-relaxed mx-auto px-2">
            A single-file sandbox for real-time collaboration. Highlight any snippet
            to get instant AI explanations or chat live with your peers.
          </p>

          {/* CTA Buttons */}
          <div className="mt-7 sm:mt-9 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            {/* Sign In CTA */}
            <Link
              to="/signin"
              className="bg-black text-white border border-white/60 hover:border-white pl-5 sm:pl-6 pr-2 py-1.5 sm:py-2 rounded-full font-sans font-medium text-xs sm:text-sm flex items-center gap-2.5 hover:bg-white/10 transition-all active:scale-95 shadow-lg"
            >
              <span>Sign In</span>
              <span className="w-6 h-6 rounded-full bg-white text-black flex items-center justify-center">
                <FontAwesomeIcon icon={faArrowRight} className="text-[10px]" />
              </span>
            </Link>

            {/* Start Coding CTA */}
            <Link
              to="/join"
              className="bg-white text-black pl-5 sm:pl-6 pr-2 py-1.5 sm:py-2 rounded-full font-sans font-semibold text-xs sm:text-sm flex items-center gap-2.5 hover:bg-neutral-200 transition-all active:scale-95 shadow-lg"
            >
              <span>Start Coding</span>
              <span className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center">
                <FontAwesomeIcon icon={faArrowRight} className="text-[10px]" />
              </span>
            </Link>
          </div>
        </section>
      </main>

      {/* Bottom Footer Pill */}
      <Footer />
    </div>
  );
};

export default Landing;
