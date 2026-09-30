import axios from 'axios';
import { supabase } from '../lib/supabase';

const API_BASE_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.PROD ? '' : 'http://localhost:5000');

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Attach Supabase auth token automatically to all requests
apiClient.interceptors.request.use(async (config) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || localStorage.getItem('codeo_auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (err) {
    console.warn('API interceptor session error:', err);
  }
  return config;
});

export const api = {
  checkHealth: async () => {
    const res = await apiClient.get('/health');
    return res.data;
  },
  executeCode: async ({ language, code, input = '', stdin = '', roomId = null, userName = null, userId = null }) => {
    const res = await apiClient.post('/api/execute', {
      language,
      code,
      stdin: stdin || input,
      input: stdin || input,
      roomId,
      userName,
      userId,
    });
    return res.data;
  },
  getExecutionLanguages: async () => {
    const res = await apiClient.get('/api/execute/languages');
    return res.data;
  },
  getExecutionHistory: async (roomId) => {
    const res = await apiClient.get(`/api/execute/history/${roomId}`);
    return res.data;
  },
  explainCode: async ({ code, language = 'javascript', prompt = '' }) => {
    const res = await apiClient.post('/api/explain', { code, language, prompt });
    return res.data;
  },
  // AI Assistant Chat & History Endpoints
  aiChat: async ({ message, selectedCode = '', code = '', language = 'javascript', roomId = null, chatHistory = [], history = [] }) => {
    const finalHistory = Array.isArray(chatHistory) && chatHistory.length > 0 ? chatHistory : history;
    const finalCode = selectedCode || code || '';
    const res = await apiClient.post('/api/ai/chat', {
      message,
      selectedCode: finalCode,
      code: finalCode,
      language,
      roomId,
      chatHistory: finalHistory,
      history: finalHistory,
    });
    return res.data;
  },
  getAiHistory: async (roomId) => {
    const res = await apiClient.get(`/api/ai/history/${roomId}`);
    return res.data;
  },
  validateAiQuestion: async (question) => {
    const res = await apiClient.post('/api/ai/validate', { question });
    return res.data;
  },
  // Room API endpoints
  createRoom: async ({ title, description, language = 'javascript' }) => {
    const res = await apiClient.post('/api/rooms', { title, description, language });
    return res.data;
  },
  getUserRooms: async () => {
    const res = await apiClient.get('/api/rooms/user/rooms');
    return res.data;
  },
  getRoomByCode: async (code) => {
    const res = await apiClient.get(`/api/rooms/${code}`);
    return res.data;
  },
  joinRoom: async (code) => {
    const res = await apiClient.post(`/api/rooms/${code}/join`);
    return res.data;
  },
  leaveRoom: async (id) => {
    const res = await apiClient.post(`/api/rooms/${id}/leave`);
    return res.data;
  },
  deleteRoom: async (id) => {
    const res = await apiClient.delete(`/api/rooms/${id}`);
    return res.data;
  },
  updateRoom: async (id, updates) => {
    const res = await apiClient.put(`/api/rooms/${id}`, updates);
    return res.data;
  },
  // Agora Audio Communication Token & Config
  getAgoraToken: async ({ roomCode, userId, uid, role = 'publisher' }) => {
    const res = await apiClient.post('/api/agora/token', { roomCode, userId, uid, role });
    return res.data;
  },
  getAgoraConfig: async () => {
    const res = await apiClient.get('/api/agora/config');
    return res.data;
  },
  // Host Room Control Endpoints
  lockRoom: async (roomId) => {
    const res = await apiClient.post(`/api/rooms/${roomId}/lock`);
    return res.data;
  },
  unlockRoom: async (roomId) => {
    const res = await apiClient.post(`/api/rooms/${roomId}/unlock`);
    return res.data;
  },
  muteMember: async (roomId, memberId) => {
    const res = await apiClient.post(`/api/rooms/${roomId}/member/${memberId}/mute`);
    return res.data;
  },
  unmuteMember: async (roomId, memberId) => {
    const res = await apiClient.post(`/api/rooms/${roomId}/member/${memberId}/unmute`);
    return res.data;
  },
  disableMemberEditor: async (roomId, memberId) => {
    const res = await apiClient.post(`/api/rooms/${roomId}/member/${memberId}/disable-editor`);
    return res.data;
  },
  enableMemberEditor: async (roomId, memberId) => {
    const res = await apiClient.post(`/api/rooms/${roomId}/member/${memberId}/enable-editor`);
    return res.data;
  },
  kickMember: async (roomId, memberId) => {
    const res = await apiClient.post(`/api/rooms/${roomId}/member/${memberId}/kick`);
    return res.data;
  },
  getRoomMembers: async (roomId) => {
    const res = await apiClient.get(`/api/rooms/${roomId}/members`);
    return res.data;
  },
};

export default api;
