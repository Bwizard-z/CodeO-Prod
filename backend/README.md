# CODEO Backend

CODEO - Real-time collaborative code editor backend service.

## Tech Stack
- **Runtime & Framework**: Node.js, Express
- **Real-time Engine**: Socket.io
- **Database & Auth**: Supabase (@supabase/supabase-js)
- **Code Execution**: Judge0 API via Axios
- **AI Integrations**: Google Gemini API
- **Utilities & Logging**: Morgan, Cors, Dotenv, UUID

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm

### Installation
1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   Fill in your API keys and credentials in `.env`.

3. Run the development server:
   ```bash
   npm run dev
   ```

Server will run on port `5000` by default.

### Scripts
- `npm run dev` - Start the server (`node server.js`)
- `npm run dev:watch` - Start the server with automatic reload (`nodemon server.js`)
- `npm start` - Start production server (`node server.js`)

### Endpoints
- `GET /health` - Health check endpoint returning `{ "status": "ok" }`
