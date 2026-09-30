import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faStar,
  faEnvelope,
  faUser,
  faArrowRight,
  faCheckCircle,
  faCommentDots,
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../hooks/useAuth';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import codeoLogo from '../assets/Logo.png';

const CATEGORIES = [
  'General Experience',
  'Feature Request',
  'UI & Dark Theme',
  'Code Editor & Sandbox',
  'Bug Report',
];

const RATING_LABELS = {
  1: 'Needs Improvement',
  2: 'Fair',
  3: 'Good Experience',
  4: 'Very Good',
  5: 'Outstanding & Loved it!',
};

export const Feedback = () => {
  const { user, isAuthenticated } = useAuth();

  const [name, setName] = useState(
    user?.user_metadata?.user_name || user?.user_metadata?.name || ''
  );
  const [email, setEmail] = useState(user?.email || '');
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [category, setCategory] = useState('General Experience');
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Please enter your name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (!feedback.trim() || feedback.trim().length < 5) {
      setErrorMsg('Please write a brief feedback comment (at least 5 characters).');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    // Save to localStorage for demo persistence
    try {
      const existing = JSON.parse(localStorage.getItem('codeo_feedbacks') || '[]');
      const newReview = {
        id: 'review-' + Date.now(),
        name: name.trim(),
        email: email.trim(),
        rating,
        category,
        feedback: feedback.trim(),
        date: new Date().toISOString(),
      };
      existing.unshift(newReview);
      localStorage.setItem('codeo_feedbacks', JSON.stringify(existing));
    } catch {
      // Ignored
    }

    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 700);
  };

  const handleReset = () => {
    setFeedback('');
    setRating(5);
    setCategory('General Experience');
    setSubmitted(false);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-between selection:bg-[#fbff47] selection:text-black">
      {/* Top Navbar */}
      <Navbar />

      <main className="flex-1 flex items-center justify-center py-6 sm:py-8 px-4 select-none">
        <div className="w-full max-w-lg mx-auto bg-[#080c14] border border-white/10 rounded-2xl p-5 sm:p-7 shadow-2xl">
          {/* Brand Header */}
          <div className="text-center mb-5 sm:mb-6">
            <img
              src={codeoLogo}
              alt="CodeO"
              className="h-9 sm:h-10 w-auto mx-auto object-contain brightness-110 mb-3"
            />
            <h1 className="text-2xl sm:text-3xl font-serif italic text-white tracking-tight">
              Website Feedback
            </h1>
            <p className="mt-1.5 text-neutral-400 font-sans text-xs sm:text-sm max-w-md mx-auto leading-relaxed">
              Help us improve CodeO. Tell us what you love, what needs improvement,
              or what features you want next!
            </p>
          </div>

          {submitted ? (
            /* Success Confirmation State */
            <div className="space-y-4 text-center py-4">
              <div className="w-14 h-14 rounded-full bg-[#22c55e]/20 border border-[#22c55e]/40 flex items-center justify-center mx-auto text-[#22c55e]">
                <FontAwesomeIcon icon={faCheckCircle} className="text-2xl" />
              </div>

              <div>
                <h2 className="text-xl sm:text-2xl font-serif italic text-white tracking-tight">
                  Thank You for Your Feedback!
                </h2>
                <p className="mt-1.5 text-neutral-300 font-sans text-xs sm:text-sm max-w-md mx-auto">
                  Your thoughts and suggestions directly help us make CodeO a better real-time collaborative platform.
                </p>
              </div>

              {/* Star Rating Badge Summary */}
              <div className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 px-4 py-2 rounded-full">
                {[1, 2, 3, 4, 5].map((s) => (
                  <FontAwesomeIcon
                    key={s}
                    icon={faStar}
                    className={`text-xs ${
                      s <= rating ? 'text-[#facc15]' : 'text-neutral-600'
                    }`}
                  />
                ))}
                <span className="ml-2 font-sans font-semibold text-xs text-neutral-200">
                  {RATING_LABELS[rating]}
                </span>
              </div>

              <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleReset}
                  className="bg-white/10 hover:bg-white/20 text-white px-5 py-2 rounded-full font-sans font-semibold text-xs transition-colors cursor-pointer"
                >
                  Submit Another Review
                </button>

                <Link
                  to={isAuthenticated ? "/dashboard" : "/"}
                  className="bg-white text-black px-5 py-2 rounded-full font-sans font-semibold text-xs inline-flex items-center gap-2 hover:bg-neutral-200 transition-all shadow-md active:scale-95"
                >
                  <span>{isAuthenticated ? 'Back to Dashboard' : 'Back to Home'}</span>
                  <FontAwesomeIcon icon={faArrowRight} className="text-[10px]" />
                </Link>
              </div>
            </div>
          ) : (
            /* Modern Review Form */
            <form onSubmit={handleSubmit} className="space-y-4 text-left">
              {errorMsg && (
                <div className="p-2.5 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs font-sans text-center">
                  {errorMsg}
                </div>
              )}

              {/* Star Rating Selector */}
              <div className="p-3 bg-white/[0.03] border border-white/10 rounded-xl text-center">
                <label className="block text-[11px] font-sans uppercase tracking-wider text-neutral-400 font-semibold mb-1.5">
                  Rate Your Experience
                </label>
                <div className="flex items-center justify-center gap-2 sm:gap-2.5 py-0.5">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const isFilled = (hoverRating || rating) >= star;
                    return (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="p-1 focus:outline-none transition-transform hover:scale-125 active:scale-95 cursor-pointer"
                        title={`${star} Star${star > 1 ? 's' : ''}`}
                      >
                        <FontAwesomeIcon
                          icon={faStar}
                          className={`text-2xl sm:text-3xl transition-colors drop-shadow-sm ${
                            isFilled
                              ? 'text-[#facc15]'
                              : 'text-neutral-600 hover:text-neutral-400'
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 text-xs font-serif italic text-neutral-300">
                  {RATING_LABELS[hoverRating || rating]}
                </div>
              </div>

              {/* Category Pills */}
              <div>
                <label className="block text-xs font-sans uppercase tracking-wider text-neutral-400 font-semibold mb-2">
                  Topic / Category
                </label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-sans transition-all cursor-pointer ${
                        category === cat
                          ? 'bg-white text-black font-semibold shadow-sm'
                          : 'bg-white/5 text-neutral-300 hover:bg-white/10 border border-white/10'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name Input */}
              <div className="flex items-center gap-3.5 w-full">
                <div className="text-white shrink-0 w-7 flex justify-center">
                  <FontAwesomeIcon icon={faUser} className="text-xl" />
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter Your Name"
                  required
                  className="w-full bg-white text-black px-4 py-3 rounded-md font-serif italic placeholder:font-serif placeholder:italic placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-400 text-sm shadow-sm"
                />
              </div>

              {/* Email Input */}
              <div className="flex items-center gap-3.5 w-full">
                <div className="text-white shrink-0 w-7 flex justify-center">
                  <FontAwesomeIcon icon={faEnvelope} className="text-xl" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter Your Email"
                  required
                  className="w-full bg-white text-black px-4 py-3 rounded-md font-serif italic placeholder:font-serif placeholder:italic placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-400 text-sm shadow-sm"
                />
              </div>

              {/* Feedback Textarea */}
              <div className="flex items-start gap-3.5 w-full">
                <div className="text-white shrink-0 w-7 flex justify-center pt-3">
                  <FontAwesomeIcon icon={faCommentDots} className="text-xl" />
                </div>
                <textarea
                  rows={4}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Share your thoughts, suggestions, or issues to help us make CodeO even better..."
                  required
                  className="w-full bg-white text-black px-4 py-3 rounded-md font-serif italic placeholder:font-serif placeholder:italic placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-400 text-sm shadow-sm resize-none"
                />
              </div>

              {/* Submit Button */}
              <div className="flex justify-center pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-white text-black pl-8 pr-2.5 py-2.5 rounded-full font-sans font-semibold text-base flex items-center gap-3 hover:bg-neutral-200 transition-all active:scale-95 shadow-md disabled:opacity-50 cursor-pointer"
                >
                  <span>{loading ? 'Submitting...' : 'Submit Feedback'}</span>
                  <span className="w-7 h-7 rounded-full bg-black text-white flex items-center justify-center">
                    <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
                  </span>
                </button>
              </div>
            </form>
          )}
        </div>
      </main>

      {/* Bottom Footer Pill */}
      <Footer />
    </div>
  );
};

export default Feedback;
