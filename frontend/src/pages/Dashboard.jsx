// pages/Dashboard.jsx - Collaborative Room Management Dashboard
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus,
  faDoorOpen,
  faMagnifyingGlass,
  faArrowRotateRight,
  faTriangleExclamation,
  faCheck,
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../hooks/useAuth';
import { useRoom } from '../hooks/useRoom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import RoomCard from '../components/RoomCard';
import RoomCounter from '../components/RoomCounter';
import EmptyState from '../components/EmptyState';
import CreateRoomModal from '../components/CreateRoomModal';
import JoinRoomModal from '../components/JoinRoomModal';

export const Dashboard = () => {
  const { user, isEmailVerified, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const {
    rooms,
    count,
    limit,
    remaining,
    loading: roomsLoading,
    error: roomsError,
    getUserRooms,
    deleteRoom,
  } = useRoom(true);

  // Search & Sorting state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('recent'); // 'recent' | 'title' | 'created'

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);

  // Toast feedback state
  const [toastMsg, setToastMsg] = useState('');

  // Fetch rooms on mount or user change
  useEffect(() => {
    if (user) {
      getUserRooms();
    }
  }, [user, getUserRooms]);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  // Handle Delete action from RoomCard
  const handleDelete = async (idOrCode) => {
    const result = await deleteRoom(idOrCode);
    if (result.success) {
      showToast('Room deleted successfully.');
      await getUserRooms();
    } else {
      showToast(result.error || 'Failed to delete room.');
    }
  };

  // Filter and sort active rooms
  const processedRooms = useMemo(() => {
    let list = [...(rooms || [])];

    // Search filter (by title, code, description, language)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.title?.toLowerCase().includes(q) ||
          r.code?.toLowerCase().includes(q) ||
          r.description?.toLowerCase().includes(q) ||
          r.language?.toLowerCase().includes(q)
      );
    }

    // Sorting
    list.sort((a, b) => {
      if (sortBy === 'title') {
        return (a.title || '').localeCompare(b.title || '');
      }
      if (sortBy === 'created') {
        return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      }
      // Default: 'recent'
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });

    return list;
  }, [rooms, searchQuery, sortBy]);

  // Loading Screen during initial authentication check
  if (authLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-3 select-none">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
        <p className="font-serif italic text-sm text-neutral-400">Loading your CodeO workspace...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-between selection:bg-[#fbff47] selection:text-black">
      <Navbar />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 select-none">
        {/* Toast Notification */}
        {toastMsg && (
          <div className="fixed bottom-6 right-6 z-50 bg-[#161c28] border border-white/20 text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-sans animate-fade-in">
            <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px]">
              <FontAwesomeIcon icon={faCheck} />
            </span>
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Top Header & Overview Bar */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-white/10 mb-5">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-serif italic text-white tracking-tight mb-1.5">
              My Rooms
            </h1>
            <p className="text-neutral-400 text-xs sm:text-sm font-sans">
              Manage your real-time collaborative coding sessions and join ongoing rooms.
            </p>
          </div>

          {/* Action Buttons: [Join Room] [Create New Room] */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsJoinModalOpen(true)}
              className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 text-white font-sans font-semibold text-xs sm:text-sm flex items-center gap-2 transition-all active:scale-95 shadow-sm cursor-pointer"
            >
              <FontAwesomeIcon icon={faDoorOpen} className="text-xs text-[#fbff47]" />
              <span>Join Room</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (!isEmailVerified) {
                  navigate('/verify-email', { state: { email: user?.email } });
                  return;
                }
                setIsCreateModalOpen(true);
              }}
              disabled={count >= limit}
              className={`px-4 py-2 rounded-full font-sans font-semibold text-xs sm:text-sm flex items-center gap-2 transition-all active:scale-95 shadow-md cursor-pointer ${
                count >= limit
                  ? 'bg-neutral-700 text-neutral-400 cursor-not-allowed'
                  : 'bg-white text-black hover:bg-neutral-200'
              }`}
            >
              <FontAwesomeIcon icon={faPlus} className="text-xs" />
              <span>Create New Room</span>
            </button>
          </div>
        </div>

        {/* Controls Bar: Search, Sort, Room Counter */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
          {/* Room Counter (5/10 rooms used) */}
          <RoomCounter count={count} limit={limit} remaining={remaining} />

          {/* Search & Sort Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-60">
              <FontAwesomeIcon
                icon={faMagnifyingGlass}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 text-xs"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search rooms..."
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#fbff47] transition-all font-sans"
              />
            </div>

            {/* Sort Selector */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-[#111622] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-neutral-300 focus:outline-none focus:border-[#fbff47] transition-all font-sans cursor-pointer"
            >
              <option value="recent">Sort: Recently Created</option>
              <option value="title">Sort: Title (A-Z)</option>
              <option value="created">Sort: Oldest First</option>
            </select>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => getUserRooms()}
              disabled={roomsLoading}
              title="Refresh room list"
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-400 hover:text-white transition-all text-xs"
            >
              <FontAwesomeIcon icon={faArrowRotateRight} className={roomsLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Error Notice */}
        {roomsError && (
          <div className="mb-6 p-4 rounded-xl bg-red-950/70 border border-red-500/50 text-red-200 text-xs font-sans flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FontAwesomeIcon icon={faTriangleExclamation} className="text-red-400" />
              <span>{roomsError}</span>
            </div>
            <button
              type="button"
              onClick={() => getUserRooms()}
              className="underline hover:text-white transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Active Rooms Grid: 3 cols desktop, 2 cols tablet, 1 col mobile */}
        {roomsLoading && processedRooms.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-neutral-400">
            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <p className="font-serif italic text-sm">Fetching your rooms...</p>
          </div>
        ) : processedRooms.length === 0 ? (
          <EmptyState
            title={searchQuery ? 'No rooms match your search' : 'No rooms yet. Create one to get started!'}
            description={
              searchQuery
                ? 'Try adjusting your search terms or clear the filter.'
                : 'Create a collaborative room to write, run, and debug code live with peers.'
            }
            actionText={searchQuery ? 'Clear Search' : 'Create New Room'}
            onAction={() => {
              if (searchQuery) {
                setSearchQuery('');
              } else {
                setIsCreateModalOpen(true);
              }
            }}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {processedRooms.map((room) => (
              <RoomCard
                key={room.id || room.code}
                room={room}
                onDelete={handleDelete}
                onCopySuccess={(code) => showToast(`Room code ${code} copied to clipboard!`)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Create Room Modal */}
      <CreateRoomModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          showToast('Room created successfully!');
          getUserRooms();
        }}
        roomCount={count}
        roomLimit={limit}
      />

      {/* Join Room Modal */}
      <JoinRoomModal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
        onSuccess={() => {
          showToast('Joined room successfully!');
          getUserRooms();
        }}
      />

      <Footer />
    </div>
  );
};

export default Dashboard;
