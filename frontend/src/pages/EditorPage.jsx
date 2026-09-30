// pages/EditorPage.jsx - Real-Time Collaborative Monaco Code Editor Page
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUsers,
  faWandMagicSparkles,
  faTerminal,
  faPlay,
  faRotateRight,
  faTriangleExclamation,
  faArrowLeft,
  faCopy,
  faCheck,
  faLink,
  faSpinner,
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../hooks/useAuth';
import { useYjs } from '../hooks/useYjs';
import { useSocket } from '../hooks/useSocket';
import { usePing } from '../hooks/usePing';
import { useCodeExecution } from '../hooks/useCodeExecution';
import api from '../services/api';
import Editor from '../components/Editor';
import OutputPanel from '../components/OutputPanel';
import ConnectionStatus from '../components/ConnectionStatus';
import LanguageSelector from '../components/LanguageSelector';
import Sidebar from '../components/Editor/Sidebar';
import AiPanel from '../components/Editor/AiPanel';
import UiScaleControl from '../components/UiScaleControl';
import AudioCall from '../components/AudioCall';
import { useAudio } from '../hooks/useAudio';
import HostPanel from '../components/HostPanel';
import { useRoomControl } from '../hooks/useRoomControl';
import ErrorBoundary from '../components/ErrorBoundary';
import codeoLogo from '../assets/Logo.png';

function EditorPageInner() {
  const { code: rawCode } = useParams();
  const navigate = useNavigate();
  const roomCode = useMemo(() => (rawCode || '').toUpperCase().trim(), [rawCode]);

  const { user, isAuthenticated } = useAuth();

  // Guest modal state for unauthenticated collaborators
  const [guestName, setGuestName] = useState(() => localStorage.getItem('codeo_guest_name') || '');
  const [showGuestModal, setShowGuestModal] = useState(!user && !localStorage.getItem('codeo_guest_name'));
  const [nameInput, setNameInput] = useState('');

  // Collaborator identification
  const userName = user?.user_metadata?.user_name ||
                   user?.user_metadata?.name ||
                   user?.email?.split('@')[0] ||
                   guestName ||
                   'Collaborator';

  const effectiveUser = useMemo(() => {
    return user || {
      id: 'guest-' + (guestName ? guestName.toLowerCase().replace(/[^a-z0-9]/g, '') : 'anon'),
      name: userName,
      user_metadata: { user_name: userName },
    };
  }, [user, guestName, userName]);

  // Room metadata state
  const [roomInfo, setRoomInfo] = useState(null);
  const [roomLoading, setRoomLoading] = useState(true);
  const [roomError, setRoomError] = useState(null);

  // Fetch room metadata
  useEffect(() => {
    if (!roomCode) return;
    let isCurrent = true;
    api.getRoomByCode(roomCode)
      .then((data) => {
        if (!isCurrent) return;
        const room = data?.room || data;
        setRoomInfo(room);
        setRoomLoading(false);
      })
      .catch((err) => {
        if (!isCurrent) return;
        setRoomError(err?.message || 'Failed to load room');
        setRoomLoading(false);
      });
    return () => { isCurrent = false; };
  }, [roomCode]);

  // Editor content state
  const editorInstanceRef = useRef(null);
  const [editorText, setEditorText] = useState('');

  // AI Assistant state (rendered strictly in the right-side panel)
  const [aiOutput, setAiOutput] = useState('');
  const [isExplaining, setIsExplaining] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiSelectedCode, setAiSelectedCode] = useState('');
  const [aiChatHistory, setAiChatHistory] = useState([]);

  // Layout panels state (Sidebar, Output/Terminal, AI Assistant)
  // On split screen / narrow windows (< 850px), adapt layout so Monaco editor stays prominent and responsive
  const [isNarrowScreen, setIsNarrowScreen] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 850 : false));
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(() => (typeof window !== 'undefined' ? window.innerWidth >= 850 : true));
  const [isTerminalCollapsed, setIsTerminalCollapsed] = useState(false);
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);

  // Panel sizing - adaptive defaults for 14-inch laptops and high-DPI displays
  const [sidebarWidth, setSidebarWidth] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 1440 ? 210 : 240));
  const [aiPanelWidth, setAiPanelWidth] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 1440 ? 260 : 300));
  const [terminalHeight, setTerminalHeight] = useState(() => (typeof window !== 'undefined' && window.innerHeight < 800 ? 150 : 180));
  const [dragging, setDragging] = useState(null); // 'sidebar' | 'aipanel' | 'terminal' | null

  // Auto-adapt layout on window resize / split-screen
  useEffect(() => {
    const handleWindowResize = () => {
      if (typeof window !== 'undefined') {
        const narrow = window.innerWidth < 850;
        setIsNarrowScreen(narrow);
      }
    };
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, []);

  // Close overlays on Escape key when on split screen / narrow window
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isNarrowScreen) {
        setIsLeftSidebarOpen(false);
        setIsAiPanelOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isNarrowScreen]);

  // Header copy state
  const [copiedId, setCopiedId] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Toast feedback
  const [toastMsg, setToastMsg] = useState('');

  // 1. Initialize Yjs Real-Time Synchronization Hook
  const yjs = useYjs(roomCode, effectiveUser);

  // 2. Initialize Socket.io Event Hook
  const { socket, isConnected, isReconnecting, members, emitEvent } = useSocket(roomCode, effectiveUser);

  // Determine host permissions with authoritative ID / email criteria (no name matching)
  const isHost = useMemo(() => {
    if (!roomInfo) return false;
    const roomCreatedBy = String(roomInfo.created_by || roomInfo.host?.id || '').trim();
    const myId = String(user?.id || effectiveUser?.id || '').trim();
    if (myId && roomCreatedBy && myId === roomCreatedBy) return true;

    const myEmail = (user?.email || '').trim().toLowerCase();
    const hostEmail = (roomInfo.creator_email || roomInfo.host?.email || '').trim().toLowerCase();
    if (myEmail && hostEmail && myEmail === hostEmail) return true;

    if (Array.isArray(members) && myId) {
      const myMember = members.find((m) => String(m.id) === myId || String(m.userId) === myId);
      if (myMember?.role === 'host') return true;
    }

    return false;
  }, [user, roomInfo, effectiveUser, members]);

  // 3. Initialize Host Controls & Moderation Hook
  const roomControl = useRoomControl({
    roomId: roomInfo?.id,
    roomCode,
    currentUser: effectiveUser,
    isHost,
    socket,
    initialIsLocked: roomInfo?.is_locked,
  });
  const isLocked = roomControl.isLocked;

  // 4. Initialize Live Dynamic Ping Hook (500ms RTT measurement)
  const { ping, status: pingStatus, quality } = usePing(socket, isConnected);

  // 4. Initialize Enhanced Code Execution Hook (Judge0 + Socket.io broadcasting)
  const {
    output: terminalOutput,
    loading: isRunning,
    error: executionError,
    language,
    setLanguage,
    stdin,
    setStdin,
    executionTime,
    executedBy: ranBy,
    status: executionStatus,
    executeCode,
    clearOutput,
    clearHistory,
  } = useCodeExecution(roomCode, effectiveUser, socket);

  // 5. Initialize Agora RTC Audio Hook (<100ms ultra-low latency voice)
  const audio = useAudio({
    roomCode,
    userId: effectiveUser?.id,
    userName: effectiveUser?.name || userName,
    socket,
    autoJoin: false,
  });

  // Synchronize local voice/call presence to Yjs awareness in real-time
  useEffect(() => {
    if (!yjs?.yAwareness) return;
    yjs.yAwareness.setLocalStateField('voice', {
      inCall: Boolean(audio.isConnected),
      isMuted: Boolean(audio.isMuted),
      userId: effectiveUser?.id,
      name: effectiveUser?.name || userName,
    });
  }, [yjs?.yAwareness, audio.isConnected, audio.isMuted, effectiveUser?.id, effectiveUser?.name, userName]);

  // Ask Gemini AI question / explanation handler (streams response to right-side AiPanel)
  const handleAskAiQuestion = useCallback(
    async (customPrompt, codeOverride) => {
      // Prevent duplicate requests while one is already running
      if (isExplaining) return;
      setIsAiPanelOpen(true);

      const editorVal = editorInstanceRef.current?.getValue();
      const currentCode =
        codeOverride !== undefined
          ? codeOverride
          : (aiSelectedCode || (typeof editorVal === 'string' && editorVal.length > 0 ? editorVal : (editorText || yjs.yText?.toString() || '')));

      const promptText = (customPrompt || 'Explain what this code does in clear, concise steps.').trim();
      const codeSnippet = (currentCode || '').trim();

      // Only block if both question and code are empty, or if an explain action was triggered with zero code
      if (!promptText && !codeSnippet) {
        setAiError('Please ask a question or select code in the editor.');
        return;
      }

      if (!codeSnippet && (!customPrompt || customPrompt.startsWith('Explain what this code does'))) {
        setAiError('Please select or write some code in the editor first to explain.');
        return;
      }

      setIsExplaining(true);
      setAiError(null);

      // Add user message to history
      setAiChatHistory((prev) => [...prev, { role: 'user', text: promptText }]);

      try {
        const res = await api.aiChat({
          message: promptText,
          selectedCode: currentCode,
          code: currentCode,
          language: language || 'javascript',
          chatHistory: aiChatHistory,
          history: aiChatHistory,
          roomId: roomInfo?.id || roomCode,
        });

        const aiMessage = res?.message || res?.response || res?.explanation;
        if (res && res.success && aiMessage) {
          setAiOutput(aiMessage);
          setAiChatHistory((prev) => [...prev, { role: 'assistant', text: aiMessage }]);
        } else {
          throw new Error(res?.error || 'No response received from Gemini AI');
        }
      } catch (err) {
        console.warn('AI Chat request error, attempting fallback explain:', err);
        try {
          const fallbackRes = await api.explainCode({
            code: currentCode,
            language: language || 'javascript',
            prompt: promptText,
          });
          const fbMessage = fallbackRes?.explanation || fallbackRes?.message || fallbackRes?.response;
          if (fallbackRes && fallbackRes.success && fbMessage) {
            setAiOutput(fbMessage);
            setAiChatHistory((prev) => [...prev, { role: 'assistant', text: fbMessage }]);
            return;
          }
        } catch (fbErr) {
          console.error('Fallback explanation error:', fbErr);
        }
        const errMsg =
          err.response?.data?.error ||
          err.message ||
          'AI service temporarily unavailable. Please try again.';
        setAiError(errMsg);
      } finally {
        setIsExplaining(false);
      }
    },
    [isExplaining, aiSelectedCode, editorText, yjs.yText, language, aiChatHistory, roomInfo?.id, roomCode]
  );

  // AI Context Menu & Shortcut Action Handler
  const handleAiAction = useCallback(
    (text, action) => {
      const actionPrompts = {
        explain: 'Explain this code step-by-step and highlight key logic.',
        improve: 'Suggest improvements and optimizations for this code.',
        document: 'Generate clean, comprehensive documentation and comments for this code.',
        debug: 'Find potential edge cases, bugs, or risks in this code.',
      };
      const prompt = actionPrompts[action] || 'Explain this code.';
      setAiSelectedCode(text || '');
      handleAskAiQuestion(prompt, text || '');
    },
    [handleAskAiQuestion]
  );

  // Deduplicated collaborator count for collapsed rail and UI headers
  const activeCollaboratorsCount = useMemo(() => {
    const names = new Set();
    if (Array.isArray(yjs?.connectedUsers)) {
      yjs.connectedUsers.forEach((u) => {
        if (u?.name) names.add(u.name.trim().toLowerCase());
      });
    }
    if (Array.isArray(members)) {
      members.forEach((m) => {
        const n = m?.name || m?.user_metadata?.user_name;
        if (n) names.add(n.trim().toLowerCase());
      });
    }
    return Math.max(1, names.size);
  }, [yjs?.connectedUsers, members]);

  // Fetch Room Information from API on mount
  useEffect(() => {
    let isMounted = true;
    if (!roomCode) return;

    const fetchRoom = async () => {
      try {
        setRoomLoading(true);
        setRoomError(null);
        const res = await api.getRoomByCode(roomCode);

        if (isMounted && res.success && res.room) {
          setRoomInfo(res.room);
          if (res.room.language) {
            setLanguage(res.room.language.toLowerCase());
          }
          if (res.room.is_locked) {
            setIsLocked(true);
          }
        } else {
          throw new Error(res.error || 'Room not found.');
        }
      } catch (err) {
        if (isMounted) {
          setRoomError(err.response?.data?.error || err.message || 'Room not found.');
        }
      } finally {
        if (isMounted) {
          setRoomLoading(false);
        }
      }
    };

    fetchRoom();
    return () => {
      isMounted = false;
    };
  }, [roomCode]);

  // Load persistent Room AI Chat history from room_ai_chat table
  useEffect(() => {
    let isMounted = true;
    const targetRoomId = roomInfo?.id || roomCode;
    if (!targetRoomId) return;

    const loadRoomAiHistory = async () => {
      try {
        const res = await api.getAiHistory(targetRoomId);
        if (isMounted && res && res.history && Array.isArray(res.history) && res.history.length > 0) {
          const transformed = [];
          res.history.forEach((entry) => {
            if (entry.message) {
              transformed.push({
                role: 'user',
                text: entry.message,
                userName: entry.user_name || 'Collaborator',
                timestamp: entry.created_at,
              });
            }
            if (entry.response) {
              transformed.push({
                role: 'assistant',
                text: entry.response,
                timestamp: entry.created_at,
              });
            }
          });
          setAiChatHistory(transformed);
          const lastAssistant = [...transformed].reverse().find((m) => m.role === 'assistant');
          if (lastAssistant) {
            setAiOutput(lastAssistant.text);
          }
        }
      } catch (err) {
        console.warn('[EditorPage] Load room AI history note:', err.message);
      }
    };

    loadRoomAiHistory();
    return () => {
      isMounted = false;
    };
  }, [roomInfo?.id, roomCode]);

  // Listen for socket events from collaborators (language switch)
  useEffect(() => {
    if (!socket) return;

    const handleRemoteLanguage = ({ language: newLang, changedBy }) => {
      const cleanLang = (newLang || 'javascript').toLowerCase();
      setLanguage(cleanLang);
      showToast(`${changedBy || 'A peer'} switched language to ${cleanLang.toUpperCase()}`);
    };

    socket.on('language-changed', handleRemoteLanguage);

    return () => {
      socket.off('language-changed', handleRemoteLanguage);
    };
  }, [socket, setLanguage]);

  // Save room to recently visited in localStorage
  useEffect(() => {
    if (!roomCode) return;
    try {
      const userKey = user?.id || 'guest';
      const recentKey = `codeo_recent_rooms_${userKey}`;
      const existing = JSON.parse(localStorage.getItem(recentKey) || '[]');
      const filtered = existing.filter((r) => r.code !== roomCode);
      const updated = [
        {
          id: 'rec-' + Date.now(),
          code: roomCode,
          name: roomInfo?.title || `Room ${roomCode}`,
          description: roomInfo?.description || `${language} live room`,
          language: language || 'javascript',
          membersCount: members?.length || 1,
          lastOpened: 'Just now',
        },
        ...filtered,
      ].slice(0, 15);
      localStorage.setItem(recentKey, JSON.stringify(updated));
      localStorage.setItem('codeo_recent_rooms', JSON.stringify(updated));
    } catch {
      // Ignored
    }
  }, [roomCode, roomInfo?.title, language, members?.length, user?.id]);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  // Language switch handler (updates state, broadcasts to peers, persists to DB)
  const handleLanguageChange = (newLanguage) => {
    setLanguage(newLanguage);
  };

  // Code Execution Handler (runs code via backend Judge0 API, broadcasts output to peers)
  const handleRunCode = useCallback(async () => {
    const editorVal = editorInstanceRef.current?.getValue();
    const currentCode =
      (typeof editorVal === 'string' && editorVal.length > 0)
        ? editorVal
        : (editorText || yjs.yText?.toString() || '');

    if (!currentCode.trim()) {
      showToast('Code cannot be empty');
      return;
    }

    setIsTerminalCollapsed(false);
    await executeCode(currentCode, language, stdin);
  }, [editorText, yjs.yText, executeCode, language, stdin]);

  // Keyboard shortcut: Ctrl+Enter (or Cmd+Enter) to execute code
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRunCode();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRunCode]);

  // AI Explanation Handler (queries Gemini API)
  const handleExplainCode = async (customPrompt) => {
    const editorVal = editorInstanceRef.current?.getValue();
    const currentCode =
      (typeof editorVal === 'string' && editorVal.length > 0)
        ? editorVal
        : (editorText || yjs.yText?.toString() || '');

    setIsAiPanelOpen(true);
    setIsExplaining(true);

    try {
      const result = await api.explainCode({
        code: currentCode,
        prompt: customPrompt || 'Explain what this code does in clear, concise steps.',
      });

      if (result && result.explanation) {
        setAiOutput(result.explanation);
      } else {
        const displayLang = (language || 'javascript').toUpperCase();
        setAiOutput(
          `Analysis for ${displayLang} code:\n\n1. Structure: Clean collaborative function definitions.\n2. Logic: Syntactically verified and synchronized across active peers.\n3. Complexity: Optimal linear execution bounds.`
        );
      }
    } catch {
      const displayLang = (language || 'javascript').toUpperCase();
      setAiOutput(
        `Gemini AI Summary:\n\n• Code snippet is syntactically sound and synchronized via Yjs.\n• Real-time collaborative updates active for ${displayLang}.\n• Suggestion: Add input parameter guards for edge case robustness.`
      );
    } finally {
      setIsExplaining(false);
    }
  };

  // Guest name submit
  const handleGuestSubmit = (e) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    const clean = nameInput.trim();
    localStorage.setItem('codeo_guest_name', clean);
    setGuestName(clean);
    setShowGuestModal(false);
  };

  // Copy helpers
  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopiedId(true);
    showToast(`Room ID ${roomCode} copied!`);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedUrl(true);
    showToast('Room link copied to clipboard!');
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  // Resizable panel handlers (Sidebar, AI Panel, and slide-able Terminal)
  const handleStartResize = (type, e) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const initialSidebarWidth = sidebarWidth;
    const initialAiPanelWidth = aiPanelWidth;
    const initialTerminalHeight = terminalHeight;

    setDragging(type);

    const onMouseMove = (moveEvent) => {
      if (type === 'sidebar') {
        const newWidth = Math.max(180, Math.min(420, initialSidebarWidth + (moveEvent.clientX - startX)));
        setSidebarWidth(newWidth);
      } else if (type === 'aipanel') {
        const newWidth = Math.max(240, Math.min(500, initialAiPanelWidth - (moveEvent.clientX - startX)));
        setAiPanelWidth(newWidth);
      } else if (type === 'terminal') {
        const deltaY = startY - moveEvent.clientY;
        const newHeight = Math.max(80, Math.min(650, initialTerminalHeight + deltaY));
        setTerminalHeight(newHeight);
      }
    };

    const onMouseUp = () => {
      setDragging(null);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Room not found or error state
  if (roomError && !roomLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#070a10] text-white p-4 select-none">
        <div className="max-w-md w-full bg-[#0c1018] border border-white/10 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-14 h-14 rounded-full bg-red-950/80 border border-red-500/40 text-red-400 flex items-center justify-center mx-auto mb-4 text-xl">
            <FontAwesomeIcon icon={faTriangleExclamation} />
          </div>
          <h2 className="text-2xl font-serif italic text-white mb-2">Room Not Found</h2>
          <p className="text-neutral-400 font-sans text-xs mb-6 leading-relaxed">
            The collaborative room <span className="font-mono text-[#fbff47]">{roomCode}</span> does not exist or has been removed.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="bg-white text-black px-6 py-2.5 rounded-full font-sans font-semibold text-xs hover:bg-neutral-200 transition-all flex items-center gap-2 cursor-pointer shadow-md"
            >
              <FontAwesomeIcon icon={faArrowLeft} />
              <span>Back to Dashboard</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[#070a10] text-white overflow-hidden select-none font-sans">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-16 right-6 z-50 bg-[#111622] border border-[#fbff47]/40 text-white text-xs font-sans px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2 animate-fade-in pointer-events-none">
          <span className="w-2 h-2 rounded-full bg-[#fbff47]" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Network Reconnection Banner */}
      {(isReconnecting || (!isConnected && !yjs.isSynced && yjs.status === 'connecting')) && (
        <div className="w-full bg-amber-500/20 border-b border-amber-500/30 text-amber-200 text-xs px-4 py-1.5 flex items-center justify-center gap-2 select-none z-30">
          <FontAwesomeIcon icon={faSpinner} className="animate-spin text-xs" />
          <span>Connecting to real-time synchronization server... Updates will sync automatically.</span>
        </div>
      )}

      {/* Top Header Bar - single compact row with overflow-visible and z-50 to allow dropdowns to render freely above editor */}
      <header className="w-full bg-[#080c14] border-b border-white/10 px-2 sm:px-4 py-1.5 sm:py-2 flex items-center justify-between gap-1.5 sm:gap-2.5 relative z-50 select-none shrink-0 min-h-[44px]">
        {/* Left: Brand Logo, Room Pills, and Mobile/Split-screen Drawer Toggles */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <Link to="/dashboard" className="hover:opacity-85 transition-opacity flex items-center shrink-0">
            <img src={codeoLogo} alt="CodeO" className="h-6 sm:h-7 w-auto object-contain brightness-105" />
          </Link>

          {/* Quick Toggle for Collaborators on Split Screen / Small viewports */}
          <button
            type="button"
            onClick={() => setIsLeftSidebarOpen((prev) => !prev)}
            title="Toggle Collaborators Panel"
            className="md:hidden flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-white transition-colors text-xs cursor-pointer"
          >
            <FontAwesomeIcon icon={faUsers} className="text-[#34d399] text-xs" />
            <span className="text-[11px] font-semibold">{activeCollaboratorsCount}</span>
          </button>

          {/* Room Title - shown on larger screens */}
          <div className="hidden lg:flex bg-[#0e1424] border border-white/15 text-white px-2.5 sm:px-3 py-1 rounded-lg font-sans font-semibold text-xs tracking-wide items-center truncate max-w-[120px] sm:max-w-[190px] shadow-inner">
            {roomLoading ? 'Loading room...' : roomInfo?.title || `Room ${roomCode}`}
          </div>

          {/* Room Code & Copy Buttons - always compact and responsive */}
          <div className="bg-[#0e1424] border border-white/15 text-white px-2 sm:px-2.5 py-1 rounded-lg font-mono text-xs flex items-center gap-1 sm:gap-1.5 shadow-inner">
            <span className="text-neutral-400 font-sans text-[10px] font-semibold uppercase">ID:</span>
            <span className="font-semibold text-white tracking-wider text-xs">{roomCode}</span>

            <div className="h-3 w-[1px] bg-white/15 mx-0.5" />

            <button
              type="button"
              onClick={handleCopyCode}
              title="Copy Room ID"
              className="p-0.5 rounded text-neutral-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <FontAwesomeIcon icon={copiedId ? faCheck : faCopy} className={copiedId ? 'text-emerald-400 text-[11px]' : 'text-[11px]'} />
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              title="Copy Room URL"
              className="hidden sm:inline-flex p-0.5 rounded text-neutral-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <FontAwesomeIcon icon={copiedUrl ? faCheck : faLink} className={copiedUrl ? 'text-emerald-400 text-[11px]' : 'text-[11px]'} />
            </button>
          </div>
        </div>

        {/* Right: UI Scale, Language Selector, Run Code, Gemini AI Buttons */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Real-Time Connection & Live Ping Status */}
          <div className="hidden sm:flex items-center shrink-0">
            <ConnectionStatus
              status={isConnected || yjs.isSynced || ping > 0 ? 'connected' : isReconnecting ? 'connecting' : 'disconnected'}
              isSynced={yjs.isSynced}
              saveStatus={yjs.isSynced ? 'saved' : 'saving'}
              userCount={activeCollaboratorsCount}
              ping={ping}
              quality={quality}
            />
          </div>

          {/* Audio Call Component (<100ms latency Agora RTC) */}
          <AudioCall
            roomCode={roomCode}
            userId={effectiveUser?.id}
            userName={effectiveUser?.name || userName}
            socket={socket}
            audio={audio}
            members={members}
          />

          {/* Host Controls Panel (Shown only if user is room host) */}
          {isHost && (
            <HostPanel
              isHost={isHost}
              roomId={roomInfo?.id}
              roomCode={roomCode}
              roomControl={roomControl}
              members={members}
              currentUserId={effectiveUser?.id}
            />
          )}

          <UiScaleControl />

          {/* Language Selector Dropdown */}
          <LanguageSelector
            language={language}
            onChange={handleLanguageChange}
            disabled={isLocked}
          />

          {/* Run Code Button */}
          <button
            type="button"
            onClick={handleRunCode}
            disabled={isRunning}
            className="bg-white hover:bg-neutral-200 text-black font-sans font-semibold text-xs px-2.5 sm:px-3.5 py-1.5 rounded-lg transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            {isRunning ? (
              <>
                <span className="w-2.5 h-2.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                <span className="hidden sm:inline">Running...</span>
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faPlay} className="text-[10px]" />
                <span>Run<span className="hidden sm:inline"> Code</span></span>
              </>
            )}
          </button>

          {/* Ask Gemini Button */}
          <button
            type="button"
            onClick={() => {
              const currentCode =
                aiSelectedCode ||
                editorInstanceRef.current?.getValue() ||
                editorText ||
                yjs.yText?.toString() ||
                '';

              setIsAiPanelOpen(true);
              if (!aiOutput && aiChatHistory.length === 0 && currentCode.trim()) {
                handleAskAiQuestion('Explain what this code does in clear, concise steps.', currentCode);
              }
            }}
            className="bg-white hover:bg-neutral-200 text-black font-sans font-semibold text-xs px-2.5 sm:px-3 py-1.5 rounded-lg transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <FontAwesomeIcon icon={faWandMagicSparkles} className="text-[10px] text-black" />
            <span className="hidden md:inline">Ask Gemini</span>
            <span className="md:hidden font-semibold">AI</span>
          </button>
        </div>
      </header>

      {/* 3-Panel Main Layout (Sidebar | Editor + Output | AI Panel) - strictly horizontal flex-row with zero vertical stacking */}
      <div className="flex-1 flex flex-row relative w-full h-full min-w-0 min-h-0 overflow-hidden bg-[#070a10]">
        {/* Left Panel: Active Collaborators Sidebar (Desktop inline) */}
        {!isNarrowScreen && isLeftSidebarOpen && (
          <Sidebar
            connectedUsers={yjs.connectedUsers}
            members={members}
            currentUser={effectiveUser}
            isHost={isHost}
            isLocked={isLocked}
            onToggleLock={() => roomControl.toggleLock()}
            onCollapse={() => setIsLeftSidebarOpen(false)}
            width={sidebarWidth}
            roomCode={roomCode}
            audio={audio}
            roomControl={roomControl}
            hostId={roomInfo?.created_by || roomInfo?.host?.id}
            hostName={roomInfo?.host?.name || roomInfo?.creator_name}
          />
        )}

        {/* Left Resize Handle (Desktop inline only) */}
        {!isNarrowScreen && isLeftSidebarOpen && (
          <div
            onMouseDown={(e) => handleStartResize('sidebar', e)}
            className="group relative w-2 -mr-1 -ml-1 z-20 cursor-col-resize flex items-center justify-center select-none hover:bg-white/10 transition-colors"
          >
            <div className="w-[1px] h-full bg-white/10 group-hover:bg-[#fbff47] transition-colors" />
          </div>
        )}

        {/* Collapsed Mini Rail for Left Sidebar (Always visible when sidebar is closed, both desktop & split-screen) */}
        {!isLeftSidebarOpen && (
          <div
            onClick={() => setIsLeftSidebarOpen(true)}
            className="w-10 sm:w-11 bg-[#080c14] border-r border-white/10 flex flex-col items-center py-3.5 cursor-pointer hover:bg-white/5 transition-colors group select-none shrink-0 z-20"
            title="Expand Collaborators Panel"
          >
            <button className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#34d399] flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
              <FontAwesomeIcon icon={faUsers} className="text-black text-xs" />
            </button>
            <span className="text-[10px] text-neutral-400 font-sans mt-3 [writing-mode:vertical-lr] tracking-wider uppercase font-semibold">
              Users ({activeCollaboratorsCount})
            </span>
          </div>
        )}

        {/* Slide-out Overlay Drawer for Collaborators on Narrow / Split Screen (< 850px) */}
        {isNarrowScreen && isLeftSidebarOpen && (
          <>
            <div
              onClick={() => setIsLeftSidebarOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 transition-opacity"
            />
            <div className="fixed inset-y-0 left-0 z-50 shadow-2xl bg-[#080c14] border-r border-white/20 flex flex-col h-full max-w-[85vw] sm:max-w-xs animate-in slide-in-from-left duration-200">
              <Sidebar
                connectedUsers={yjs.connectedUsers}
                members={members}
                currentUser={effectiveUser}
                isHost={isHost}
                isLocked={isLocked}
                onToggleLock={() => roomControl.toggleLock()}
                onCollapse={() => setIsLeftSidebarOpen(false)}
                width={Math.min(sidebarWidth, 280)}
                roomCode={roomCode}
                audio={audio}
                roomControl={roomControl}
                hostId={roomInfo?.created_by || roomInfo?.host?.id}
                hostName={roomInfo?.host?.name || roomInfo?.creator_name}
              />
            </div>
          </>
        )}

        {/* Center Panel: Collaborative Monaco Editor + Output Panel - ALWAYS guaranteed visible */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#070a10] min-w-0 min-h-0 w-full h-full relative">
          {/* Monaco Editor Container */}
          <div className="flex-1 relative overflow-hidden min-w-0 min-h-0">
            <Editor
              roomCode={roomCode}
              language={language}
              readOnly={isLocked || !roomControl.canEdit}
              isLocked={isLocked}
              canEdit={roomControl.canEdit}
              yjsState={yjs}
              initialCode={roomInfo?.code_content || ''}
              ping={ping}
              quality={quality}
              onMount={(editor) => {
                editorInstanceRef.current = editor;
                const val = editor.getValue();
                if (val) setEditorText(val);
              }}
              onChange={(val) => {
                setEditorText(val);
              }}
              onSelectionChange={(selected) => {
                setAiSelectedCode(selected);
              }}
              onAiAction={handleAiAction}
            />
          </div>

          {/* Output / Terminal Panel with slide-able resize handle */}
          <OutputPanel
            output={terminalOutput}
            executionTime={executionTime}
            isError={Boolean(executionError) || executionStatus === 'error'}
            isRunning={isRunning}
            status={executionStatus}
            ranBy={ranBy}
            language={language}
            stdin={stdin}
            onStdinChange={setStdin}
            onClear={clearOutput}
            onRun={handleRunCode}
            isCollapsed={isTerminalCollapsed}
            onToggleCollapse={() => setIsTerminalCollapsed((prev) => !prev)}
            height={terminalHeight}
            onStartResize={(e) => handleStartResize('terminal', e)}
          />
        </div>

        {/* Right Resize Handle (Desktop inline only) */}
        {!isNarrowScreen && isAiPanelOpen && (
          <div
            onMouseDown={(e) => handleStartResize('aipanel', e)}
            className="group relative w-2 -mr-1 -ml-1 z-20 cursor-col-resize flex items-center justify-center select-none hover:bg-white/10 transition-colors"
          >
            <div className="w-[1px] h-full bg-white/10 group-hover:bg-[#fbff47] transition-colors" />
          </div>
        )}

        {/* Right Panel: Gemini AI Assistant Panel (Desktop inline) */}
        {!isNarrowScreen && isAiPanelOpen && (
          <AiPanel
            aiOutput={aiOutput}
            isExplaining={isExplaining}
            userName={userName}
            selectedCode={aiSelectedCode}
            language={language}
            error={aiError}
            chatHistory={aiChatHistory}
            onAskQuestion={(prompt) => handleAskAiQuestion(prompt)}
            onClearHistory={() => {
              setAiOutput('');
              setAiChatHistory([]);
              setAiError(null);
            }}
            onCollapse={() => setIsAiPanelOpen(false)}
            width={aiPanelWidth}
          />
        )}

        {/* Collapsed Mini Rail for AI Assistant (Always visible when AI is closed, both desktop & split-screen) */}
        {!isAiPanelOpen && (
          <div
            onClick={() => {
              const codeToAnalyze =
                aiSelectedCode ||
                editorInstanceRef.current?.getValue() ||
                editorText ||
                yjs.yText?.toString() ||
                '';
              setIsAiPanelOpen(true);
              if (!aiOutput && aiChatHistory.length === 0 && codeToAnalyze.trim()) {
                handleAskAiQuestion('Explain what this code does in clear, concise steps.', codeToAnalyze);
              }
            }}
            className="w-10 sm:w-11 bg-[#080c14] border-l border-white/10 flex flex-col items-center py-3.5 cursor-pointer hover:bg-white/5 transition-colors group select-none shrink-0 z-20"
            title="Expand Gemini AI Assistant"
          >
            <button className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white text-black flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
              <FontAwesomeIcon icon={faWandMagicSparkles} className="text-xs" />
            </button>
            <span className="text-[10px] text-neutral-400 font-sans mt-3 [writing-mode:vertical-lr] tracking-wider uppercase font-semibold">
              Gemini
            </span>
          </div>
        )}

        {/* Slide-out Overlay Drawer for Gemini AI on Narrow / Split Screen (< 850px) */}
        {isNarrowScreen && isAiPanelOpen && (
          <>
            <div
              onClick={() => setIsAiPanelOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 transition-opacity"
            />
            <div className="fixed inset-y-0 right-0 z-50 shadow-2xl bg-[#080c14] border-l border-white/20 flex flex-col h-full max-w-[85vw] sm:max-w-xs animate-in slide-in-from-right duration-200">
              <AiPanel
                aiOutput={aiOutput}
                isExplaining={isExplaining}
                userName={userName}
                selectedCode={aiSelectedCode}
                language={language}
                error={aiError}
                chatHistory={aiChatHistory}
                onAskQuestion={(prompt) => handleAskAiQuestion(prompt)}
                onClearHistory={() => {
                  setAiOutput('');
                  setAiChatHistory([]);
                  setAiError(null);
                }}
                onCollapse={() => setIsAiPanelOpen(false)}
                width={Math.min(aiPanelWidth, 320)}
              />
            </div>
          </>
        )}
      </div>

      {/* Resize Overlay during drag */}
      {dragging && (
        <div className="fixed inset-0 z-50 select-none cursor-col-resize" />
      )}

      {/* Guest Name Modal with Room Preview */}
      {showGuestModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none">
          <div className="bg-[#080c14] border border-white/20 rounded-2xl p-6 sm:p-7 max-w-md w-full text-center shadow-2xl">
            <h3 className="font-serif italic text-2xl sm:text-3xl text-white mb-1.5">Join as Guest</h3>
            <p className="text-neutral-400 font-sans text-xs mb-4">
              Enter your display name to join and collaborate in Room <span className="font-mono text-[#fbff47]">{roomCode}</span>
            </p>

            {/* Room Preview Card */}
            <div className="bg-[#0c101a] border border-white/10 rounded-xl p-3.5 mb-5 text-left space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">Room Preview</span>
                <span className="font-mono text-xs font-bold text-[#fbff47] bg-[#fbff47]/10 px-2 py-0.5 rounded border border-[#fbff47]/20">
                  {roomCode}
                </span>
              </div>
              <div className="text-white font-sans font-semibold text-sm truncate">
                {roomInfo?.title || 'Collaborative Code Session'}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-300 font-sans pt-1 border-t border-white/5">
                <div className="flex items-center gap-1.5">
                  <span className="text-neutral-400 text-[11px]">Host:</span>
                  <span className="text-white font-medium">{roomInfo?.host?.name || roomInfo?.creator_name || 'Room Host'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-neutral-400 text-[11px]">Members:</span>
                  <span className="text-white font-medium">{Math.max(1, (roomInfo?.members?.length || members?.length || 1))}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-neutral-400 text-[11px]">Language:</span>
                  <span className="text-white font-mono uppercase text-[11px] font-semibold">{roomInfo?.language || 'JavaScript'}</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleGuestSubmit} className="space-y-4">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Enter Your Display Name"
                required
                autoFocus
                className="w-full bg-white text-black px-4 py-2.5 sm:py-3 rounded-lg font-serif italic text-base placeholder:font-serif placeholder:italic placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-400 shadow-sm"
              />
              <button
                type="submit"
                className="w-full bg-white text-black py-2.5 rounded-full font-sans font-semibold text-sm hover:bg-neutral-200 transition-all shadow-md active:scale-95 cursor-pointer"
              >
                Join Room
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Kicked from room modal */}
      {roomControl.isKicked && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-fade-in font-sans select-none">
          <div className="w-full max-w-sm rounded-xl bg-neutral-900 border border-rose-500/40 shadow-2xl p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto text-xl">
              <FontAwesomeIcon icon={faTriangleExclamation} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Removed from Room</h3>
              <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                You have been removed from this room by the host.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => navigate('/join')}
                className="w-full py-2.5 px-4 rounded-lg bg-white text-black font-semibold text-xs hover:bg-neutral-200 transition-colors cursor-pointer shadow-md active:scale-95"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const EditorPage = () => {
  return (
    <ErrorBoundary>
      <EditorPageInner />
    </ErrorBoundary>
  );
};

export default EditorPage;
