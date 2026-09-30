// components/ExplainModal.jsx - Gemini AI Code Explanation Modal
import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faWandMagicSparkles,
  faXmark,
  faCopy,
  faCheck,
  faSpinner,
  faTriangleExclamation,
  faCode,
  faClock,
  faUser,
  faRotateRight,
} from '@fortawesome/free-solid-svg-icons';

/**
 * Format markdown-like text with clean headings, bold tags, and bullet points.
 */
function FormattedExplanation({ text }) {
  if (!text) return null;

  const lines = text.split('\n');
  return (
    <div className="space-y-2 text-xs sm:text-sm text-neutral-200 font-sans leading-relaxed">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        if (!trimmed) {
          return <div key={idx} className="h-2" />;
        }

        // H3 Header (### Header)
        if (trimmed.startsWith('### ')) {
          return (
            <h4
              key={idx}
              className="text-xs sm:text-sm font-semibold text-[#fbff47] uppercase tracking-wider pt-2 pb-0.5 border-b border-white/5"
            >
              {trimmed.replace(/^###\s+/, '')}
            </h4>
          );
        }

        // H2 Header (## Header)
        if (trimmed.startsWith('## ')) {
          return (
            <h3
              key={idx}
              className="text-sm sm:text-base font-serif italic text-white font-medium pt-3 pb-1 border-b border-white/10"
            >
              {trimmed.replace(/^##\s+/, '')}
            </h3>
          );
        }

        // Bullet point (* or -)
        if (trimmed.startsWith('* ') || trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
          const content = trimmed.replace(/^(\*|-|•)\s+/, '');
          return (
            <div key={idx} className="flex items-start gap-2 pl-1.5 sm:pl-2">
              <span className="text-[#34d399] text-xs font-bold leading-5">•</span>
              <div
                className="flex-1 leading-normal"
                dangerouslySetInnerHTML={{
                  __html: formatInlineMarkdown(content),
                }}
              />
            </div>
          );
        }

        // Numbered list (1. 2.)
        const matchNumber = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (matchNumber) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="text-neutral-400 font-mono text-xs font-semibold leading-5">
                {matchNumber[1]}.
              </span>
              <div
                className="flex-1 leading-normal"
                dangerouslySetInnerHTML={{
                  __html: formatInlineMarkdown(matchNumber[2]),
                }}
              />
            </div>
          );
        }

        // Regular paragraph
        return (
          <p
            key={idx}
            className="text-neutral-300"
            dangerouslySetInnerHTML={{
              __html: formatInlineMarkdown(line),
            }}
          />
        );
      })}
    </div>
  );
}

function formatInlineMarkdown(str) {
  if (!str) return '';
  let res = str;
  // Escape angle brackets for safety
  res = res.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Bold (**text** or __text__)
  res = res.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>');
  // Inline code (`code`)
  res = res.replace(
    /`([^`]+)`/g,
    '<code class="px-1.5 py-0.5 rounded bg-white/10 text-[#fbff47] font-mono text-[11px] sm:text-xs">$1</code>'
  );
  return res;
}

export function ExplainModal({
  isOpen,
  onClose,
  explanation,
  loading = false,
  error = null,
  selectedCode = '',
  language = 'javascript',
  timestamp = null,
  user = null,
  onRetry = null,
}) {
  const [copied, setCopied] = useState(false);
  const [showCodeSnippet, setShowCodeSnippet] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!explanation) return;
    navigator.clipboard.writeText(explanation);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedTime = timestamp
    ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : 'Just now';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="explain-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-[#0c101a] border border-white/15 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header Bar */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-[#080c14] border-b border-white/10 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white text-black flex items-center justify-center shadow-md shrink-0">
              <FontAwesomeIcon icon={faWandMagicSparkles} className="text-xs sm:text-sm text-black" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="explain-modal-title" className="text-sm sm:text-base font-semibold text-white tracking-wide">
                  Code Explanation
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-[#fbff47]/10 border border-[#fbff47]/30 text-[#fbff47] font-mono text-[10px] uppercase font-medium">
                  {language || 'code'}
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 font-sans hidden sm:block">
                Powered by Gemini AI • Real-time analysis
              </p>
            </div>
          </div>

          {/* Close X Button */}
          <button
            type="button"
            onClick={onClose}
            title="Close (Esc)"
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-neutral-300 hover:text-white transition-colors flex items-center justify-center cursor-pointer text-xs"
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        {/* Selected Code Preview Collapsible */}
        {selectedCode && (
          <div className="px-4 sm:px-6 py-2 bg-[#06080e] border-b border-white/5 flex flex-col gap-1.5 shrink-0">
            <div className="flex items-center justify-between text-[11px] text-neutral-400">
              <button
                type="button"
                onClick={() => setShowCodeSnippet((prev) => !prev)}
                className="flex items-center gap-1.5 text-neutral-300 hover:text-white transition-colors cursor-pointer font-sans"
              >
                <FontAwesomeIcon icon={faCode} className="text-neutral-400 text-[10px]" />
                <span className="font-medium">
                  {showCodeSnippet ? 'Hide selected code snippet' : 'View selected code snippet'}
                </span>
                <span className="text-[10px] text-neutral-500 font-mono">
                  ({selectedCode.split('\n').length} lines)
                </span>
              </button>

              {user?.name && (
                <div className="flex items-center gap-1 text-[10px] text-neutral-400 font-sans">
                  <FontAwesomeIcon icon={faUser} className="text-[9px]" />
                  <span>{user.name}</span>
                </div>
              )}
            </div>

            {showCodeSnippet && (
              <div className="mt-1 max-h-32 overflow-y-auto rounded-lg bg-[#0a0e16] border border-white/10 p-2.5 font-mono text-[11px] text-neutral-300 select-text scrollbar-thin">
                <pre className="whitespace-pre-wrap break-words">{selectedCode}</pre>
              </div>
            )}
          </div>
        )}

        {/* Modal Body - Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 select-text scrollbar-thin space-y-4">
          {/* 1. Loading State */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-10 sm:py-14 text-center space-y-4">
              <div className="relative">
                <div className="w-12 h-12 rounded-full border-2 border-[#fbff47]/20 border-t-[#fbff47] animate-spin flex items-center justify-center" />
                <FontAwesomeIcon
                  icon={faWandMagicSparkles}
                  className="absolute inset-0 m-auto text-[#fbff47] text-xs animate-pulse"
                />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-white tracking-wide">
                  Requesting explanation...
                </h4>
                <p className="text-xs text-neutral-400 max-w-xs mx-auto leading-relaxed">
                  Gemini AI is analyzing code structure, syntax, and logic bounds.
                </p>
              </div>
            </div>
          )}

          {/* 2. Error State */}
          {!loading && error && (
            <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-200 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-red-900/60 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0">
                  <FontAwesomeIcon icon={faTriangleExclamation} className="text-xs" />
                </div>
                <div className="flex-1">
                  <h4 className="text-xs font-semibold text-red-300 mb-0.5">
                    Failed to Generate Explanation
                  </h4>
                  <p className="text-xs text-red-200/90 leading-relaxed">{error}</p>
                </div>
              </div>

              {onRetry && (
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={onRetry}
                    className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <FontAwesomeIcon icon={faRotateRight} className="text-[10px]" />
                    <span>Retry Request</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 3. Explanation Content State */}
          {!loading && !error && explanation && (
            <div className="space-y-3">
              <FormattedExplanation text={explanation} />
            </div>
          )}

          {/* 4. Empty State if no error and no explanation */}
          {!loading && !error && !explanation && (
            <div className="text-center py-10 text-neutral-500 text-xs">
              No explanation available. Select code in the editor and click &quot;Explain Code&quot;.
            </div>
          )}
        </div>

        {/* Footer Bar */}
        <div className="px-4 sm:px-6 py-3 bg-[#080c14] border-t border-white/10 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 text-[11px] text-neutral-400 font-sans">
            <FontAwesomeIcon icon={faClock} className="text-[10px] text-neutral-500" />
            <span>{formattedTime}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Copy Button */}
            <button
              type="button"
              onClick={handleCopy}
              disabled={loading || !explanation}
              className="px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-40 cursor-pointer shadow-sm"
            >
              <FontAwesomeIcon
                icon={copied ? faCheck : faCopy}
                className={copied ? 'text-emerald-400 text-xs' : 'text-xs'}
              />
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-white hover:bg-neutral-200 text-black text-xs font-semibold transition-all active:scale-95 cursor-pointer shadow-md"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ExplainModal;
