// components/Editor/AiPanel.jsx - Gemini AI Right Side Panel with Chat & Code Explanation
import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faWandMagicSparkles,
  faPaperPlane,
  faXmark,
  faCopy,
  faCheck,
  faTrashCan,
  faLightbulb,
  faBolt,
  faFileCode,
  faBug,
  faCode,
  faRobot,
  faUser,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';

/**
 * Format markdown text into structured React elements with syntax-styled code blocks and copy buttons.
 */
function FormattedOutput({ text }) {
  if (!text) return null;

  // Split content by code blocks
  const parts = text.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-2 text-xs text-neutral-200 leading-relaxed font-sans select-text break-words">
      {parts.map((part, pIdx) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const lines = part.slice(3, -3).trim().split('\n');
          const firstLine = lines[0].trim();
          const hasLang = /^[a-zA-Z0-9_+#.-]+$/.test(firstLine);
          const lang = hasLang ? firstLine : '';
          const codeBody = hasLang ? lines.slice(1).join('\n') : lines.join('\n');

          return <CodeSnippetBlock key={pIdx} code={codeBody} language={lang} />;
        }

        const lines = part.split('\n');
        return (
          <div key={pIdx} className="space-y-1.5">
            {lines.map((line, lIdx) => {
              const trimmed = line.trim();
              if (!trimmed) return <div key={lIdx} className="h-1.5" />;

              // Header 3 (###)
              if (trimmed.startsWith('### ')) {
                return (
                  <h4
                    key={lIdx}
                    className="text-[11px] font-bold text-[#fbff47] uppercase tracking-wider pt-2 pb-0.5 border-b border-white/5"
                  >
                    {trimmed.replace(/^###\s+/, '')}
                  </h4>
                );
              }

              // Header 2 (##)
              if (trimmed.startsWith('## ')) {
                return (
                  <h3
                    key={lIdx}
                    className="text-xs font-semibold text-white pt-2 pb-0.5 border-b border-white/10"
                  >
                    {trimmed.replace(/^##\s+/, '')}
                  </h3>
                );
              }

              // Bullet points (* or - or •)
              if (trimmed.startsWith('* ') || trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
                const bulletContent = trimmed.replace(/^(\*|-|•)\s+/, '');
                return (
                  <div key={lIdx} className="flex items-start gap-1.5 pl-1">
                    <span className="text-[#34d399] text-xs font-bold leading-4">•</span>
                    <div
                      className="flex-1 leading-normal"
                      dangerouslySetInnerHTML={{ __html: formatInlineTags(bulletContent) }}
                    />
                  </div>
                );
              }

              // Numbered list
              const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
              if (numMatch) {
                return (
                  <div key={lIdx} className="flex items-start gap-1.5 pl-1">
                    <span className="text-neutral-400 font-mono text-[11px] font-semibold leading-4">
                      {numMatch[1]}.
                    </span>
                    <div
                      className="flex-1 leading-normal"
                      dangerouslySetInnerHTML={{ __html: formatInlineTags(numMatch[2]) }}
                    />
                  </div>
                );
              }

              return (
                <p
                  key={lIdx}
                  className="text-neutral-300 leading-normal"
                  dangerouslySetInnerHTML={{ __html: formatInlineTags(line) }}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function formatInlineTags(str) {
  if (!str) return '';
  let res = str;
  res = res.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  res = res.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>');
  res = res.replace(
    /`([^`]+)`/g,
    '<code class="px-1 py-0.5 rounded bg-black/50 text-[#fbff47] font-mono text-[10.5px] border border-white/10">$1</code>'
  );
  return res;
}

function CodeSnippetBlock({ code, language }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-2 rounded-lg bg-[#070a10] border border-white/10 overflow-hidden shadow-inner">
      <div className="flex items-center justify-between px-2.5 py-1 bg-[#0d121e] border-b border-white/5 text-[10px] text-neutral-400 font-mono">
        <span className="uppercase text-[9px] tracking-wider text-neutral-300 font-medium">
          {language || 'code'}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-[10px] text-neutral-400 hover:text-white px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
        >
          <FontAwesomeIcon icon={copied ? faCheck : faCopy} className={copied ? 'text-emerald-400' : ''} />
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="p-2.5 font-mono text-[11px] text-neutral-200 overflow-x-auto whitespace-pre leading-relaxed select-text scrollbar-thin">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function AiPanel({
  aiOutput = '',
  isExplaining = false,
  userName = 'Collaborator',
  selectedCode = '',
  language = 'javascript',
  error = null,
  chatHistory = [],
  onAskQuestion,
  onClearHistory,
  onCollapse,
  width,
}) {
  const [question, setQuestion] = useState('');
  const [copiedAll, setCopiedAll] = useState(false);
  const [showCodePreview, setShowCodePreview] = useState(false);
  const scrollRef = useRef(null);

  // Auto-scroll to bottom on new output or loading change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [aiOutput, isExplaining, chatHistory]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!question.trim() || isExplaining) return;
    onAskQuestion && onAskQuestion(question);
    setQuestion('');
  };

  const handleCopyAll = () => {
    if (!aiOutput) return;
    navigator.clipboard.writeText(aiOutput);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleQuickAction = (promptText) => {
    onAskQuestion && onAskQuestion(promptText);
  };

  return (
    <div
      style={{ width: `${width || 300}px` }}
      className="bg-[#080c14] text-white border-l border-white/10 flex flex-col justify-between shrink-0 select-none overflow-hidden h-full"
    >
      {/* 1. Header Bar */}
      <div className="p-3 border-b border-white/10 flex items-center justify-between shrink-0 bg-[#0a0e18]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-[#fbff47] text-black flex items-center justify-center shadow-sm">
            <FontAwesomeIcon icon={faWandMagicSparkles} className="text-[10px] text-black" />
          </div>
          <h2 className="text-sm font-semibold text-white tracking-wide flex items-center gap-1.5">
            <span>Gemini AI</span>
            <span className="px-1.5 py-0.2 rounded bg-white/10 text-[10px] font-mono uppercase text-[#fbff47]">
              {language || 'code'}
            </span>
          </h2>
        </div>

        <div className="flex items-center gap-1.5">
          {aiOutput && (
            <button
              type="button"
              onClick={handleCopyAll}
              title="Copy explanation"
              className="text-neutral-400 hover:text-white p-1 rounded hover:bg-white/10 transition-colors text-xs cursor-pointer"
            >
              <FontAwesomeIcon icon={copiedAll ? faCheck : faCopy} className={copiedAll ? 'text-emerald-400' : ''} />
            </button>
          )}

          {onClearHistory && (chatHistory.length > 0 || aiOutput) && (
            <button
              type="button"
              onClick={onClearHistory}
              title="Clear output"
              className="text-neutral-400 hover:text-white p-1 rounded hover:bg-white/10 transition-colors text-xs cursor-pointer"
            >
              <FontAwesomeIcon icon={faTrashCan} />
            </button>
          )}

          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              title="Collapse AI panel"
              className="text-neutral-400 hover:text-white p-1 rounded hover:bg-white/10 transition-colors text-xs cursor-pointer ml-0.5"
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          )}
        </div>
      </div>

      {/* 2. Selected Code Context (if active) */}
      {selectedCode && (
        <div className="px-3 py-1.5 bg-[#05080f] border-b border-white/5 flex flex-col gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setShowCodePreview((prev) => !prev)}
            className="flex items-center justify-between text-[10px] text-neutral-400 hover:text-white transition-colors cursor-pointer w-full text-left"
          >
            <div className="flex items-center gap-1 text-neutral-300 font-sans">
              <FontAwesomeIcon icon={faCode} className="text-[#fbff47] text-[9px]" />
              <span>Code Selection ({selectedCode.split('\n').length} lines)</span>
            </div>
            <span className="text-[9px] text-neutral-500 font-mono">
              {showCodePreview ? 'Hide' : 'View'}
            </span>
          </button>

          {showCodePreview && (
            <pre className="max-h-20 overflow-y-auto rounded bg-[#090d16] border border-white/10 p-1.5 font-mono text-[10px] text-neutral-300 select-text whitespace-pre-wrap break-words scrollbar-thin">
              {selectedCode.slice(0, 300)}
            </pre>
          )}
        </div>
      )}

      {/* 3. Output Stream & Chat Messages */}
      <div
        ref={scrollRef}
        className="flex-1 p-3 overflow-y-auto font-sans text-xs text-neutral-300 leading-relaxed space-y-3.5 scrollbar-thin select-text"
      >
        {/* Render Chat History turns */}
        {chatHistory && chatHistory.length > 0 && (
          <div className="space-y-3.5">
            {chatHistory.map((item, idx) => {
              // Format 1: Paired format { message: "...", response: "..." }
              if (item.message || item.response) {
                return (
                  <div key={idx} className="space-y-2.5">
                    {item.message && (
                      <div className="flex justify-end">
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl rounded-tr-xs px-3.5 py-2 max-w-[90%] text-xs shadow-md">
                          {item.user_name && (
                            <div className="text-[10px] text-blue-200 font-semibold mb-0.5">
                              {item.user_name}
                            </div>
                          )}
                          <p className="whitespace-pre-wrap leading-relaxed">{item.message}</p>
                        </div>
                      </div>
                    )}
                    {item.response && (
                      <div className="bg-[#0e1424] p-3.5 rounded-2xl border border-white/10 shadow-inner space-y-2">
                        <div className="flex items-center justify-between text-[10px] text-[#fbff47] font-semibold uppercase tracking-wider mb-1">
                          <div className="flex items-center gap-1.5">
                            <FontAwesomeIcon icon={faRobot} className="text-xs" />
                            <span>Gemini AI</span>
                          </div>
                        </div>
                        <FormattedOutput text={item.response} />
                      </div>
                    )}
                  </div>
                );
              }

              // Format 2: Turn-by-turn format { role: 'user' | 'assistant', text: "..." }
              const isUser = item.role === 'user';
              const textContent = item.text || item.content || item.msg || '';
              if (!textContent) return null;

              if (isUser) {
                return (
                  <div key={idx} className="flex justify-end">
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl rounded-tr-xs px-3.5 py-2 max-w-[90%] text-xs shadow-md">
                      {item.userName && (
                        <div className="text-[10px] text-blue-200 font-semibold mb-0.5">
                          {item.userName}
                        </div>
                      )}
                      <p className="whitespace-pre-wrap leading-relaxed">{textContent}</p>
                    </div>
                  </div>
                );
              }

              // Assistant message
              return (
                <div key={idx} className="bg-[#0e1424] p-3.5 rounded-2xl border border-white/10 shadow-inner space-y-2">
                  <div className="flex items-center justify-between text-[10px] text-[#fbff47] font-semibold uppercase tracking-wider mb-1">
                    <div className="flex items-center gap-1.5">
                      <FontAwesomeIcon icon={faRobot} className="text-xs" />
                      <span>Gemini AI</span>
                    </div>
                  </div>
                  <FormattedOutput text={textContent} />
                </div>
              );
            })}
          </div>
        )}

        {/* Current / Latest Standalone AI Output (if not already rendered in history) */}
        {aiOutput && (!chatHistory || chatHistory.length === 0) && (
          <div className="bg-[#0e1424] p-3.5 rounded-2xl border border-white/10 shadow-inner space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] text-[#fbff47] font-semibold uppercase tracking-wider mb-1">
              <FontAwesomeIcon icon={faRobot} className="text-xs" />
              <span>Gemini AI</span>
            </div>
            <FormattedOutput text={aiOutput} />
          </div>
        )}

        {/* Loading Spinner / Thinking State */}
        {isExplaining && (
          <div className="flex items-center gap-2 text-teal-300 font-medium p-3 bg-teal-950/40 border border-teal-500/20 rounded-xl text-xs animate-pulse">
            <FontAwesomeIcon icon={faWandMagicSparkles} className="animate-spin text-teal-400 text-xs" />
            <span>Gemini AI is analyzing code logic...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-2.5 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-start gap-2">
            <FontAwesomeIcon icon={faTriangleExclamation} className="text-red-400 text-xs mt-0.5 shrink-0" />
            <div className="flex-1 leading-normal">{error}</div>
          </div>
        )}

        {/* Empty State when no output and not explaining */}
        {!aiOutput && !isExplaining && (!chatHistory || chatHistory.length === 0) && (
          <div className="flex flex-col items-center justify-center py-6 text-center space-y-3 select-none">
            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[#fbff47] text-base">
              <FontAwesomeIcon icon={faLightbulb} />
            </div>
            <div className="space-y-0.5 max-w-[220px]">
              <h4 className="text-xs font-semibold text-white">Gemini Code Assistant</h4>
              <p className="text-[11px] text-neutral-400 leading-normal">
                Select code or ask a question to get instant AI explanations.
              </p>
            </div>

            {/* Quick Action Chips */}
            <div className="grid grid-cols-2 gap-1.5 w-full pt-1">
              <button
                type="button"
                onClick={() => handleQuickAction('Explain this code step-by-step.')}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-1 text-[11px] font-semibold text-white group-hover:text-[#fbff47]">
                  <FontAwesomeIcon icon={faLightbulb} className="text-[9px] text-[#fbff47]" />
                  <span>Explain</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickAction('Suggest improvements and optimizations for this code.')}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-1 text-[11px] font-semibold text-white group-hover:text-emerald-400">
                  <FontAwesomeIcon icon={faBolt} className="text-[9px] text-emerald-400" />
                  <span>Optimize</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickAction('Generate clean documentation and comments for this code.')}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-1 text-[11px] font-semibold text-white group-hover:text-blue-400">
                  <FontAwesomeIcon icon={faFileCode} className="text-[9px] text-blue-400" />
                  <span>Document</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickAction('Find potential edge cases or bugs in this code.')}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-1 text-[11px] font-semibold text-white group-hover:text-amber-400">
                  <FontAwesomeIcon icon={faBug} className="text-[9px] text-amber-400" />
                  <span>Find Bugs</span>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. Quick Action Bar when output exists */}
      {(aiOutput || (chatHistory && chatHistory.length > 0)) && (
        <div className="px-2.5 py-1 bg-[#06080e] border-t border-white/5 flex items-center gap-1 overflow-x-auto scrollbar-none shrink-0">
          <button
            type="button"
            onClick={() => handleQuickAction('Explain this in more detail.')}
            className="px-2 py-0.5 rounded-full bg-white/5 hover:bg-white/10 text-neutral-300 text-[10px] whitespace-nowrap transition-colors cursor-pointer shrink-0"
          >
            Explain
          </button>
          <button
            type="button"
            onClick={() => handleQuickAction('How can I optimize this further?')}
            className="px-2 py-0.5 rounded-full bg-white/5 hover:bg-white/10 text-neutral-300 text-[10px] whitespace-nowrap transition-colors cursor-pointer shrink-0"
          >
            Optimize
          </button>
          <button
            type="button"
            onClick={() => handleQuickAction('Find edge cases in this code.')}
            className="px-2 py-0.5 rounded-full bg-white/5 hover:bg-white/10 text-neutral-300 text-[10px] whitespace-nowrap transition-colors cursor-pointer shrink-0"
          >
            Find Bugs
          </button>
        </div>
      )}

      {/* 5. Bottom Prompt Input Form */}
      <div className="p-2.5 bg-[#000000] border-t border-white/10 shrink-0">
        <form onSubmit={handleSubmit} className="relative">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={isExplaining}
            placeholder={isExplaining ? 'Thinking...' : 'Ask Gemini anything...'}
            className="w-full bg-white text-black placeholder:text-neutral-500 placeholder:font-serif placeholder:italic px-3 py-2 rounded-lg text-xs font-sans focus:outline-none focus:ring-2 focus:ring-neutral-400 pr-8 shadow-md transition-all disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={isExplaining || !question.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-black/60 hover:text-black transition-colors disabled:opacity-30 cursor-pointer"
            title="Send to AI"
          >
            <FontAwesomeIcon icon={faPaperPlane} className="text-xs" />
          </button>
        </form>

        <div className="font-serif italic text-[10px] text-neutral-400 mt-1.5 text-center tracking-wide">
          Assistant for {userName || 'Collaborator'}
        </div>
      </div>
    </div>
  );
}

export default AiPanel;
