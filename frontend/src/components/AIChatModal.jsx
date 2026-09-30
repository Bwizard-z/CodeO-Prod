// frontend/src/components/AIChatModal.jsx - Interactive Gemini AI Code Assistant Modal & Chat
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faWandMagicSparkles,
  faXmark,
  faPaperPlane,
  faCode,
  faCopy,
  faCheck,
  faTriangleExclamation,
  faRotateRight,
  faTrashCan,
  faLightbulb,
  faBolt,
  faFileCode,
  faBug,
  faUser,
  faRobot,
} from '@fortawesome/free-solid-svg-icons';
import { useAI } from '../hooks/useAI';

/**
 * Format markdown text into structured React elements with code block highlighting and copy buttons.
 */
function FormattedMessage({ content }) {
  if (!content) return null;

  // Split content by fenced code blocks (```language ... ```)
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-2 text-xs sm:text-sm text-neutral-200 leading-relaxed break-words font-sans">
      {parts.map((part, pIdx) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const lines = part.slice(3, -3).trim().split('\n');
          const firstLine = lines[0].trim();
          const hasLang = /^[a-zA-Z0-9_+#.-]+$/.test(firstLine);
          const lang = hasLang ? firstLine : '';
          const codeBody = hasLang ? lines.slice(1).join('\n') : lines.join('\n');

          return <CodeSnippetBlock key={pIdx} code={codeBody} language={lang} />;
        }

        // Standard text with inline markdown
        const textLines = part.split('\n');
        return (
          <div key={pIdx} className="space-y-1.5">
            {textLines.map((line, lIdx) => {
              const trimmed = line.trim();
              if (!trimmed) return <div key={lIdx} className="h-1.5" />;

              // Header 3 (###)
              if (trimmed.startsWith('### ')) {
                return (
                  <h4 key={lIdx} className="text-xs font-semibold text-[#fbff47] uppercase tracking-wider pt-2 pb-0.5 border-b border-white/5">
                    {trimmed.replace(/^###\s+/, '')}
                  </h4>
                );
              }

              // Header 2 (##)
              if (trimmed.startsWith('## ')) {
                return (
                  <h3 key={lIdx} className="text-sm font-semibold text-white pt-2.5 pb-0.5 border-b border-white/10">
                    {trimmed.replace(/^##\s+/, '')}
                  </h3>
                );
              }

              // Bullet points (* or - or •)
              if (trimmed.startsWith('* ') || trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
                const bulletContent = trimmed.replace(/^(\*|-|•)\s+/, '');
                return (
                  <div key={lIdx} className="flex items-start gap-2 pl-1.5">
                    <span className="text-[#34d399] text-xs font-bold leading-5">•</span>
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
                  <div key={lIdx} className="flex items-start gap-2 pl-1.5">
                    <span className="text-neutral-400 font-mono text-xs font-semibold leading-5">
                      {numMatch[1]}.
                    </span>
                    <div
                      className="flex-1 leading-normal"
                      dangerouslySetInnerHTML={{ __html: formatInlineTags(numMatch[2]) }}
                    />
                  </div>
                );
              }

              // Normal text
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
  // Escape HTML
  res = res.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Bold
  res = res.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>');
  // Inline code
  res = res.replace(
    /`([^`]+)`/g,
    '<code class="px-1.5 py-0.5 rounded bg-black/40 text-[#fbff47] font-mono text-[11px] border border-white/10">$1</code>'
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
    <div className="my-2 rounded-xl bg-[#070a10] border border-white/10 overflow-hidden shadow-md">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#0b0f19] border-b border-white/5 text-[11px] text-neutral-400 font-mono">
        <span className="uppercase text-[10px] tracking-wider text-neutral-300 font-medium">
          {language || 'code'}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-[10px] text-neutral-400 hover:text-white px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
        >
          <FontAwesomeIcon icon={copied ? faCheck : faCopy} className={copied ? 'text-emerald-400' : ''} />
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="p-3 font-mono text-xs text-neutral-200 overflow-x-auto whitespace-pre leading-relaxed select-text scrollbar-thin">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function AIChatModal({
  isOpen,
  selectedCode = '',
  language = 'javascript',
  roomId = null,
  initialPrompt = '',
  onClose,
}) {
  const { sendMessage, loadHistory, loading, error, setError } = useAI();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [showCodePreview, setShowCodePreview] = useState(true);
  const [codeContext, setCodeContext] = useState(selectedCode);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Sync selected code context when prop updates
  useEffect(() => {
    if (selectedCode) {
      setCodeContext(selectedCode);
    }
  }, [selectedCode]);

  // Load chat history from API on modal open
  useEffect(() => {
    let isMounted = true;
    if (isOpen && roomId) {
      loadHistory(roomId).then((res) => {
        if (isMounted && res && Array.isArray(res.history)) {
          const formatted = [];
          res.history.forEach((item) => {
            if (item.message) {
              formatted.push({
                role: 'user',
                content: item.message,
                timestamp: item.created_at,
                codeContext: item.code_context,
              });
            }
            if (item.response) {
              formatted.push({
                role: 'assistant',
                content: item.response,
                timestamp: item.created_at,
              });
            }
          });
          setMessages(formatted);
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen, roomId, loadHistory]);

  // Auto-trigger initial prompt if provided (e.g. from context menu)
  const initialTriggerRef = useRef(false);
  useEffect(() => {
    if (isOpen && initialPrompt && !initialTriggerRef.current) {
      initialTriggerRef.current = true;
      handleSendMessage(initialPrompt);
    }
    if (!isOpen) {
      initialTriggerRef.current = false;
    }
  }, [isOpen, initialPrompt]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const handleSendMessage = async (textToSend) => {
    const query = (typeof textToSend === 'string' ? textToSend : input).trim();
    if (!query) return;

    if (typeof textToSend !== 'string') {
      setInput('');
    }

    const currentContext = codeContext || selectedCode || '';
    const userMsgObj = {
      role: 'user',
      content: query,
      timestamp: new Date().toISOString(),
      codeContext: currentContext ? currentContext.slice(0, 300) : null,
    };

    setMessages((prev) => [...prev, userMsgObj]);
    setError(null);

    try {
      const historyPayload = messages.map((m) => ({
        role: m.role,
        message: m.content,
      }));

      const res = await sendMessage(
        query,
        currentContext,
        language || 'javascript',
        roomId,
        historyPayload
      );

      if (res && res.success && res.message) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: res.message,
            timestamp: res.timestamp || new Date().toISOString(),
          },
        ]);
      } else {
        throw new Error(res?.error || 'Failed to get AI response');
      }
    } catch (err) {
      // Keep user message or notify
      setError(err.message || 'Failed to get AI response. Please try again.');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (loading || !input.trim()) return;
    handleSendMessage(input);
  };

  const handleQuickAction = (actionPrompt) => {
    handleSendMessage(actionPrompt);
  };

  const handleClearHistory = () => {
    setMessages([]);
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-chat-title"
      className="fixed inset-y-0 right-0 z-50 w-full sm:w-[440px] md:w-[480px] bg-[#090d16] border-l border-white/15 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200 select-none"
    >
      {/* 1. Header Bar */}
      <div className="px-4 py-3 bg-[#0c101a] border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#fbff47] text-black flex items-center justify-center shadow-md shrink-0">
            <FontAwesomeIcon icon={faWandMagicSparkles} className="text-xs text-black" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 id="ai-chat-title" className="text-sm font-semibold text-white tracking-wide">
                AI Code Assistant
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-[#3b82f6]/20 border border-[#3b82f6]/30 text-[#60a5fa] font-mono text-[10px] uppercase font-semibold">
                {language || 'javascript'}
              </span>
            </div>
            <p className="text-[10px] text-neutral-400 font-sans">
              Powered by Gemini AI • Context-Aware
            </p>
          </div>
        </div>

        {/* Action Controls: Clear History & Close */}
        <div className="flex items-center gap-1.5">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleClearHistory}
              title="Clear Chat History"
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer text-xs"
            >
              <FontAwesomeIcon icon={faTrashCan} />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            title="Close Assistant (Esc)"
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer text-xs"
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>
      </div>

      {/* 2. Code Context Display Banner (Collapsible) */}
      {codeContext && (
        <div className="px-3.5 py-2 bg-[#06080e] border-b border-white/5 flex flex-col gap-1 shrink-0">
          <div className="flex items-center justify-between text-[11px]">
            <button
              type="button"
              onClick={() => setShowCodePreview((prev) => !prev)}
              className="flex items-center gap-1.5 text-neutral-300 hover:text-white transition-colors cursor-pointer font-sans"
            >
              <FontAwesomeIcon icon={faCode} className="text-[#fbff47] text-[10px]" />
              <span className="font-semibold text-white">Active Code Context</span>
              <span className="text-[10px] text-neutral-500 font-mono">
                ({codeContext.split('\n').length} lines)
              </span>
            </button>

            <button
              type="button"
              onClick={() => setCodeContext('')}
              title="Detach code context"
              className="text-[10px] text-neutral-500 hover:text-red-400 transition-colors cursor-pointer"
            >
              Clear Context
            </button>
          </div>

          {showCodePreview && (
            <div className="max-h-24 overflow-y-auto rounded-lg bg-[#0a0e16] border border-white/10 p-2 font-mono text-[11px] text-neutral-300 select-text scrollbar-thin">
              <pre className="whitespace-pre-wrap break-words">{codeContext.slice(0, 400)}</pre>
            </div>
          )}
        </div>
      )}

      {/* 3. Messages Area */}
      <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3.5 select-text scrollbar-thin">
        {/* Empty State with Quick Action Suggestions */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full py-8 text-center space-y-4 select-none">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[#fbff47] text-xl shadow-inner">
              <FontAwesomeIcon icon={faLightbulb} />
            </div>
            <div className="space-y-1 max-w-xs">
              <h4 className="text-sm font-semibold text-white">How can I help you with your code?</h4>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Ask anything about syntax, algorithms, debugging, or optimization.
              </p>
            </div>

            {/* Quick Action Chips */}
            <div className="grid grid-cols-2 gap-2 w-full max-w-sm pt-2">
              <button
                type="button"
                onClick={() => handleQuickAction('Explain this code step-by-step and highlight key logic.')}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-all hover:scale-[1.02] cursor-pointer group"
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold text-white mb-0.5 group-hover:text-[#fbff47]">
                  <FontAwesomeIcon icon={faLightbulb} className="text-[10px] text-[#fbff47]" />
                  <span>Explain Code</span>
                </div>
                <p className="text-[10px] text-neutral-400 leading-tight">Step-by-step logic overview</p>
              </button>

              <button
                type="button"
                onClick={() => handleQuickAction('Suggest improvements and optimizations for this code.')}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-all hover:scale-[1.02] cursor-pointer group"
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold text-white mb-0.5 group-hover:text-emerald-400">
                  <FontAwesomeIcon icon={faBolt} className="text-[10px] text-emerald-400" />
                  <span>Improve Code</span>
                </div>
                <p className="text-[10px] text-neutral-400 leading-tight">Best practices & speed</p>
              </button>

              <button
                type="button"
                onClick={() => handleQuickAction('Generate clean, comprehensive documentation and JSDoc comments for this code.')}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-all hover:scale-[1.02] cursor-pointer group"
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold text-white mb-0.5 group-hover:text-blue-400">
                  <FontAwesomeIcon icon={faFileCode} className="text-[10px] text-blue-400" />
                  <span>Document</span>
                </div>
                <p className="text-[10px] text-neutral-400 leading-tight">Generate inline docstrings</p>
              </button>

              <button
                type="button"
                onClick={() => handleQuickAction('Find any potential edge case bugs or error risks in this code.')}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-all hover:scale-[1.02] cursor-pointer group"
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold text-white mb-0.5 group-hover:text-amber-400">
                  <FontAwesomeIcon icon={faBug} className="text-[10px] text-amber-400" />
                  <span>Debug & Audit</span>
                </div>
                <p className="text-[10px] text-neutral-400 leading-tight">Identify risks & bugs</p>
              </button>
            </div>
          </div>
        )}

        {/* Message Bubbles */}
        {messages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={idx}
              className={`flex gap-2.5 sm:gap-3 ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in duration-200`}
            >
              {!isUser && (
                <div className="w-7 h-7 rounded-lg bg-[#fbff47] text-black flex items-center justify-center text-xs shrink-0 shadow-sm mt-0.5">
                  <FontAwesomeIcon icon={faRobot} />
                </div>
              )}

              <div className={`flex flex-col ${isUser ? 'items-end max-w-[85%]' : 'items-start max-w-[90%]'}`}>
                <div
                  className={`p-3 rounded-2xl ${
                    isUser
                      ? 'bg-blue-600 text-white rounded-tr-sm shadow-md font-sans text-xs sm:text-sm'
                      : 'bg-[#111726] border border-white/10 text-neutral-200 rounded-tl-sm shadow-md'
                  }`}
                >
                  {isUser ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <FormattedMessage content={msg.content} />
                  )}
                </div>

                {/* Message Timestamp */}
                {msg.timestamp && (
                  <span className="text-[10px] text-neutral-500 font-mono mt-1 px-1">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>

              {isUser && (
                <div className="w-7 h-7 rounded-lg bg-blue-700 text-white flex items-center justify-center text-xs shrink-0 shadow-sm mt-0.5">
                  <FontAwesomeIcon icon={faUser} />
                </div>
              )}
            </div>
          );
        })}

        {/* Loading / Typing Indicator */}
        {loading && (
          <div className="flex gap-2.5 items-start animate-in fade-in duration-200">
            <div className="w-7 h-7 rounded-lg bg-[#fbff47] text-black flex items-center justify-center text-xs shrink-0 shadow-sm">
              <FontAwesomeIcon icon={faRobot} />
            </div>
            <div className="p-3.5 rounded-2xl bg-[#111726] border border-white/10 text-neutral-300 rounded-tl-sm flex items-center gap-2">
              <div className="flex gap-1.5 items-center">
                <span className="w-2 h-2 rounded-full bg-[#fbff47] animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 rounded-full bg-[#fbff47] animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 rounded-full bg-[#fbff47] animate-bounce" />
              </div>
              <span className="text-xs text-neutral-400 font-sans ml-1">Gemini is thinking...</span>
            </div>
          </div>
        )}

        {/* Error Alert Box */}
        {error && (
          <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-start gap-2 animate-in fade-in">
            <FontAwesomeIcon icon={faTriangleExclamation} className="text-red-400 text-xs mt-0.5 shrink-0" />
            <div className="flex-1 leading-relaxed">
              <span className="font-semibold text-red-300">Notice: </span>
              {error}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 4. Quick Action Chips Bar (shown when chat is active) */}
      {messages.length > 0 && (
        <div className="px-3 py-1.5 bg-[#080c14] border-t border-white/5 flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
          <button
            type="button"
            onClick={() => handleQuickAction('Explain this code in detail.')}
            className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-neutral-300 text-[11px] font-sans whitespace-nowrap transition-colors cursor-pointer shrink-0"
          >
            Explain
          </button>
          <button
            type="button"
            onClick={() => handleQuickAction('Suggest optimizations and clean code improvements.')}
            className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-neutral-300 text-[11px] font-sans whitespace-nowrap transition-colors cursor-pointer shrink-0"
          >
            Optimize
          </button>
          <button
            type="button"
            onClick={() => handleQuickAction('Generate documentation and types.')}
            className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-neutral-300 text-[11px] font-sans whitespace-nowrap transition-colors cursor-pointer shrink-0"
          >
            Document
          </button>
          <button
            type="button"
            onClick={() => handleQuickAction('Find edge cases and potential bugs.')}
            className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-neutral-300 text-[11px] font-sans whitespace-nowrap transition-colors cursor-pointer shrink-0"
          >
            Find Bugs
          </button>
        </div>
      )}

      {/* 5. Input Bar */}
      <form onSubmit={handleSubmit} className="p-3 bg-[#0c101a] border-t border-white/10 flex items-center gap-2 shrink-0">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={loading ? 'Waiting for response...' : 'Ask a follow-up coding question...'}
          disabled={loading}
          className="flex-1 bg-[#06080e] border border-white/10 focus:border-[#fbff47]/60 focus:ring-1 focus:ring-[#fbff47]/40 text-white rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-sans placeholder:text-neutral-500 outline-none transition-all disabled:opacity-50"
        />

        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="w-10 h-10 rounded-xl bg-[#fbff47] hover:bg-yellow-300 text-black flex items-center justify-center transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-md shrink-0"
        >
          {loading ? (
            <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
          ) : (
            <FontAwesomeIcon icon={faPaperPlane} className="text-xs text-black" />
          )}
        </button>
      </form>
    </div>
  );
}

export default AIChatModal;
