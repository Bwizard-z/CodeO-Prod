import React from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export const Features = () => {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-between selection:bg-[#fbff47] selection:text-black">
      {/* Top Navbar */}
      <Navbar />

      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-8 md:py-12 select-none">
        {/* FEATURES SECTION */}
        <section className="max-w-6xl mx-auto w-full">
          {/* Section Header */}
          <div className="text-center mb-8 sm:mb-12">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif italic text-white tracking-tight">
              Features
            </h1>
            <p className="mt-3 text-neutral-300 font-sans text-xs sm:text-sm md:text-base max-w-xl mx-auto leading-relaxed">
              Explore the capabilities powering instant real-time pair programming,
              intelligent AI assistance, and sandboxed code execution.
            </p>
          </div>

          {/* 3-Column Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6 text-left">
            {/* Column 1 */}
            <div className="space-y-6 bg-[#080c14] border border-white/10 p-5 sm:p-6 rounded-2xl shadow-xl flex flex-col justify-between">
              <div>
                <h2 className="text-xl sm:text-2xl font-serif italic text-white leading-snug mb-5">
                  Real-Time Collaboration <br />&amp; Awareness
                </h2>

                <div className="space-y-5">
                  <div className="space-y-2">
                    <h3 className="text-sm font-sans font-bold text-white tracking-wide">
                      Live Multi-User Editing
                    </h3>
                    <p className="text-neutral-400 font-sans text-xs leading-relaxed">
                      Edit code simultaneously with sub-500ms latency powered by Yjs
                      (CRDT) and Socket.io. Never run into a merge conflict again.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-sm font-sans font-bold text-white tracking-wide">
                      Cursors &amp; Presence
                    </h3>
                    <p className="text-neutral-400 font-sans text-xs leading-relaxed">
                      See exactly where your teammates are typing, moving their
                      cursors, and interacting with the code in real time.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Column 2 */}
            <div className="space-y-6 bg-[#080c14] border border-white/10 p-5 sm:p-6 rounded-2xl shadow-xl flex flex-col justify-between">
              <div>
                <h2 className="text-xl sm:text-2xl font-serif italic text-white leading-snug mb-5">
                  Smart Learning <br />&amp; Execution
                </h2>

                <div className="space-y-5">
                  <div className="space-y-2">
                    <h3 className="text-sm font-sans font-bold text-white tracking-wide">
                      AI Code Explanations
                    </h3>
                    <p className="text-neutral-400 font-sans text-xs leading-relaxed">
                      Highlight any confusing function or snippet to get instant,
                      plain-English explanations. Perfect for peer learning and
                      breaking down tough logic.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-sm font-sans font-bold text-white tracking-wide">
                      Multi-Language Code Execution
                    </h3>
                    <p className="text-neutral-400 font-sans text-xs leading-relaxed">
                      Run code safely inside a sandboxed Judge0 environment. Test and
                      execute JavaScript, Python, Java, and C++ instantly and see output
                      side-by-side.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Column 3 */}
            <div className="space-y-6 bg-[#080c14] border border-white/10 p-5 sm:p-6 rounded-2xl shadow-xl flex flex-col justify-between">
              <div>
                <h2 className="text-xl sm:text-2xl font-serif italic text-white leading-snug mb-5">
                  Complete Host <br />&amp; Room Control
                </h2>

                <div className="space-y-5">
                  <div className="space-y-2">
                    <h3 className="text-sm font-sans font-bold text-white tracking-wide">
                      Secure Room System
                    </h3>
                    <p className="text-neutral-400 font-sans text-xs leading-relaxed">
                      Spin up a room in one click, share a unique code (e.g., ABC123),
                      and save active rooms securely via Supabase.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-sm font-sans font-bold text-white tracking-wide">
                      Granular Host Permissions
                    </h3>
                    <p className="text-neutral-400 font-sans text-xs leading-relaxed">
                      As the room creator, maintain full control. Lock the room to make
                      everyone read-only, mute disruptive audio, disable individual
                      editors, or kick users instantly.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Bottom Footer Pill */}
      <Footer />
    </div>
  );
};

export default Features;
