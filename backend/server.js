const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from backend/.env or root .env regardless of execution directory
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

// Import Routes & Error Handler
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const roomControlRoutes = require('./routes/roomControl');
const executeRoutes = require('./routes/execute');
const explainRoutes = require('./routes/explain');
const aiRoutes = require('./routes/ai');
const agoraRoutes = require('./routes/agora');
const feedbackRoutes = require('./routes/feedback');
const { errorHandler } = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');

const http = require('http');
const WebSocket = require('ws');
const { initSocket } = require('./socket');
const { setupYjsConnection } = require('./services/yjsServer');

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';

// Trust reverse proxy (Nginx, Docker, Cloudflare) to ensure accurate client IP tracking for rate limiting
app.set('trust proxy', 1);

// Allowed Origins for CORS (Support comma-separated env values and localhost)
const rawAllowedOrigins = [
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
  process.env.VITE_APP_URL,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
]
  .filter(Boolean)
  .flatMap((val) => val.split(',').map((o) => o.trim().replace(/\/+$/, '')));

const allowedOrigins = [...new Set(rawAllowedOrigins)];

// Security Headers (configured to allow cross-origin assets for Monaco & Agora)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false,
  })
);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) {
        return callback(null, true);
      }
      const cleanOrigin = origin.replace(/\/+$/, '');
      const cleanOriginHost = cleanOrigin.replace(/^https?:\/\//, '');

      const isAllowed =
        cleanOrigin.endsWith('.sslip.io') ||
        cleanOrigin.includes('localhost') ||
        cleanOrigin.includes('127.0.0.1') ||
        /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}(?::[0-9]+)?$/.test(cleanOriginHost) ||
        allowedOrigins.some((allowed) => {
          if (!allowed) return false;
          const cleanAllowed = allowed.replace(/\/+$/, '');
          if (cleanAllowed === cleanOrigin) return true;
          if (cleanAllowed.replace(/^https?:\/\//, '') === cleanOriginHost) return true;
          if (cleanAllowed.startsWith('*.')) return cleanOrigin.endsWith(cleanAllowed.slice(2));
          return false;
        });

      if (isAllowed) {
        return callback(null, true);
      }

      if (!isProduction) {
        return callback(null, true); // Permissive in development
      }

      return callback(new Error(`Origin ${origin} not allowed by CORS policy`));
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(morgan(isProduction ? 'combined' : 'dev'));

// Health check routes (no rate limiting)
app.get(['/health', '/api/health'], (req, res) => {
  res.status(200).json({ status: 'ok', service: 'CODEO Backend API', environment: process.env.NODE_ENV || 'development', timestamp: new Date().toISOString() });
});

// Apply baseline API rate limiting to all /api routes
app.use('/api', apiLimiter);

// Mount API Routes (Both /api/* and root /* to guarantee zero 404 route mismatches)
app.use(['/api/auth', '/auth'], authRoutes);
app.use(['/api/rooms', '/rooms'], roomControlRoutes);
app.use(['/api/rooms', '/rooms'], roomRoutes);
app.use(['/api/execute', '/execute'], executeRoutes);
app.use(['/api/explain', '/explain'], explainRoutes);
app.use(['/api/ai', '/ai'], aiRoutes);
app.use(['/api/agora', '/agora'], agoraRoutes);
app.use(['/api/feedback', '/feedback'], feedbackRoutes);

const fs = require('fs');

const frontendDist = path.join(__dirname, '../frontend/dist');

// Serve static frontend build if it exists
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));

  // SPA fallback for frontend client-side routes (Express 5 compatible)
  app.use((req, res, next) => {
    if (req.method !== 'GET') {
      return next();
    }
    const url = req.originalUrl || req.url || '';

    // Always serve frontend SPA for the OAuth callback page
    if (url.startsWith('/auth/callback')) {
      return res.sendFile(path.join(frontendDist, 'index.html'));
    }

    // Let API, health checks, and WebSocket upgrade paths fall through
    if (
      url.startsWith('/api') ||
      url.startsWith('/health') ||
      url.startsWith('/socket.io') ||
      url.startsWith('/yjs')
    ) {
      return next();
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// 404 Handler for undefined API routes (do not intercept socket.io polling or yjs paths)
app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/socket.io') || req.originalUrl.startsWith('/yjs')) {
    return next();
  }
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.originalUrl} not found`,
    code: 'ROUTE_NOT_FOUND',
  });
});

// Centralized Error Handling Middleware
app.use(errorHandler);

// Create HTTP Server - bypass Express for /socket.io polling requests so Socket.io handles them directly
const server = http.createServer((req, res) => {
  if (req.url && (req.url.startsWith('/socket.io') || req.url.startsWith('/yjs'))) {
    // Socket.io or WebSocket handles this request directly; do not let Express send a 404
    return;
  }
  app(req, res);
});

// Initialize Socket.io
const io = initSocket(server, allowedOrigins);
app.set('io', io);

// Initialize Yjs WebSocket Server
const wss = new WebSocket.Server({ noServer: true });

wss.on('connection', (ws, req) => {
  setupYjsConnection(ws, req);
});

// Handle WebSocket upgrade routing
server.on('upgrade', (request, socket, head) => {
  const reqUrl = request.url || '';

  // 1. Let Socket.io handle its path completely without interference
  if (reqUrl.includes('/socket.io')) {
    return;
  }

  // 2. Route Yjs WebSockets
  if (reqUrl.includes('/yjs')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
    return;
  }
});

server.listen(PORT, () => {
  console.log(`CODEO Backend Server running on port ${PORT}`);
  console.log(`  - REST API:      http://localhost:${PORT}/api`);
  console.log(`  - Socket.io:     ws://localhost:${PORT}/socket.io`);
  console.log(`  - Yjs WebSocket: ws://localhost:${PORT}/yjs/:roomCode`);
});

module.exports = server;
