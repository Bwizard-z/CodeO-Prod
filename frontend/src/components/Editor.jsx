// components/Editor.jsx - Monaco Collaborative Code Editor with Yjs Real-Time Sync
import React, { useRef, useEffect, useState, useCallback } from 'react';
import MonacoEditor from '@monaco-editor/react';
import { useMonacoBinding } from '../hooks/useMonacoBinding';
import { CursorDisplay } from './CursorDisplay';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTriangleExclamation,
  faEye,
  faEyeSlash,
  faCheck,
  faArrowsRotate,
  faWandMagicSparkles,
  faTerminal,
  faLock,
  faBan,
} from '@fortawesome/free-solid-svg-icons';

const MONACO_LANGUAGE_MAP = {
  javascript: 'javascript',
  python: 'python',
  java: 'java',
  cpp: 'cpp',
  typescript: 'typescript',
  c: 'c',
  html: 'html',
  php: 'php',
};

const STARTER_SNIPPETS = {
  javascript: '// JavaScript in CodeO\nconsole.log("Hello from CodeO!");\n',
  python: '# Python in CodeO\nprint("Hello from CodeO!")\n',
  cpp: '// C++ in CodeO\n#include <iostream>\n\nint main() {\n    std::cout << "Hello from CodeO!" << std::endl;\n    return 0;\n}\n',
  'c++': '// C++ in CodeO\n#include <iostream>\n\nint main() {\n    std::cout << "Hello from CodeO!" << std::endl;\n    return 0;\n}\n',
  java: '// Java in CodeO\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello from CodeO!");\n    }\n}\n',
  typescript: '// TypeScript in CodeO\nconsole.log("Hello from CodeO!");\n',
};

export function Editor({
  roomCode,
  language = 'javascript',
  readOnly = false,
  isLocked = false,
  canEdit = true,
  yjsState,
  initialCode = '',
  onMount,
  onChange,
  onCursorChange,
  onSelectionChange,
  onExplainCode,
  onAiAction,
  ping = 0,
  quality = null,
}) {
  const isEffectiveReadOnly = Boolean(readOnly || isLocked || canEdit === false);
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const containerRef = useRef(null);
  const [editorInstance, setEditorInstance] = useState(null);

  // Dynamically update Monaco readOnly state when host locks room or disables editor
  useEffect(() => {
    if (editorInstance) {
      editorInstance.updateOptions({ readOnly: isEffectiveReadOnly });
    }
  }, [editorInstance, isEffectiveReadOnly]);

  const [currentLine, setCurrentLine] = useState(1);
  const [currentCol, setCurrentCol] = useState(1);
  const [showMinimap, setShowMinimap] = useState(false);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving' | 'synced'
  const [selectedText, setSelectedText] = useState('');

  // Ref to hold current onChange to avoid tearing down yText observer on re-renders
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // User-adjustable font size, optimized for 14" laptop screens by default
  const [editorFontSize, setEditorFontSize] = useState(() => {
    try {
      const saved = localStorage.getItem('codeo_editor_font_size');
      if (saved) return Number(saved);
    } catch { }
    return typeof window !== 'undefined' && window.innerWidth < 1440 ? 13.5 : 14.5;
  });

  const changeFontSize = useCallback((delta) => {
    setEditorFontSize((prev) => {
      const next = Math.max(11, Math.min(20, Math.round((prev + delta) * 2) / 2));
      try {
        localStorage.setItem('codeo_editor_font_size', String(next));
      } catch { }
      return next;
    });
  }, []);

  // Global keyboard shortcut handler for Command Palette (F1 or Ctrl/Cmd + Shift + P)
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      const isCmdPalette =
        e.key === 'F1' ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'P' || e.key === 'p'));

      if (isCmdPalette) {
        e.preventDefault();
        e.stopPropagation();
        if (editorInstance) {
          editorInstance.focus();
          editorInstance.trigger('keyboard', 'editor.action.quickCommand');
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, [editorInstance]);

  const { doc, yText, yAwareness, status, isSynced, connectedUsers } = yjsState || {};

  // Bind Monaco to Yjs shared text using the modular useMonacoBinding hook
  const { isBound } = useMonacoBinding(editorInstance, yText, yAwareness);

  const yAwarenessRef = useRef(yAwareness);
  useEffect(() => {
    yAwarenessRef.current = yAwareness;
  }, [yAwareness]);

  // Synchronize live cursor position and typing indicator with Yjs awareness
  useEffect(() => {
    if (!editorInstance || !yAwareness) return;

    // Immediately push initial cursor position
    const pos = editorInstance.getPosition();
    if (pos) {
      setCurrentLine(pos.lineNumber);
      setCurrentCol(pos.column);
      yAwareness.setLocalStateField('cursor', {
        line: pos.lineNumber,
        column: pos.column,
        lineNumber: pos.lineNumber,
      });
    }

    const cursorSub = editorInstance.onDidChangeCursorPosition((e) => {
      const { lineNumber, column } = e.position;
      setCurrentLine(lineNumber);
      setCurrentCol(column);

      if (onCursorChange) {
        onCursorChange({ line: lineNumber, column });
      }

      yAwareness.setLocalStateField('cursor', {
        line: lineNumber,
        column: column,
        lineNumber: lineNumber,
      });
    });

    let typingTimer = null;
    const keySub = editorInstance.onKeyDown(() => {
      yAwareness.setLocalStateField('isTyping', true);
      if (typingTimer) clearTimeout(typingTimer);
      typingTimer = setTimeout(() => {
        yAwareness.setLocalStateField('isTyping', false);
      }, 1000);
    });

    return () => {
      cursorSub.dispose();
      keySub.dispose();
      if (typingTimer) clearTimeout(typingTimer);
    };
  }, [editorInstance, yAwareness, onCursorChange]);

  // Setup Monaco custom dark theme
  const handleEditorWillMount = (monaco) => {
    monaco.editor.defineTheme('codeo-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6b7280', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'fbff47', fontStyle: 'bold' },
        { token: 'string', foreground: '34d399' },
        { token: 'number', foreground: 'f59e0b' },
        { token: 'type', foreground: '60a5fa' },
        { token: 'function', foreground: '93c5fd' },
      ],
      colors: {
        'editor.background': '#070a10',
        'editorGutter.background': '#070a10',
        'editorLineNumber.foreground': '#4b5563',
        'editorLineNumber.activeForeground': '#fbff47',
        'editorCursor.foreground': '#fbff47',
        'editor.selectionBackground': '#2563eb40',
        'editor.inactiveSelectionBackground': '#2563eb20',
        'editor.lineHighlightBackground': '#ffffff08',
        'scrollbarSlider.background': '#ffffff15',
        'scrollbarSlider.hoverBackground': '#ffffff25',
        'scrollbarSlider.activeBackground': '#ffffff35',
        'quickInput.background': '#0c111d',
        'quickInput.foreground': '#f3f4f6',
        'quickInputTitle.background': '#080c14',
        'quickInputList.focusBackground': '#1e293b',
        'quickInputList.focusForeground': '#fbff47',
        'quickInputList.focusIconForeground': '#fbff47',
        'input.background': '#080c14',
        'input.foreground': '#ffffff',
        'input.border': '#2d3748',
        'input.placeholderForeground': '#6b7280',
        'widget.shadow': '#00000099',
      },
    });
  };

  // Bind Yjs to Monaco on Editor Mount
  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    setEditorInstance(editor);

    monaco.editor.setTheme('codeo-dark');

    // Register custom Monaco context menu actions
    // Register clean Monaco native context menu actions
    editor.addAction({
      id: 'codeo.explainWithAi',
      label: 'Explain with AI',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyE],
      contextMenuGroupId: '1_modification',
      contextMenuOrder: 1.1,
      run: (ed) => {
        const selection = ed.getSelection();
        const text = ed.getModel()?.getValueInRange(selection) || ed.getValue();
        if (onAiAction) {
          onAiAction(text, 'explain');
        } else if (onExplainCode) {
          onExplainCode(text);
        }
      },
    });

    editor.addAction({
      id: 'codeo.improveWithAi',
      label: 'Suggest Improvements',
      contextMenuGroupId: '1_modification',
      contextMenuOrder: 1.2,
      run: (ed) => {
        const selection = ed.getSelection();
        const text = ed.getModel()?.getValueInRange(selection) || ed.getValue();
        if (onAiAction) {
          onAiAction(text, 'improve');
        }
      },
    });

    editor.addAction({
      id: 'codeo.documentWithAi',
      label: 'Generate Documentation',
      contextMenuGroupId: '1_modification',
      contextMenuOrder: 1.3,
      run: (ed) => {
        const selection = ed.getSelection();
        const text = ed.getModel()?.getValueInRange(selection) || ed.getValue();
        if (onAiAction) {
          onAiAction(text, 'document');
        }
      },
    });

    editor.addAction({
      id: 'codeo.debugWithAi',
      label: 'Find Bugs & Edge Cases',
      contextMenuGroupId: '1_modification',
      contextMenuOrder: 1.4,
      run: (ed) => {
        const selection = ed.getSelection();
        const text = ed.getModel()?.getValueInRange(selection) || ed.getValue();
        if (onAiAction) {
          onAiAction(text, 'debug');
        }
      },
    });

    editor.addAction({
      id: 'codeo.commandPalette',
      label: 'Command Palette',
      keybindings: [
        monaco.KeyCode.F1,
        monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyP,
      ],
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.5,
      run: (ed) => {
        ed.focus();
        ed.trigger('contextMenu', 'editor.action.quickCommand');
      },
    });

    // Track local cursor position for awareness and status bar
    editor.onDidChangeCursorPosition((e) => {
      const { lineNumber, column } = e.position;
      setCurrentLine(lineNumber);
      setCurrentCol(column);

      if (onCursorChange) {
        onCursorChange({ line: lineNumber, column });
      }

      // Publish local cursor position to Yjs awareness
      if (yAwareness) {
        yAwareness.setLocalStateField('cursor', {
          line: lineNumber,
          column: column,
          lineNumber: lineNumber,
        });
      }
    });

    // Track text selection for AI explanation
    editor.onDidChangeCursorSelection((e) => {
      const model = editor.getModel();
      if (model && e.selection) {
        const text = model.getValueInRange(e.selection);
        setSelectedText(text || '');
        if (onSelectionChange) {
          onSelectionChange(text || '', e.selection);
        }
      }
    });

    // Track typing activity
    let typingTimer = null;
    editor.onKeyDown(() => {
      if (yAwareness) {
        yAwareness.setLocalStateField('isTyping', true);
        if (typingTimer) clearTimeout(typingTimer);
        typingTimer = setTimeout(() => {
          yAwareness?.setLocalStateField('isTyping', false);
        }, 1000);
      }
    });

    if (onMount) onMount(editor, monaco);
  };

  // Safely seed initial code ONLY ONCE when the room first syncs and if document is truly empty
  const hasSeededRef = useRef(false);
  useEffect(() => {
    if (!isSynced || !yText || hasSeededRef.current) return;

    if (yText.length === 0) {
      hasSeededRef.current = true;
      const langKey = (language || 'javascript').toLowerCase();
      const defaultSnippet = STARTER_SNIPPETS[langKey] || STARTER_SNIPPETS.javascript;
      const codeToLoad = initialCode || defaultSnippet;

      if (codeToLoad) {
        doc?.transact(() => {
          yText.insert(0, codeToLoad);
        }, 'initial-seed');
      }
    } else {
      hasSeededRef.current = true;
    }
  }, [isSynced, yText, doc, language, initialCode]);

  // Keep parent notified of text changes via debounced yText observer (never torn down by render loops)
  useEffect(() => {
    if (!yText) return;

    let saveTimer = null;
    const observer = () => {
      setSaveStatus('saving');
      const val = yText.toString();
      if (onChangeRef.current) {
        onChangeRef.current(val);
      }
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        setSaveStatus('saved');
      }, 600);
    };

    yText.observe(observer);
    return () => {
      if (saveTimer) clearTimeout(saveTimer);
      yText.unobserve(observer);
    };
  }, [yText]);

  // Ensure Monaco recalculates canvas dimensions whenever window is resized or container dimensions change (e.g. split screen)
  useEffect(() => {
    const handleResize = () => {
      if (editorRef.current) {
        editorRef.current.layout();
      }
    };
    window.addEventListener('resize', handleResize);

    let ro = null;
    if (containerRef.current && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        if (editorRef.current) {
          editorRef.current.layout();
        }
      });
      ro.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (ro) ro.disconnect();
    };
  }, []);

  // Monaco language identifier
  const safeLang = (typeof language === 'string' ? language : 'javascript').toLowerCase();
  const monacoLanguage = MONACO_LANGUAGE_MAP[safeLang] || 'javascript';

  // Extract remote users for dynamic cursor styling
  const remoteUsers = (connectedUsers || []).filter((u) => !u.isLocal);

  return (
    <div className="flex-1 flex flex-col h-full w-full bg-[#070a10] text-white overflow-hidden relative select-none min-w-0">
      {/* Remote Collaborator Cursors & Labels styling via modular CursorDisplay */}
      <CursorDisplay
        remoteUsers={remoteUsers}
        codeLength={yText ? yText.length : 0}
      />

      {/* Editor Top Status & Utility Bar - compact & responsive for split screens */}
      <div className="flex items-center justify-between px-2 sm:px-3 py-1.5 bg-[#090d16] border-b border-white/10 text-xs font-mono select-none text-neutral-300 shrink-0 overflow-x-auto scrollbar-none gap-2">
        <div className="flex items-center gap-2 shrink-0">
          {/* Document Sync / Save State Indicator */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] sm:text-[11px] text-neutral-300 font-sans">
            {saveStatus === 'saving' ? (
              <>
                <FontAwesomeIcon icon={faArrowsRotate} className="animate-spin text-amber-400 text-[10px]" />
                <span className="text-amber-300 font-medium">Syncing...</span>
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faCheck} className="text-emerald-400 text-[10px]" />
                <span className="text-neutral-400 font-medium">{isSynced ? 'Document Synced' : 'Ready'}</span>
              </>
            )}
          </div>
        </div>

        {/* Right Tools: Line/Col Counter, Locked status, Font adjust, Minimap toggle, Language label */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Live Line and Column Counter directly in top bar */}
          <span className="text-[10px] sm:text-[11px] text-neutral-400 font-mono hidden md:inline px-1.5 py-0.5 rounded bg-white/5 border border-white/5">
            Ln <span className="text-white font-medium">{currentLine}</span>, Col{' '}
            <span className="text-white font-medium">{currentCol}</span>
          </span>

          {isEffectiveReadOnly && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-sans flex items-center gap-1.5 ${
              !canEdit
                ? 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
                : 'bg-amber-500/15 border border-amber-500/30 text-amber-300'
            }`}>
              <FontAwesomeIcon icon={!canEdit ? faBan : faLock} className="text-[9px]" />
              <span className="hidden sm:inline">{!canEdit ? 'Read-Only' : 'Room Locked'}</span>
            </span>
          )}

          {/* Compact Font Size Controls */}
          <div className="flex items-center border rounded px-1.5 py-0.5 text-[10px] font-mono gap-1 bg-white/5 hover:bg-white/10 border-white/10 text-neutral-300">
            <button
              type="button"
              onClick={() => changeFontSize(-1)}
              title="Decrease Font Size (A-)"
              className="px-0.5 sm:px-1 font-bold cursor-pointer transition-colors hover:text-[#fbff47]"
            >
              A-
            </button>
            <span className="select-none font-sans font-semibold text-neutral-300 text-[10px] sm:text-xs">
              {editorFontSize}px
            </span>
            <button
              type="button"
              onClick={() => changeFontSize(1)}
              title="Increase Font Size (A+)"
              className="px-0.5 sm:px-1 font-bold cursor-pointer transition-colors hover:text-[#fbff47]"
            >
              A+
            </button>
          </div>

          {/* Minimap toggle button */}
          <button
            type="button"
            onClick={() => setShowMinimap((prev) => !prev)}
            title={showMinimap ? 'Hide Minimap' : 'Show Minimap'}
            className="hidden md:flex items-center gap-1 px-1.5 py-0.5 rounded border border-white/10 bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white transition-colors text-[10px] font-sans cursor-pointer"
          >
            <FontAwesomeIcon icon={showMinimap ? faEyeSlash : faEye} className="text-[9px]" />
            <span className="hidden lg:inline">Map</span>
          </button>

          {/* Command Palette button */}
          <button
            type="button"
            onClick={() => {
              if (editorInstance) {
                editorInstance.focus();
                editorInstance.trigger('toolbar', 'editor.action.quickCommand');
              }
            }}
            title="Open Command Palette (F1 / Ctrl+Shift+P)"
            className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-white/10 bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-[#fbff47] transition-colors text-[10px] font-sans cursor-pointer"
          >
            <FontAwesomeIcon icon={faTerminal} className="text-[9px]" />
            <span className="hidden sm:inline">Commands</span>
          </button>

          <span className="font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border bg-white/5 border-white/10 text-neutral-400 hidden sm:inline">
            {monacoLanguage}
          </span>
        </div>
      </div>

      {/* Read-Only Mode Banner (When user can_edit is disabled by host) */}
      {!canEdit && (
        <div className="px-3.5 py-1.5 bg-rose-950/90 border-b border-rose-500/40 text-rose-200 text-xs font-sans flex items-center justify-between gap-2 shadow-sm animate-fade-in shrink-0">
          <div className="flex items-center gap-2">
            <FontAwesomeIcon icon={faBan} className="text-rose-400 text-xs shrink-0" />
            <span className="font-bold">Read-only mode:</span>
            <span>The host has disabled editing permissions for your account.</span>
          </div>
        </div>
      )}

      {/* Room Locked Banner (When room is_locked is true and canEdit wasn't already false) */}
      {canEdit && isLocked && (
        <div className="px-3.5 py-1.5 bg-amber-950/90 border-b border-amber-500/40 text-amber-200 text-xs font-sans flex items-center justify-between gap-2 shadow-sm animate-fade-in shrink-0">
          <div className="flex items-center gap-2">
            <FontAwesomeIcon icon={faLock} className="text-amber-400 text-xs shrink-0" />
            <span className="font-bold">Room is locked:</span>
            <span>The host has set this room to read-only mode.</span>
          </div>
        </div>
      )}

      {/* Monaco Editor Container - min-w-0 and min-h-0 guarantee zero flex overflow */}
      <div ref={containerRef} className="flex-1 w-full relative min-w-0 min-h-0">
        <MonacoEditor
          height="100%"
          language={monacoLanguage}
          theme="codeo-dark"
          beforeMount={handleEditorWillMount}
          onMount={handleEditorDidMount}
          options={{
            fontSize: editorFontSize,
            fontFamily: '"Fira Code", "JetBrains Mono", Menlo, Monaco, Consolas, monospace',
            fontLigatures: true,
            tabSize: 2,
            lineNumbers: 'on',
            lineNumbersMinChars: 3,
            lineDecorationsWidth: 4,
            folding: true,
            glyphMargin: false,
            renderLineHighlight: 'all',
            minimap: { enabled: showMinimap },
            scrollBeyondLastLine: false,
            readOnly: isEffectiveReadOnly,
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            automaticLayout: true,
            wordWrap: 'on',
            padding: { top: 16, bottom: 8 },
          }}
        />
      </div>
    </div>
  );
}

export default Editor;

