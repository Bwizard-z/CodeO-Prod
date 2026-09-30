// hooks/useCodeExplanation.js - React Hook for Gemini Code Explanation
import { useState, useCallback, useEffect } from 'react';
import api from '../services/api';

/**
 * Custom hook for generating AI code explanations with Gemini
 * and broadcasting/receiving real-time updates via Socket.io.
 *
 * @param {Object} [options]
 * @param {string} [options.roomCode] - Current room identifier
 * @param {Object} [options.user] - Current user info { id, name, avatar, color }
 * @param {Object} [options.socket] - Socket.io client instance
 * @param {Function} [options.onRemoteExplanation] - Callback when peer explains code
 */
export function useCodeExplanation({ roomCode, user, socket, onRemoteExplanation } = {}) {
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCode, setSelectedCode] = useState('');
  const [timestamp, setTimestamp] = useState(null);
  const [language, setLanguage] = useState('javascript');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [lastExplainedBy, setLastExplainedBy] = useState(null);

  /**
   * Request an explanation for the given code snippet
   */
  const explainCode = useCallback(
    async (codeToExplain, codeLanguage = 'javascript', customPrompt = '') => {
      const targetCode = typeof codeToExplain === 'string' ? codeToExplain : selectedCode;
      const targetLang = codeLanguage || language || 'javascript';

      if (!targetCode || !targetCode.trim()) {
        const validationErr = 'Please select or provide code to explain.';
        setError(validationErr);
        return { success: false, error: validationErr };
      }

      setLoading(true);
      setError(null);
      setSelectedCode(targetCode);
      setLanguage(targetLang);
      setIsModalOpen(true);

      try {
        const response = await api.explainCode({
          code: targetCode,
          language: targetLang,
          prompt: customPrompt,
        });

        if (response && response.success && response.explanation) {
          const resultExplanation = response.explanation;
          const resultTime = response.timestamp || new Date().toISOString();

          setExplanation(resultExplanation);
          setTimestamp(resultTime);
          setLastExplainedBy(user?.name || 'You');

          // Broadcast to room members via Socket.io
          if (socket && roomCode) {
            socket.emit('code-explained', {
              roomCode,
              code: targetCode,
              language: targetLang,
              explanation: resultExplanation,
              user: user
                ? {
                    id: user.id,
                    name: user.name || user.user_metadata?.user_name || 'Collaborator',
                    avatar: user.avatar,
                    color: user.color,
                  }
                : { name: 'Collaborator' },
              timestamp: resultTime,
            });
          }

          return {
            success: true,
            explanation: resultExplanation,
            language: targetLang,
            timestamp: resultTime,
          };
        } else {
          throw new Error(response?.error || 'Failed to generate code explanation.');
        }
      } catch (err) {
        const message =
          err.response?.data?.error ||
          err.message ||
          'Failed to connect to AI explanation service. Please try again.';
        setError(message);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [selectedCode, language, socket, roomCode, user]
  );

  /**
   * Listen for real-time code-explained broadcasts from peers in the room
   */
  useEffect(() => {
    if (!socket) return;

    const handleRemoteExplanation = (payload) => {
      if (payload?.explanation) {
        setLastExplainedBy(payload.user?.name || 'A collaborator');
        if (onRemoteExplanation) {
          onRemoteExplanation(payload);
        }
      }
    };

    socket.on('code-explained', handleRemoteExplanation);

    return () => {
      socket.off('code-explained', handleRemoteExplanation);
    };
  }, [socket, onRemoteExplanation]);

  /**
   * Clear current explanation and error state
   */
  const clearExplanation = useCallback(() => {
    setExplanation('');
    setError(null);
    setSelectedCode('');
    setTimestamp(null);
    setLastExplainedBy(null);
  }, []);

  return {
    explanation,
    loading,
    error,
    selectedCode,
    language,
    timestamp,
    isModalOpen,
    lastExplainedBy,
    explainCode,
    setExplanation,
    setError,
    setSelectedCode,
    setIsModalOpen,
    clearExplanation,
  };
}

export default useCodeExplanation;
