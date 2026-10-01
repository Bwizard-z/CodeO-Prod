// pages/HonestlyCodeo.jsx - Unlisted Admin/Owner Feedback Review Dashboard
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faStar,
  faCommentDots,
  faRotateRight,
  faFilter,
  faChevronLeft,
  faChevronRight,
  faMagnifyingGlass,
  faEnvelope,
  faUser,
  faClock,
  faCheckCircle,
  faMobileScreen,
  faDesktop,
} from '@fortawesome/free-solid-svg-icons';
import { api } from '../services/api';
import codeoLogo from '../assets/Logo.png';

const CATEGORIES = [
  'All',
  'General Experience',
  'Feature Request',
  'UI & Dark Theme',
  'Code Editor & Sandbox',
  'Bug Report',
];

const RATINGS = ['All', 5, 4, 3, 2, 1];

const CATEGORY_COLORS = {
  'General Experience': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  'Feature Request': 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  'UI & Dark Theme': 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  'Code Editor & Sandbox': 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  'Bug Report': 'bg-rose-500/15 text-rose-400 border-rose-500/30',
};

// Deterministic pastel color generator for initials
function getInitialsColor(str = '') {
  const colors = [
    '#3b82f6',
    '#10b981',
    '#8b5cf6',
    '#f59e0b',
    '#ec4899',
    '#06b6d4',
    '#14b8a6',
    '#6366f1',
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export const HonestlyCodeo = () => {
  const [reviews, setReviews] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedRating, setSelectedRating] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch feedbacks for current page & filters
  const fetchFeedbacks = useCallback(async (pageToLoad = 1) => {
    setLoading(true);
    try {
      const result = await api.getFeedbacks({
        page: pageToLoad,
        limit: 20,
        category: selectedCategory,
        rating: selectedRating,
      });

      if (result?.success) {
        let items = result.data || [];
        let count = result.count || 0;

        // If backend returned empty or table not migrated yet, check local storage
        if (items.length === 0 && pageToLoad === 1) {
          try {
            const local = JSON.parse(localStorage.getItem('codeo_feedbacks') || '[]');
            if (local.length > 0) {
              items = local;
              count = local.length;
            }
          } catch {}
        }

        setReviews(items);
        setTotalCount(count);
        setTotalPages(Math.max(1, Math.ceil(count / 20)));
        setCurrentPage(pageToLoad);
      }
    } catch (err) {
      console.warn('API error fetching feedbacks, falling back to local copy:', err);
      try {
        const local = JSON.parse(localStorage.getItem('codeo_feedbacks') || '[]');
        setReviews(local.slice((pageToLoad - 1) * 20, pageToLoad * 20));
        setTotalCount(local.length);
        setTotalPages(Math.max(1, Math.ceil(local.length / 20)));
        setCurrentPage(pageToLoad);
      } catch {
        setReviews([]);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, selectedRating]);

  // Fetch aggregate stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await api.getFeedbackStats();
      if (res?.success && res.stats) {
        setStats(res.stats);
      }
    } catch {
      // Fallback local calculation
      try {
        const local = JSON.parse(localStorage.getItem('codeo_feedbacks') || '[]');
        if (local.length) {
          const sum = local.reduce((acc, r) => acc + (r.rating || 0), 0);
          setStats({
            total_feedbacks: local.length,
            average_rating: parseFloat((sum / local.length).toFixed(2)),
            five_star_count: local.filter((r) => r.rating === 5).length,
            four_star_count: local.filter((r) => r.rating === 4).length,
            three_star_count: local.filter((r) => r.rating === 3).length,
            two_star_count: local.filter((r) => r.rating === 2).length,
            one_star_count: local.filter((r) => r.rating === 1).length,
          });
        }
      } catch {}
    }
  }, []);

  useEffect(() => {
    fetchFeedbacks(1);
    fetchStats();
  }, [fetchFeedbacks, fetchStats]);

  // Client-side text search filtering
  const filteredReviews = useMemo(() => {
    if (!searchQuery.trim()) return reviews;
    const q = searchQuery.toLowerCase().trim();
    return reviews.filter(
      (r) =>
        r.name?.toLowerCase().includes(q) ||
        r.email?.toLowerCase().includes(q) ||
        r.feedback?.toLowerCase().includes(q) ||
        r.category?.toLowerCase().includes(q)
    );
  }, [reviews, searchQuery]);

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    fetchFeedbacks(newPage);
  };

  return (
    <div className="min-h-screen bg-[#060911] text-white flex flex-col font-sans selection:bg-[#fbff47] selection:text-black">
      {/* Top Header Bar */}
      <header className="w-full bg-[#080c14]/90 border-b border-white/10 backdrop-blur-xl sticky top-0 z-40 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="hover:opacity-85 transition-opacity flex items-center">
            <img src={codeoLogo} alt="CodeO" className="h-7 w-auto object-contain brightness-110" />
          </Link>
          <div className="h-4 w-[1px] bg-white/20" />
          <div className="flex items-center gap-2">
            <span className="font-serif italic text-lg sm:text-xl font-bold tracking-tight text-white">
              Honestly<span className="text-[#fbff47]">CodeO</span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-sans font-semibold uppercase tracking-wider">
              Admin Vault
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            fetchFeedbacks(currentPage);
            fetchStats();
          }}
          disabled={loading}
          title="Refresh Feedbacks"
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-neutral-300 hover:text-white transition-all cursor-pointer active:scale-95 disabled:opacity-50"
        >
          <FontAwesomeIcon icon={faRotateRight} className={`text-xs ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Top Summary Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {/* Total Reviews Card */}
          <div className="bg-[#0b101c] border border-white/10 rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden">
            <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              Total Reviews
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
              {stats?.total_feedbacks ?? totalCount}
            </div>
            <div className="text-[11px] text-neutral-400 mt-1 flex items-center gap-1">
              <FontAwesomeIcon icon={faCommentDots} className="text-[#fbff47]" />
              <span>Platform users</span>
            </div>
          </div>

          {/* Average Rating Card */}
          <div className="bg-[#0b101c] border border-white/10 rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden">
            <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              Average Rating
            </div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl sm:text-3xl font-extrabold text-[#fbff47]">
                {stats?.average_rating ? stats.average_rating.toFixed(1) : '5.0'}
              </span>
              <span className="text-xs text-neutral-400 font-semibold">/ 5.0</span>
            </div>
            <div className="flex items-center gap-1 mt-1 text-amber-400 text-xs">
              {[1, 2, 3, 4, 5].map((star) => (
                <FontAwesomeIcon
                  key={star}
                  icon={faStar}
                  className={star <= Math.round(stats?.average_rating || 5) ? 'text-amber-400' : 'text-neutral-700'}
                />
              ))}
            </div>
          </div>

          {/* 5-Star Reviews Card */}
          <div className="bg-[#0b101c] border border-white/10 rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden">
            <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              5-Star Loved
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400 mt-1">
              {stats?.five_star_count ?? (reviews.filter((r) => r.rating === 5).length)}
            </div>
            <div className="text-[11px] text-neutral-400 mt-1 flex items-center gap-1">
              <FontAwesomeIcon icon={faCheckCircle} className="text-emerald-400 text-xs" />
              <span>Top ratings</span>
            </div>
          </div>

          {/* Current Page Indicator */}
          <div className="bg-[#0b101c] border border-white/10 rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden">
            <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              Active Page
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
              {currentPage} <span className="text-neutral-500 text-base font-normal">/ {totalPages}</span>
            </div>
            <div className="text-[11px] text-neutral-400 mt-1">
              20 reviews per page
            </div>
          </div>
        </div>

        {/* Filters & Search Toolbar */}
        <div className="bg-[#0b101c] border border-white/10 rounded-2xl p-4 space-y-3.5 shadow-lg">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <FontAwesomeIcon
                icon={faMagnifyingGlass}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 text-xs"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by reviewer name, email, or keywords..."
                className="w-full bg-[#070a12] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#fbff47]/60 transition-all font-sans"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Rating Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              <span className="text-[11px] font-bold text-neutral-400 mr-1 flex items-center gap-1 shrink-0">
                <FontAwesomeIcon icon={faFilter} className="text-[10px]" />
                Rating:
              </span>
              {RATINGS.map((rate) => {
                const isActive = selectedRating === rate;
                return (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => {
                      setSelectedRating(rate);
                      setCurrentPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-[#fbff47] text-black shadow-sm font-bold'
                        : 'bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-white'
                    }`}
                  >
                    {rate === 'All' ? 'All' : `${rate} ★`}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 border-t border-white/5">
            <span className="text-[11px] font-bold text-neutral-400 mr-1 shrink-0">Category:</span>
            {CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat);
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-white text-black font-semibold shadow-sm'
                      : 'bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-400 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Reviews Cards Section */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="bg-[#0b101c] border border-white/10 rounded-2xl p-5 animate-pulse space-y-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/10" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-3 w-32 bg-white/10 rounded" />
                    <div className="h-2.5 w-48 bg-white/5 rounded" />
                  </div>
                </div>
                <div className="h-16 bg-white/5 rounded-xl" />
              </div>
            ))}
          </div>
        ) : filteredReviews.length === 0 ? (
          <div className="bg-[#0b101c] border border-white/10 rounded-2xl p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-neutral-400">
              <FontAwesomeIcon icon={faCommentDots} className="text-xl" />
            </div>
            <h3 className="font-serif italic text-lg font-bold text-white">No reviews found</h3>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto">
              No feedback matches the selected filters or search query. Try clearing your filters.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('All');
                setSelectedRating('All');
                setSearchQuery('');
              }}
              className="mt-2 px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-all cursor-pointer"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredReviews.map((rev, index) => {
              const reviewerName = rev.name || 'Anonymous User';
              const reviewerInitial = (reviewerName.charAt(0) || 'U').toUpperCase();
              const initialBg = getInitialsColor(reviewerName);
              const categoryBadgeClass =
                CATEGORY_COLORS[rev.category] || 'bg-white/10 text-neutral-300 border-white/20';

              const createdDate = rev.created_at || rev.date;
              const formattedDate = createdDate
                ? new Date(createdDate).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Recent';

              const metaDevice =
                rev.metadata?.screenWidth && rev.metadata?.screenWidth < 768 ? 'Mobile' : 'Desktop';

              return (
                <div
                  key={rev.id || index}
                  className="bg-[#0b101c] border border-white/10 hover:border-white/25 rounded-2xl p-4 sm:p-5 transition-all shadow-lg flex flex-col justify-between group hover:-translate-y-0.5"
                >
                  <div className="space-y-3">
                    {/* Header: User Avatar + Name + Rating Stars */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md shrink-0 ring-1 ring-white/20"
                          style={{ backgroundColor: initialBg }}
                        >
                          {reviewerInitial}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-semibold text-sm text-white truncate group-hover:text-[#fbff47] transition-colors">
                            {reviewerName}
                          </h4>
                          <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 truncate">
                            <FontAwesomeIcon icon={faEnvelope} className="text-[9px] shrink-0" />
                            <span className="truncate">{rev.email || 'No email provided'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Star Rating Badge */}
                      <div className="flex flex-col items-end shrink-0">
                        <div className="flex items-center gap-0.5 text-amber-400 text-xs">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <FontAwesomeIcon
                              key={star}
                              icon={faStar}
                              className={star <= rev.rating ? 'text-amber-400' : 'text-neutral-700'}
                            />
                          ))}
                        </div>
                        <span className="text-[10px] text-neutral-400 font-semibold mt-0.5">
                          {rev.rating} / 5
                        </span>
                      </div>
                    </div>

                    {/* Category & Status Pill */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2.5 py-0.5 rounded-full border text-[10.5px] font-sans font-semibold ${categoryBadgeClass}`}
                      >
                        {rev.category || 'General Experience'}
                      </span>
                      {rev.status && (
                        <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-neutral-400 text-[10px] font-sans font-medium uppercase tracking-wider">
                          {rev.status}
                        </span>
                      )}
                    </div>

                    {/* Feedback Message Content */}
                    <div className="bg-[#070a12] border border-white/5 rounded-xl p-3.5 text-xs text-neutral-200 leading-relaxed font-sans select-text whitespace-pre-wrap">
                      "{rev.feedback}"
                    </div>
                  </div>

                  {/* Card Footer: Timestamp & Metadata */}
                  <div className="pt-3 mt-3 border-t border-white/5 flex items-center justify-between text-[10.5px] text-neutral-400">
                    <div className="flex items-center gap-1.5">
                      <FontAwesomeIcon icon={faClock} className="text-[9px]" />
                      <span>{formattedDate}</span>
                    </div>

                    {rev.metadata && (
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 text-[10px] bg-white/5 px-2 py-0.5 rounded-md border border-white/10 text-neutral-400">
                          <FontAwesomeIcon
                            icon={metaDevice === 'Mobile' ? faMobileScreen : faDesktop}
                            className="text-[9px]"
                          />
                          <span>{metaDevice}</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Controls (20 per page) */}
        {totalPages > 1 && (
          <div className="bg-[#0b101c] border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
            <div className="text-xs text-neutral-400 font-medium text-center sm:text-left">
              Showing reviews{' '}
              <span className="text-white font-bold">{(currentPage - 1) * 20 + 1}</span> to{' '}
              <span className="text-white font-bold">{Math.min(currentPage * 20, totalCount)}</span> of{' '}
              <span className="text-white font-bold">{totalCount}</span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Previous Page Button */}
              <button
                type="button"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1 || loading}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-neutral-300 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
              >
                <FontAwesomeIcon icon={faChevronLeft} className="text-[10px]" />
                <span>Prev</span>
              </button>

              {/* Numbered Page Buttons */}
              <div className="flex items-center gap-1">
                {[...Array(totalPages)].map((_, idx) => {
                  const pNum = idx + 1;
                  // Show current page and immediate neighbors
                  if (
                    pNum === 1 ||
                    pNum === totalPages ||
                    (pNum >= currentPage - 1 && pNum <= currentPage + 1)
                  ) {
                    return (
                      <button
                        key={pNum}
                        type="button"
                        onClick={() => handlePageChange(pNum)}
                        disabled={loading}
                        className={`w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          pNum === currentPage
                            ? 'bg-[#fbff47] text-black shadow-md'
                            : 'bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-white'
                        }`}
                      >
                        {pNum}
                      </button>
                    );
                  }
                  if (pNum === currentPage - 2 || pNum === currentPage + 2) {
                    return (
                      <span key={pNum} className="text-xs text-neutral-600 px-0.5">
                        ...
                      </span>
                    );
                  }
                  return null;
                })}
              </div>

              {/* Next Page Button */}
              <button
                type="button"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages || loading}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-neutral-300 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
              >
                <span>Next</span>
                <FontAwesomeIcon icon={faChevronRight} className="text-[10px]" />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default HonestlyCodeo;
