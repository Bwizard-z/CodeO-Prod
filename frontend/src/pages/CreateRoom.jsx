// pages/CreateRoom.jsx - Standalone Create Room Page
import React from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import CreateRoomForm from '../components/CreateRoomForm';
import { useRoom } from '../hooks/useRoom';

export const CreateRoom = () => {
  const { count, limit } = useRoom(true);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-between selection:bg-[#fbff47] selection:text-black">
      <Navbar />

      <main className="flex-1 w-full max-w-xl mx-auto px-6 py-12 flex flex-col justify-center select-none">
        <div className="bg-[#0a0d14] border border-white/15 rounded-2xl p-7 sm:p-8 shadow-2xl">
          <div className="mb-6">
            <h1 className="text-3xl sm:text-4xl font-serif italic text-white tracking-tight mb-2">
              Create New Room
            </h1>
            <p className="text-xs sm:text-sm font-sans text-neutral-400">
              Start a real-time collaborative workspace and invite team members.
            </p>
          </div>

          <CreateRoomForm
            roomCount={count}
            roomLimit={limit}
          />
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default CreateRoom;
