import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowRight,
  faDoorOpen,
  faUser,
  faKey,
  faLaptopCode,
  faShieldHalved,
  faWandMagicSparkles,
  faPlay,
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../hooks/useAuth';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import codeoLogo from '../assets/Logo.png';
import { api } from '../services/api';

// Quick demo rooms for testing and instant access
const DEMO_ROOMS = [
  { code: 'ABCSDKE', label: 'JavaScript Room', lang: 'JS' },
  { code: 'PYTH992', label: 'Python Sandbox', lang: 'PY' },
  { code: 'JAVX410', label: 'Java Practice', lang: 'Java' },
];

export const JoinRoom = () => {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [roomCode, setRoomCode] = useState('');
  const [name, setName] = useState(() => {
    return (
      user?.user_metadata?.user_name ||
      user?.user_metadata?.name ||
      user?.name ||
      user?.email?.split('@')[0] ||
      localStorage.getItem('codeo_guest_name') ||
      ''
    );
  });

  // Keep name synced when auth resolves
  React.useEffect(() => {
    if (user) {
      const userDisplay =
        user?.user_metadata?.user_name ||
        user?.user_metadata?.name ||
        user?.name ||
        user?.email?.split('@')[0] ||
        '';
      if (userDisplay) {
        setName(userDisplay);
      }
    }
  }, [user]);

  const [errorMsg, setErrorMsg] = useState('');

  const handleJoin = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanCode = roomCode.trim().toUpperCase();
    if (!cleanCode) {
      setErrorMsg('Please enter a room code.');
      return;
    }

    if (cleanCode.length < 3) {
      setErrorMsg('Room code must be at least 3 characters.');
      return;
    }

    const cleanName = (user ? (user?.user_metadata?.user_name || user?.name || user?.email?.split('@')[0] || name) : name).trim();
    if (!cleanName && !isAuthenticated) {
      setErrorMsg('Please enter your display name to join.');
      return;
    }

    if (cleanName && !user) {
      localStorage.setItem('codeo_guest_name', cleanName);
    }

    if (isAuthenticated) {
      try {
        await api.joinRoom(cleanCode);
      } catch (err) {
        if (err.response?.status === 404) {
          setErrorMsg('Room not found. Please verify the code.');
          return;
        }
      }
    }

    navigate(`/editor/${cleanCode}`);
  };

  const handleSelectPreset = (presetCode) => {
    setRoomCode(presetCode);
    setErrorMsg('');
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-between selection:bg-[#fbff47] selection:text-black">
      {/* Top Navbar */}
      <Navbar />

      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-6 sm:py-10 select-none">
        <div className="w-full max-w-4xl mx-auto flex flex-col items-center">
          {/* Brand Logo & Heading */}
          <div className="text-center mb-6 sm:mb-8">
            <div className="mb-3">
              <img
                src={codeoLogo}
                alt="CodeO"
                className="h-10 sm:h-12 w-auto mx-auto object-contain brightness-110 drop-shadow-md"
              />
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif italic text-white tracking-tight">
              Start Coding
            </h1>
            <p className="mt-2 text-neutral-300 font-sans text-xs sm:text-sm max-w-lg mx-auto leading-relaxed">
              Join an existing collaborative room with a code, or sign in to host and create your own customized room.
            </p>
          </div>

          {/* 2-Column Split: [ Join Existing Room | Create Room Option ] */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 w-full items-stretch">
            {/* CARD 1: Join Existing Room */}
            <div className="bg-[#080c14] border border-white/15 rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-white/10">
                  <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white text-sm">
                    <FontAwesomeIcon icon={faDoorOpen} />
                  </span>
                  <div>
                    <h2 className="font-serif italic text-xl sm:text-2xl text-white">Join a Room</h2>
                    <p className="font-sans text-[11px] text-neutral-400">Jump right into a live session</p>
                  </div>
                </div>

                {errorMsg && (
                  <div className="mb-4 p-2.5 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs font-sans text-center">
                    {errorMsg}
                  </div>
                )}

                <form onSubmit={handleJoin} className="space-y-3.5 text-left">
                  {/* Room Code Input */}
                  <div>
                    <label className="block text-[10px] font-sans font-bold uppercase tracking-wider text-neutral-400 mb-1">
                      Room Code
                    </label>
                    <div className="flex items-center gap-2.5 w-full">
                      <div className="text-white shrink-0 w-5 flex justify-center">
                        <FontAwesomeIcon icon={faKey} className="text-base text-neutral-400" />
                      </div>
                      <input
                        type="text"
                        value={roomCode}
                        onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                        placeholder="e.g. ABCSDKE"
                        required
                        className="w-full bg-white text-black px-3.5 py-2 sm:py-2.5 rounded-md font-mono font-bold tracking-wider uppercase placeholder:font-serif placeholder:italic placeholder:font-normal placeholder:tracking-normal placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-400 text-sm shadow-sm"
                      />
                    </div>
                  </div>

                  {/* Display Name Input */}
                  <div>
                    <label className="block text-[10px] font-sans font-bold uppercase tracking-wider text-neutral-400 mb-1">
                      Your Display Name
                    </label>
                    <div className="flex items-center gap-2.5 w-full">
                      <div className="text-white shrink-0 w-5 flex justify-center">
                        <FontAwesomeIcon icon={faUser} className="text-base text-neutral-400" />
                      </div>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter your name or handle"
                        required={!isAuthenticated}
                        className="w-full bg-white text-black px-3.5 py-2 sm:py-2.5 rounded-md font-serif italic placeholder:font-serif placeholder:italic placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-400 text-sm shadow-sm"
                      />
                    </div>
                  </div>

                  {/* Quick Preset Rooms */}
                  <div className="pt-1">
                    <div className="text-[10px] font-sans font-semibold text-neutral-400 mb-1.5">
                      Try quick active rooms:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {DEMO_ROOMS.map((demo) => (
                        <button
                          key={demo.code}
                          type="button"
                          onClick={() => handleSelectPreset(demo.code)}
                          className={`text-xs px-2.5 py-0.5 rounded-full font-mono transition-all cursor-pointer ${
                            roomCode === demo.code
                              ? 'bg-[#fbff47] text-black font-bold ring-1 ring-white/50'
                              : 'bg-white/10 text-neutral-300 hover:bg-white/20 hover:text-white border border-white/10'
                          }`}
                        >
                          {demo.code} <span className="text-[9px] opacity-70">({demo.lang})</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Join Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      className="w-full bg-white text-black py-2 sm:py-2.5 px-5 rounded-full font-sans font-semibold text-xs sm:text-sm flex items-center justify-center gap-2.5 hover:bg-neutral-200 transition-all active:scale-95 shadow-lg cursor-pointer"
                    >
                      <span>Join Room</span>
                      <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-black text-white flex items-center justify-center">
                        <FontAwesomeIcon icon={faArrowRight} className="text-[10px]" />
                      </span>
                    </button>
                  </div>
                </form>
              </div>

              <p className="text-[10px] font-sans text-neutral-500 text-center mt-4">
                Guests can edit and collaborate in real-time without an account.
              </p>
            </div>

            {/* CARD 2: Create Room & Host Privileges Option */}
            <div className="bg-[#080c14] border border-white/15 rounded-2xl p-7 sm:p-8 shadow-2xl flex flex-col justify-between relative overflow-hidden">
              {/* Subtle Ambient Glow */}
              <div className="absolute top-0 right-0 w-48 h-48 bg-[#fbff47]/5 rounded-full blur-3xl pointer-events-none" />

              <div>
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
                  <span className="w-10 h-10 rounded-full bg-[#fbff47]/20 text-[#fbff47] flex items-center justify-center text-base">
                    <FontAwesomeIcon icon={faLaptopCode} />
                  </span>
                  <div>
                    <h2 className="font-serif italic text-2xl text-white">Create a Room</h2>
                    <p className="font-sans text-xs text-neutral-400">Host your own sandboxed room</p>
                  </div>
                </div>

                <div className="space-y-4 mb-6 text-left">
                  <p className="text-neutral-300 font-sans text-sm leading-relaxed">
                    Hosting your own room gives you full room controls and instant cloud execution:
                  </p>

                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <FontAwesomeIcon icon={faShieldHalved} className="text-emerald-400 text-sm mt-0.5 shrink-0" />
                      <p className="font-sans text-xs text-neutral-300">
                        <span className="text-white font-semibold">Granular Host Controls:</span> Lock editor, toggle read-only mode, and moderate users.
                      </p>
                    </div>

                    <div className="flex items-start gap-3">
                      <FontAwesomeIcon icon={faPlay} className="text-sky-400 text-sm mt-0.5 shrink-0" />
                      <p className="font-sans text-xs text-neutral-300">
                        <span className="text-white font-semibold">Multi-Language Runner:</span> Execute JavaScript, Python, Java, and C++ side-by-side.
                      </p>
                    </div>

                    <div className="flex items-start gap-3">
                      <FontAwesomeIcon icon={faWandMagicSparkles} className="text-[#fbff47] text-sm mt-0.5 shrink-0" />
                      <p className="font-sans text-xs text-neutral-300">
                        <span className="text-white font-semibold">AI Explanations:</span> Highlight tricky logic to get instant clear breakdowns.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons based on Auth Status */}
              <div className="space-y-3 pt-4 border-t border-white/10">
                {isAuthenticated ? (
                  <div className="space-y-3 text-center">
                    <p className="text-xs font-sans text-emerald-400 font-medium">
                      ✓ You are signed in as {user?.user_metadata?.user_name || user?.email}
                    </p>
                    <Link
                      to="/create-room"
                      className="w-full bg-[#fbff47] text-black py-3 px-6 rounded-full font-sans font-semibold text-base flex items-center justify-center gap-3 hover:bg-[#edf135] transition-all active:scale-95 shadow-lg"
                    >
                      <span>Create New Room</span>
                      <span className="w-7 h-7 rounded-full bg-black text-[#fbff47] flex items-center justify-center">
                        <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
                      </span>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Link
                      to="/signin?redirect=/create-room"
                      className="w-full bg-white text-black py-3 px-6 rounded-full font-sans font-semibold text-base flex items-center justify-center gap-3 hover:bg-neutral-200 transition-all active:scale-95 shadow-lg text-center"
                    >
                      <span>Sign In to Create Room</span>
                      <span className="w-7 h-7 rounded-full bg-black text-white flex items-center justify-center">
                        <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
                      </span>
                    </Link>

                    <div className="text-center pt-1">
                      <Link
                        to="/signup?redirect=/create-room"
                        className="text-xs font-sans text-neutral-400 hover:text-white transition-colors underline underline-offset-4"
                      >
                        Don't have an account? Sign up free
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Footer */}
      <Footer />
    </div>
  );
};

export default JoinRoom;
