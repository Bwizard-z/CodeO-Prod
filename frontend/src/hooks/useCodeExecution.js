// hooks/useCodeExecution.js - Real-Time Code Execution Hook with Judge0 & Socket.io Broadcasting
import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';

export const SUPPORTED_LANGUAGES = [
  { id: 63, name: 'JavaScript', key: 'javascript', ext: '.js', icon: 'js' },
  { id: 71, name: 'Python', key: 'python', ext: '.py', icon: 'py' },
  { id: 62, name: 'Java', key: 'java', ext: '.java', icon: 'java' },
  { id: 54, name: 'C++', key: 'cpp', ext: '.cpp', icon: 'cpp' },
];

const MAX_CODE_BYTES = 100 * 1024; // 100KB

/**
 * useCodeExecution
 * Manages Judge0 code execution, stdin input, error handling, execution history,
 * and real-time Socket.io output synchronization for all peers in a collaborative room.
 *
 * @param {string} roomCode - Current active room code
 * @param {object} user - Current user object
 * @param {import('socket.io-client').Socket|null} socket - Socket.io client instance
 */
export function useCodeExecution(roomCode, user = null, socket = null) {
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [language, setLanguageState] = useState(() => {
    try {
      return localStorage.getItem('codeo_preferred_language') || 'javascript';
    } catch {
      return 'javascript';
    }
  });
  const [stdin, setStdin] = useState('');
  const [executionTime, setExecutionTime] = useState(null);
  const [executedBy, setExecutedBy] = useState(null);
  const [status, setStatus] = useState('idle'); // 'idle' | 'running' | 'success' | 'error' | 'timeout'
  const [history, setHistory] = useState([]);

  const isExecutingRef = useRef(false);

  const userName =
    user?.user_metadata?.user_name ||
    user?.user_metadata?.name ||
    user?.name ||
    user?.email?.split('@')[0] ||
    localStorage.getItem('codeo_guest_name') ||
    'Collaborator';

  // 1. Listen for real-time execution results broadcasted by other room members
  useEffect(() => {
    if (!socket) return;

    const handleRemoteResult = (data) => {
      if (!data) return;

      const remoteOutput = data.output || (data.error ? data.error_message || 'Execution Error' : '');
      setOutput(remoteOutput);
      setExecutionTime(data.executionTime || data.execution_time_ms || null);
      setExecutedBy(data.userName || data.ranBy || 'A collaborator');
      setStatus(data.error || data.status === 'error' ? 'error' : 'success');
      setError(data.error ? remoteOutput : null);

      if (data.language) {
        setLanguageState(data.language.toLowerCase());
      }

      // Append to local history list (up to 100 items)
      setHistory((prev) => [
        {
          id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          output: remoteOutput,
          language: data.language || language,
          executionTime: data.executionTime || null,
          status: data.error ? 'error' : 'success',
          executedBy: data.userName || data.ranBy || 'Collaborator',
          timestamp: data.timestamp || new Date().toISOString(),
        },
        ...prev.slice(0, 99),
      ]);
    };

    socket.on('code-result', handleRemoteResult);
    socket.on('code-output', handleRemoteResult);

    return () => {
      socket.off('code-result', handleRemoteResult);
      socket.off('code-output', handleRemoteResult);
    };
  }, [socket, language]);

  // 2. Set Language with LocalStorage & Socket sync
  const setLanguage = useCallback((newLang) => {
    if (!newLang) return;
    const clean = newLang.toLowerCase().trim();
    setLanguageState(clean);
    try {
      localStorage.setItem('codeo_preferred_language', clean);
    } catch {}

    if (socket && roomCode) {
      socket.emit('language-change', {
        roomCode,
        language: clean,
      });
    }
  }, [socket, roomCode]);

  // 3. Clear output & stats
  const clearOutput = useCallback(() => {
    setOutput('');
    setError(null);
    setExecutionTime(null);
    setExecutedBy(null);
    setStatus('idle');
  }, []);

  // 4. Clear all history and reset panel
  const clearHistory = useCallback(() => {
    clearOutput();
    setStdin('');
    setHistory([]);
  }, [clearOutput]);

  // 5. Fetch Execution Languages
  const getLanguages = useCallback(async () => {
    try {
      const res = await api.getExecutionLanguages();
      if (res?.supported) {
        return res.supported;
      }
    } catch (err) {
      console.warn('[useCodeExecution] Error fetching languages:', err.message);
    }
    return SUPPORTED_LANGUAGES;
  }, []);

  // 6. Fetch Room Execution History from backend
  const fetchHistory = useCallback(async (roomId) => {
    const target = roomId || roomCode;
    if (!target) return [];
    try {
      const res = await api.getExecutionHistory(target);
      if (res?.history && Array.isArray(res.history)) {
        setHistory(res.history);
        return res.history;
      }
    } catch (err) {
      console.warn('[useCodeExecution] Error fetching history:', err.message);
    }
    return [];
  }, [roomCode]);

  // 7. Core Execute Code Function
  const executeCode = useCallback(async (codeToRun, overrideLang = null, overrideStdin = null) => {
    // Edge Case 1: Empty Code Validation
    if (codeToRun === undefined || codeToRun === null || typeof codeToRun !== 'string' || !codeToRun.trim()) {
      setError('Code cannot be empty');
      return {
        success: false,
        error: 'Code cannot be empty',
      };
    }

    // Edge Case 2: Code Length Limit (> 100KB)
    if (codeToRun.length > MAX_CODE_BYTES) {
      setError('Code too large (max 100KB)');
      return {
        success: false,
        error: 'Code too large (max 100KB)',
      };
    }

    // Edge Case 10: Prevent duplicate overlapping execution
    if (isExecutingRef.current) {
      return { success: false, error: 'Already executing code. Please wait.' };
    }

    const currentLang = (overrideLang || language || 'javascript').toLowerCase();
    const currentStdin = overrideStdin !== null ? overrideStdin : stdin;

    isExecutingRef.current = true;
    setLoading(true);
    setError(null);
    setStatus('running');

    try {
      const res = await api.executeCode({
        language: currentLang,
        code: codeToRun,
        stdin: currentStdin,
        input: currentStdin,
        roomId: roomCode || null,
        userName,
        userId: user?.id || null,
      });

      const execOutput = res.output !== undefined && res.output !== null ? res.output : '';
      const execTime = res.executionTime || 0;
      const isExecError = Boolean(res.error);

      // Handle Timeout (Judge0 status 5)
      let resolvedStatus = isExecError ? 'error' : 'success';
      if (res.status_id === 5) {
        resolvedStatus = 'timeout';
      }

      setOutput(execOutput);
      setExecutionTime(execTime);
      setExecutedBy(userName);
      setStatus(resolvedStatus);

      if (isExecError) {
        setError(res.stderr || res.compile_output || execOutput || 'Execution failed');
      }

      // Edge Case 4 & 5: Broadcast result to room collaborators via Socket.io
      if (socket && roomCode) {
        socket.emit('code-executed', {
          roomCode,
          output: execOutput,
          language: currentLang,
          executionTime: execTime,
          error: isExecError,
          status: resolvedStatus,
          ranBy: userName,
          userName,
          userId: user?.id || null,
          timestamp: new Date().toISOString(),
        });
      }

      // Add to local history
      setHistory((prev) => [
        {
          id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          output: execOutput,
          language: currentLang,
          executionTime: execTime,
          status: resolvedStatus,
          executedBy: userName,
          timestamp: new Date().toISOString(),
        },
        ...prev.slice(0, 99),
      ]);

      return {
        success: !isExecError,
        output: execOutput,
        time: execTime,
        status: resolvedStatus,
      };
    } catch (err) {
      console.error('[useCodeExecution] Execution error:', err);

      let errorMsg = 'Server error. Try again';
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        errorMsg = 'Timeout (5s exceeded)';
        setStatus('timeout');
      } else if (!err.response) {
        errorMsg = 'Connection failed. Retry?';
        setStatus('error');
      } else if (err.response.data?.error) {
        errorMsg = err.response.data.error;
        setStatus('error');
      }

      setError(errorMsg);
      setOutput((prev) => prev || errorMsg);
      return {
        success: false,
        error: errorMsg,
      };
    } finally {
      isExecutingRef.current = false;
      setLoading(false);
    }
  }, [language, stdin, roomCode, userName, user?.id, socket]);

  return {
    output,
    setOutput,
    loading,
    error,
    setError,
    language,
    setLanguage,
    stdin,
    setStdin,
    executionTime,
    executedBy,
    status,
    history,
    executeCode,
    clearOutput,
    clearHistory,
    getLanguages,
    fetchHistory,
  };
}

export default useCodeExecution;
