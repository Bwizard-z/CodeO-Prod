# CODEO: Architecture, Codebase Reference & Technical Manual

---

## 1. Executive System Overview

**CodeO** is a production-grade, distributed, real-time collaborative coding studio and virtual development workspace. It empowers software engineers, students, and interviewers to collaboratively edit, execute, and discuss code in real time with synchronized execution, live audio communication, and integrated Gemini generative AI assistance.

### Architecture Topology Diagram
```
                     ┌──────────────────────────────────────────────┐
                     │          Client Browser (React 18 SPA)       │
                     │  - Monaco Editor + Y-Monaco Binding          │
                     │  - Yjs CRDT Client Engine (Local State)      │
                     │  - Socket.io Client (Room & Chat Events)     │
                     │  - Agora WebRTC SDK (Low-Latency Audio)      │
                     └───────────────┬──────────────────────────────┘
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           │ HTTP/REST (Port 5000)   │ WebSockets (ws://... )  │ Agora RTC Audio (UDP)
           ▼                         ▼                         ▼
┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────────┐
│ Express.js REST API   │ │ Node.js WebSocket     │ │ Agora SD-RTN          │
│ - Auth & Session Mgmt │ │ - y-websocket Server  │ │ Software-Defined Real-│
│ - Room Access Control │ │ - Socket.io Gateway   │ │ Time Voice Network    │
│ - Code Exec Proxy     │ │   (Ping, Chat, Lock)  │ │                       │
└──────────┬────────────┘ └──────────┬────────────┘ └───────────────────────┘
           │                         │
           ├─────────────────────────┤
           ▼                         ▼
┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────────┐
│ Supabase Cloud        │ │ Judge0 Sandbox Engine │ │ Google Gemini Pro API │
│ - PostgreSQL DB       │ │ - Isolated Docker     │ │ - gemini-1.5-flash    │
│ - Row-Level Security  │ │ - cgroups Sandboxing  │ │ - AI Chat Assistant   │
│ - GoTrue Auth System  │ │ - Multi-Language Exec │ │ - In-line Explainer   │
└───────────────────────┘ └───────────────────────┘ └───────────────────────┘
```

---

## 2. Backend Architecture & Module Reference

The backend is built with **Node.js (v20+)** and **Express 5**, operating a dual communication protocol: HTTP REST routes and WebSockets (Socket.IO + Yjs WebSocket binary protocol).

### 2.1 Server Core: `backend/server.js`
- **Purpose**: Unified runtime orchestrator. Manages HTTP routing, WebSocket upgrades, security middlewares, and static frontend single-page application delivery.
- **Key Functions & Logic**:
  - `http.createServer(app)`: Creates the HTTP server handling dual protocols.
  - **WebSocket Upgrade Interception**: Inspects `req.url`. If `req.url.startsWith('/yjs')` or `/socket.io`, it delegates to the respective WebSocket handler, completely preventing Express 404 handler collisions.
  - **Dynamic CORS Engine**: Dynamically verifies origins against development hosts, `.sslip.io` wildcards, and production domains.
  - **Static Bundle Serving**: Serves `frontend/dist` with SPA history fallback, enabling unified single-port deployment on port 5000.

### 2.2 Real-Time Gateway: `backend/socket.js`
- **Purpose**: Socket.IO room manager for transient peer presence, audio coordination, ping measurements, host moderation, and Gemini chat distribution.
- **Key Handlers**:
  - `join-room ({ roomCode, user })`: Registers user into socket room `room-${cleanCode}`, allocates distinct user colors, updates room occupancy, and emits `room-users` to all participants.
  - `language-change ({ roomCode, language })`: Broadcasts `language-changed` to peers via `socket.to(room).emit()` and persists updated language in Supabase.
  - `ping / pong`: High-precision latency round-trip time (RTT) calculation with callback ack.
  - `code-executed`: Relays execution outputs, runtimes, and status to collaborators.
  - `room-lock-toggle`, `kick-member`, `toggle-user-mic`: Host moderation actions broadcast to room sockets.
  - `ai-question`, `ai-response`, `ai-chat-clear`: Synchronizes Gemini conversations so all participants view the same AI context.

### 2.3 Yjs Document Server: `backend/services/yjsServer.js`
- **Purpose**: Manages real-time binary Conflict-free Replicated Data Types (CRDTs).
- **Key Functions**:
  - `setupYjsWebSocket(server)`: Attaches a WebSocket server on path `/yjs`.
  - `getYDoc(docName, gc)`: Retrieves or instantiates an in-memory `Y.Doc` representing the room's source code.
  - `persistence.bindState(docName, ydoc)`: Periodically debounces writes of active Yjs document states into Supabase `rooms.code_content`.

### 2.4 Code Execution Service: `backend/services/judge0Service.js` & `backend/routes/execute.js`
- **Purpose**: Compiles and executes code inside sandboxed containers via Judge0 API.
- **Key Functions**:
  - `executeCode({ source_code, language_id, stdin })`: Submits code to Judge0 endpoint `/submissions?wait=true`.
  - `getSubmission(token)`: Polls submission status until completion.
  - `getStatusDescription(statusId)`: Normalizes status codes (3: Success, 4: Wrong Answer, 5: Time Limit Exceeded, 6: Compilation Error, 7-12: Runtime Errors).
  - Normalizes base64 encoded outputs (`stdout`, `stderr`, `compile_output`).

### 2.5 Artificial Intelligence Engine: `backend/services/geminiService.js` & `backend/routes/ai.js`
- **Purpose**: Provides code explanations, automated code review, bug hunting, and time complexity analysis using Google Gemini.
- **Key Functions**:
  - `generateExplanation(code, language, customPrompt)`: Prompts Gemini with structured output constraints (Overview, Line-by-Line Breakdown, Time & Space Complexity, Edge Cases).
  - `chatWithAi({ message, selectedCode, language, chatHistory, roomId })`: Context-aware multi-turn conversational assistant, saving messages into the `room_ai_chat` table.

### 2.6 Audio RTC Service: `backend/services/agoraService.js` & `backend/routes/agora.js`
- **Purpose**: Generates dynamic cryptographic tokens for Agora RTC low-latency voice channels.
- **Key Functions**:
  - `generateRtcToken(channelName, uid, role, expireTime)`: Uses `agora-token` (`RtcTokenBuilder2`) to issue an HMAC-SHA256 authenticated RTC token with 24-hour expiration.

### 2.7 Room Lifecycle & Persistence: `backend/services/roomService.js` & `backend/routes/rooms.js`
- **Purpose**: Supabase CRUD operations for room entities.
- **Key Functions**:
  - `createRoom({ title, description, language, created_by })`: Generates a collision-resistant 6-character room code (e.g. `F88VPB`), seeds initial language templates, and stores in Postgres.
  - `getRoomByCode(code)`: Fetches room metadata, active host ID, lock state, and member snapshot.
  - `updateRoom(roomId, updates)`: Updates title, description, language, or lock state.

### 2.8 Host Moderation Engine: `backend/routes/roomControl.js`
- **Purpose**: Enforces host permissions, participant kick operations, room locking, and mute triggers.
- **Key Functions**:
  - `verifyHost(roomId, userId)`: Validates that the requesting user's identity matches `rooms.created_by` or `rooms.creator_email`.
  - Enforces read-only code states when a room is locked for non-host members.

---

## 3. Frontend Architecture & Module Reference

The client is a responsive Single Page Application (SPA) built on **React 18** and **Vite**, using **Monaco Editor**, **Tailwind CSS v4**, and custom React hooks.

### 3.1 Custom React Hooks (`frontend/src/hooks/`)

| Hook File | Purpose & Responsibilities | Key Functions / Return Values |
| :--- | :--- | :--- |
| `useYjs.js` | Connects to the backend Yjs WebSocket server. Creates Y.Doc, binds `yText`, and initializes Awareness for multi-user cursor presence. | `{ yDoc, yText, yAwareness, isSynced, connectedUsers }` |
| `useMonacoBinding.js`| Binds Monaco Editor's ITextModel directly to `yjs.yText` via `y-monaco`, enabling character-by-character non-conflicting sync. | Binds on editor mount; disposes binding on unmount. |
| `useSocket.js` | Manages the primary Socket.IO connection, room join handshake, auto-reconnection with backoff, and member tracking. | `{ socket, isConnected, members, emitEvent }` |
| `useCodeExecution.js`| Manages Judge0 submission lifecycle, stdin inputs, execution outputs, runtimes, and local execution history. | `{ language, setLanguage, executeCode, output, isRunning, error }` |
| `useAudio.js` | Initializes Agora RTC client, joins voice channels, toggles local microphone audio tracks, and monitors speaking volume levels. | `{ joinCall, leaveCall, toggleMute, isConnected, isMuted, volumeLevels }` |
| `useRoomControl.js` | Manages host moderation controls (lock/unlock room, kick participants, remote mute). | `{ isLocked, isKicked, toggleLock, kickUser, muteUser }` |
| `usePing.js` | Emits periodic ping packets every 500ms; computes moving average round-trip latency (RTT) and connection quality (Excellent, Good, Poor). | `{ ping, status, quality }` |
| `useAI.js` | Sends queries to the Gemini API, maintaining chat history and streaming responses into the editor panel. | `{ sendMessage, isLoading, error, chatHistory }` |

### 3.2 Editor & Main Components (`frontend/src/components/`)

- **`EditorPage.jsx`**: The command center of CodeO. Integrates the top navigation bar, collapsible left sidebar (collaborators & voice participants), central Monaco Editor, bottom terminal output panel, and right Gemini AI drawer.
- **`Editor.jsx`**: Wraps `@monaco-editor/react`. Configures Monaco editor themes, fonts, minimap, line markers, syntax highlighting, and attaches Yjs Awareness colored cursor widgets for remote peers.
- **`OutputPanel.jsx`**: Displays execution outcomes, including exit codes, stdout, stderr, compile errors, runtime execution times, and custom stdin input textarea.
- **`LanguageSelector.jsx`**: Dropdown for switching programming languages (JavaScript, Python, Java, C++, TypeScript).
- **`AudioCall.jsx`**: Voice chat pill button with animated speaking waveforms, mute toggle, and participant audio status indicators.
- **`ConnectionStatus.jsx`**: Real-time health badge displaying WebSocket connection state, Yjs sync status, active peer counts, and round-trip ping in milliseconds.
- **`HostPanel.jsx`**: Administrative menu for room hosts providing room lock/unlock, member removal, and voice controls.
- **`AiPanel.jsx`**: Right-side Gemini AI panel with syntax-highlighted code snippets, markdown formatting, line-by-line explanations, and bug resolution chat.

---

## 4. Real-Time Synchronization Deep Dive (Yjs & CRDTs)

### Why CRDTs instead of Operational Transformation (OT)?
Traditional collaborative tools (like older Google Docs) require a central server to serialize and transform operations. CodeO utilizes **Yjs** based on **Conflict-free Replicated Data Types (CRDTs)**:
1. **Mathematical Commutativity**: Concurrent edits on multiple machines converge to the exact same text state regardless of packet arrival order.
2. **Zero Central Lock Bottlenecks**: Clients edit local copies with zero latency; diff vectors are asynchronously synchronized in binary format over WebSockets.
3. **Structured Awareness**: Cursors, selections, and user identity tags are shared via ephemeral state vectors that automatically prune when a collaborator disconnects.

---

## 5. Technology Stack Summary

| Technology | Purpose in CodeO | Why It Was Chosen |
| :--- | :--- | :--- |
| **React 18** | Frontend UI Framework | Declarative component model, fast reconciliation, Concurrent Mode. |
| **Vite** | Frontend Build Tool & Bundler | Instant HMR (Hot Module Replacement) and optimized Rollup production builds. |
| **Monaco Editor** | Code Editor Component | The engine powering VS Code; unmatched syntax highlighting, IntelliSense, and keybindings. |
| **Yjs & Y-Monaco** | CRDT Real-Time Collaboration | Industry gold-standard CRDT implementation; sub-millisecond sync with minimal memory footprint. |
| **Socket.IO** | Event Gateway | Robust WebSocket wrapper with fallback, room multiplexing, and automatic reconnection. |
| **Node.js & Express 5** | Backend Runtime & REST Framework | High I/O throughput, unified JavaScript ecosystem, native HTTP upgrade handling. |
| **Agora RTC SDK** | WebRTC Voice Communication | Global Software-Defined Real-Time Network (SD-RTN) delivering <100ms ultra-low audio latency. |
| **Judge0 API** | Remote Sandboxed Code Execution | Secure multi-language sandbox with cgroup isolation and strict resource limits. |
| **Google Gemini API** | In-Editor Generative AI Assistant | Large context window, fast inference, and structured coding analysis. |
| **Supabase (PostgreSQL)**| Database, Auth & Security Rules | Production-ready managed Postgres with Row Level Security (RLS) and JWT auth. |
| **Tailwind CSS v4** | UI Styling & Design System | Utility-first, zero-runtime overhead CSS framework for modern dark-mode aesthetic. |
| **Docker & Docker-Compose**| Containerization & Execution Engine| Standardized deployment of Judge0, Postgres, and Redis services. |
| **PM2** | Process Supervision | Production daemon management, zero-downtime reloads, and automatic boot recovery. |
