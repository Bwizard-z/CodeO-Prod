// frontend/src/hooks/useAI.js - Custom React Hook for Gemini AI Chat Assistant
import { useState, useCallback } from 'react';
import api from '../services/api';

/**
 * Custom hook for AI code assistant chat communication and history management.
 */
export function useAI() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Send question and code context to AI assistant
   */
  const sendMessage = useCallback(async (message, selectedCode = '', language = 'javascript', roomId = null, chatHistory = []) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.aiChat({
        message,
        selectedCode,
        language,
        roomId,
        chatHistory,
      });

      if (!response.success && response.error) {
        throw new Error(response.error);
      }

      return response;
    } catch (err) {
      const errorMsg =
        err.response?.data?.error ||
        err.message ||
        'Failed to connect to AI assistant. Please try again.';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Load chat history for a room
   */
  const loadHistory = useCallback(async (roomId) => {
    if (!roomId) return { history: [] };
    try {
      const response = await api.getAiHistory(roomId);
      return response || { history: [] };
    } catch (err) {
      console.warn('[useAI] Failed to load chat history:', err.message);
      return { history: [] };
    }
  }, []);

  /**
   * Validate whether a question is coding-related
   */
  const validateQuestion = useCallback(async (question) => {
    try {
      const response = await api.validateAiQuestion(question);
      return Boolean(response?.isCodingRelated);
    } catch {
      return true; // Fallback to permissive
    }
  }, []);

  return {
    sendMessage,
    loadHistory,
    validateQuestion,
    loading,
    error,
    setError,
  };
}

export default useAI;
