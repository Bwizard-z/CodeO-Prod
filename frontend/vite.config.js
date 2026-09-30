import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const backendTarget = process.env.VITE_BACKEND_URL || 'http://localhost:5000';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/rooms': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/auth': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/execute': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/explain': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/ai': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/agora': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/health': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/socket.io': {
        target: backendTarget,
        ws: true,
        changeOrigin: true,
      },
      '/yjs': {
        target: backendTarget,
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-monaco': ['monaco-editor', '@monaco-editor/react'],
          'vendor-yjs': ['yjs', 'y-websocket', 'y-monaco'],
          'vendor-agora': ['agora-rtc-sdk-ng'],
          'vendor-icons': [
            'lucide-react',
            '@fortawesome/react-fontawesome',
            '@fortawesome/free-solid-svg-icons',
            '@fortawesome/free-brands-svg-icons',
          ],
        },
      },
    },
  },
});
