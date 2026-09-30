// components/OutputPanel.jsx - Complete Code Execution Output Terminal
import React, { useState, useRef, useEffect, memo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTerminal,
  faChevronDown,
  faChevronUp,
  faTrashCan,
  faCopy,
  faCheck,
  faClock,
  faCircleExclamation,
  faCircleCheck,
  faSpinner,
  faGripLines,
  faDownload,
  faKeyboard,
  faArrowUpRightFromSquare,
  faCompress,
  faPlay,
} from '@fortawesome/free-solid-svg-icons';

const MAX_DISPLAY_CHARS = 10000;

export const OutputPanel = memo(function OutputPanel({
  output = '',
  executionTime = null,
  isError = false,
  isRunning = false,
  status = 'idle', // 'idle' | 'running' | 'success' | 'error' | 'timeout'
  ranBy = null,
  language = 'javascript',
  stdin = '',
  onStdinChange = null,
  onClear = null,
  onRun = null,
  isCollapsed = false,
  onToggleCollapse = null,
  height = 180,
  onStartResize = null,
}) {
  const [copied, setCopied] = useState(false);
  const [showStdin, setShowStdin] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const outputContainerRef = useRef(null);
  const outputEndRef = useRef(null);

  // Auto-scroll to bottom of output on new output
  useEffect(() => {
    if (output && outputContainerRef.current) {
      outputContainerRef.current.scrollTop = outputContainerRef.current.scrollHeight;
    }
  }, [output, isRunning]);

  // Copy output to clipboard
  const handleCopy = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignored
    }
  };

  // Download output as text file
  const handleDownload = () => {
    if (!output) return;
    try {
      const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `codeo-output-${Date.now()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn('Failed to download output:', err);
    }
  };

  // Truncate output safely if > 10,000 characters
  const safeOutput = typeof output === 'string' ? output : (output ? String(output) : '');
  const formattedOutput = safeOutput.length > MAX_DISPLAY_CHARS
    ? safeOutput.slice(0, MAX_DISPLAY_CHARS) + '\n\n[... Output truncated at 10,000 characters ...]'
    : safeOutput;

  // Determine output coloring
  const isTimeout = status === 'timeout' || safeOutput.toLowerCase().includes('timeout');
  const hasError = isError || status === 'error' || isTimeout;

  const effectiveHeight = isExpanded ? Math.max(340, height * 2) : height;

  return (
    <div className="w-full bg-[#080b11] border-t border-white/10 flex flex-col font-mono text-xs select-none relative shrink-0 transition-all duration-150">
      {/* Draggable Splitter Handle - slide to resize terminal */}
      {!isCollapsed && onStartResize && !isExpanded && (
        <div
          onMouseDown={onStartResize}
          className="group w-full h-2 -mt-1 absolute top-0 left-0 z-30 cursor-row-resize flex items-center justify-center select-none"
          title="Drag up or down to resize terminal"
        >
          <div className="h-[2px] w-full bg-transparent group-hover:bg-[#fbff47] group-active:bg-[#fbff47] transition-colors" />
          <div className="absolute top-1/2 -translate-y-1/2 px-3 py-0.5 rounded-full bg-[#111622] border border-white/10 group-hover:border-[#fbff47]/60 text-neutral-400 group-hover:text-[#fbff47] transition-colors flex items-center shadow-lg">
            <FontAwesomeIcon icon={faGripLines} className="text-[8px]" />
          </div>
        </div>
      )}

      {/* Terminal Header Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#0c1018] border-b border-white/5 text-neutral-300 gap-2 shrink-0">
        <div className="flex items-center gap-2 sm:gap-2.5 overflow-x-auto scrollbar-none">
          {/* Collapse / Expand Button */}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer shrink-0"
            title={isCollapsed ? 'Expand Terminal' : 'Collapse Terminal'}
          >
            <FontAwesomeIcon icon={faTerminal} className="text-[#fbff47] text-xs" />
            <span className="font-sans font-semibold text-xs tracking-wide">Terminal</span>
            {onToggleCollapse && (
              <FontAwesomeIcon
                icon={isCollapsed ? faChevronUp : faChevronDown}
                className="text-[9px] text-neutral-500"
              />
            )}
          </button>

          {/* Execution Status Badge */}
          {isRunning && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-sans shrink-0">
              <FontAwesomeIcon icon={faSpinner} className="animate-spin text-[9px]" />
              <span>Running...</span>
            </span>
          )}

          {!isRunning && executionTime !== null && (
            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-sans ${hasError
                  ? 'bg-red-500/10 border border-red-500/30 text-red-300'
                  : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                  }`}
              >
                <FontAwesomeIcon
                  icon={hasError ? faCircleExclamation : faCircleCheck}
                  className="text-[9px]"
                />
                {isTimeout ? 'Timeout' : hasError ? 'Error' : 'Success'}
              </span>

              <span className="flex items-center gap-1 text-neutral-400 text-[10px]">
                <FontAwesomeIcon icon={faClock} className="text-[9px] text-neutral-500" />
                {executionTime}ms
              </span>

              {ranBy && (
                <span className="text-[10px] text-neutral-500 font-sans hidden md:inline">
                  (by <span className="text-neutral-300">{ranBy}</span>)
                </span>
              )}
            </div>
          )}

          {/* Shortcut hint on desktop */}
          <div className="hidden lg:flex items-center gap-1 text-[10px] text-neutral-500 font-sans">
            <FontAwesomeIcon icon={faKeyboard} className="text-[9px]" />
            <span>Ctrl+Enter</span>
          </div>
        </div>

        {/* Right Tools: Stdin Toggle, Download, Copy, Clear, Fullscreen */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Stdin Toggle Button */}
          {onStdinChange && (
            <button
              type="button"
              onClick={() => setShowStdin((prev) => !prev)}
              title="Toggle Standard Input (stdin)"
              className={`px-1.5 py-0.5 rounded text-[10px] font-sans transition-colors cursor-pointer flex items-center gap-1 border ${showStdin || (stdin && stdin.trim())
                ? 'bg-[#fbff47]/15 border-[#fbff47]/40 text-[#fbff47]'
                : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white'
                }`}
            >
              <span>Input</span>
              {stdin && stdin.trim() && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#fbff47]" />
              )}
            </button>
          )}

          {output && !isCollapsed && (
            <>
              {/* Copy Button */}
              <button
                type="button"
                onClick={handleCopy}
                title="Copy Output to Clipboard"
                className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-white transition-colors text-xs cursor-pointer"
              >
                <FontAwesomeIcon
                  icon={copied ? faCheck : faCopy}
                  className={copied ? 'text-emerald-400' : ''}
                />
              </button>

              {/* Download Output Button */}
              <button
                type="button"
                onClick={handleDownload}
                title="Download Output (.txt)"
                className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-white transition-colors text-xs cursor-pointer hidden sm:inline-block"
              >
                <FontAwesomeIcon icon={faDownload} />
              </button>

              {/* Clear Output Button */}
              {onClear && (
                <button
                  type="button"
                  onClick={onClear}
                  title="Clear Terminal Output"
                  className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-red-400 transition-colors text-xs cursor-pointer"
                >
                  <FontAwesomeIcon icon={faTrashCan} />
                </button>
              )}

              {/* Expand / Minimize Height */}
              <button
                type="button"
                onClick={() => setIsExpanded((prev) => !prev)}
                title={isExpanded ? 'Restore Terminal Size' : 'Expand Terminal Size'}
                className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-white transition-colors text-xs cursor-pointer hidden sm:inline-block"
              >
                <FontAwesomeIcon icon={isExpanded ? faCompress : faArrowUpRightFromSquare} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Optional Stdin Input Drawer */}
      {!isCollapsed && showStdin && onStdinChange && (
        <div className="bg-[#0b0e16] border-b border-white/10 p-2.5 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[10px] text-neutral-400 font-sans">
            <span className="font-semibold uppercase tracking-wider text-neutral-300">
              Standard Input
            </span>
            <div className="flex items-center gap-2">
              <span className="italic">Provide input for programs reading from input</span>
              {stdin && (
                <button
                  type="button"
                  onClick={() => onStdinChange('')}
                  className="text-red-400 hover:underline cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          <textarea
            value={stdin}
            onChange={(e) => onStdinChange(e.target.value)}
            placeholder="Type input data here (optional)..."
            rows={2}
            className="w-full bg-[#06080d] border border-white/10 rounded-lg p-2 text-white font-mono text-xs focus:outline-none focus:border-[#fbff47]/60 resize-none max-h-20"
          />
        </div>
      )}

      {/* Output Content Area with slide-able height */}
      {!isCollapsed && (
        <div
          ref={outputContainerRef}
          style={{ height: `${effectiveHeight}px` }}
          className="p-3 overflow-y-auto font-mono text-xs leading-relaxed select-text bg-[#06080d]"
        >
          {isRunning ? (
            <div className="flex items-center gap-2.5 text-neutral-400 italic text-xs py-1">
              <FontAwesomeIcon icon={faSpinner} className="animate-spin text-xs text-[#fbff47]" />
              <span>Running code through Judge0 execution environment...</span>
            </div>
          ) : formattedOutput ? (
            <pre
              className={`whitespace-pre-wrap break-all ${isTimeout
                ? 'text-amber-300 font-medium'
                : hasError
                  ? 'text-red-400 font-medium'
                  : 'text-emerald-300/90'
                }`}
            >
              {formattedOutput}
            </pre>
          ) : (
            <div className="flex items-center justify-between h-full text-neutral-600 italic select-none text-xs">
              <span>Click "Run Code" or press Ctrl+Enter to execute program via Judge0.</span>
              {onRun && (
                <button
                  type="button"
                  onClick={onRun}
                  className="not-italic px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer text-[11px]"
                >
                  <FontAwesomeIcon icon={faPlay} className="text-[9px] text-[#fbff47]" />
                  <span>Run Now</span>
                </button>
              )}
            </div>
          )}
          <div ref={outputEndRef} />
        </div>
      )}
    </div>
  );
});

export default OutputPanel;
