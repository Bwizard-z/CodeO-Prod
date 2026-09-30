# CODEO Self-Hosted Single-Server Deployment Guide (Option 2)

This guide walks you through deploying **CodeO (Frontend + Backend)** along with your **self-hosted Judge0 execution engine** on a single Linux VPS (Ubuntu 22.04 / 24.04 on DigitalOcean, AWS EC2, Hetzner, etc.).

---

## 🏛️ Architecture Overview

On your server:
```
                      Internet (Port 80 / 443)
                                 │
                     ┌───────────▼───────────┐
                     │   Nginx Reverse Proxy  │
                     │  (SSL via Let's Encrypt)
                     └───────────┬───────────┘
                                 │
               http://localhost:5000 / ws://localhost:5000
                                 │
                     ┌───────────▼───────────┐
                     │     CODEO Unified     │
                     │  (Node.js Express App)│
                     │  - Serves Frontend UI │
                     │  - REST API & Auth    │
                     │  - Socket.io & Yjs WS │
                     └───────────┬───────────┘
                                 │
           Internal Only (http://localhost:2358/api/v1)
                                 │
                     ┌───────────▼───────────┐
                     │  Judge0 Docker Engine │
                     │  (Redis + Postgres)   │
                     └───────────────────────┘
```

* **Zero CORS issues:** Frontend and Backend share the exact same domain.
* **Secure Sandbox:** Judge0 runs in isolated Linux containers and is never exposed to the public internet.

---

## Step 1: Server Requirements & Initial Setup

1. **Recommended Server Specs:**
   * 2+ vCPUs
   * 4GB+ RAM (Judge0 requires memory to compile C++, Java, and run sandboxed processes)
   * Ubuntu 22.04 LTS or 24.04 LTS

2. **Install Docker, Node.js & PM2 on your VPS:**
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y

   # Install Docker & Docker Compose
   sudo apt install -y docker.io docker-compose curl git

   # Install Node.js 20 LTS
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs

   # Install PM2 process manager
   sudo npm install -g pm2
   ```

---

## Step 2: Set Up Self-Hosted Judge0

Judge0 relies on Linux cgroups and container isolation to securely execute untrusted code.

1. **Download Judge0 setup:**
   ```bash
   mkdir -p ~/judge0 && cd ~/judge0
   wget https://github.com/judge0/judge0/releases/download/v1.13.1/judge0-v1.13.1.zip
   sudo apt install -y unzip && unzip judge0-v1.13.1.zip
   ```

2. **Generate Configuration:**
   ```bash
   # Generate judge0.conf with random database passwords
   sed -i "s/YOUR_POSTGRES_PASSWORD/$(openssl rand -hex 16)/g" judge0.conf
   sed -i "s/YOUR_REDIS_PASSWORD/$(openssl rand -hex 16)/g" judge0.conf
   ```

3. **Start Judge0 in Background:**
   ```bash
   sudo docker-compose up -d db redis
   sleep 10
   sudo docker-compose up -d
   ```

4. **Verify Judge0 is running:**
   ```bash
   curl http://localhost:2358/api/v1/about
   # Should return: {"version":"1.13.1", ...}
   ```

---

## Step 3: Deploy CODEO Unified App

1. **Clone your repository:**
   ```bash
   cd ~
   git clone https://github.com/YOUR_USERNAME/codeo.git
   cd codeo
   ```

2. **Create your backend production `.env`:**
   ```bash
   cp backend/.env.example backend/.env
   nano backend/.env
   ```

   **Production Values for `.env`:**
   ```env
   PORT=5000
   NODE_ENV=production

   # Since frontend is served from the same domain:
   CLIENT_URL=https://yourdomain.com

   # Supabase Credentials
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_KEY=your_supabase_service_role_key

   # Connects to your local Judge0
   JUDGE0_URL=http://localhost:2358/api/v1

   # AI & Agora
   GEMINI_API_KEY=your_gemini_api_key
   AGORA_APP_ID=your_agora_app_id
   AGORA_APP_CERTIFICATE=your_agora_certificate
   ```

3. **Install Dependencies & Build:**
   ```bash
   # Install dependencies for both workspaces
   npm install

   # Build frontend SPA bundle (generates frontend/dist)
   npm run build
   ```

4. **Launch CODEO with PM2:**
   ```bash
   pm2 start backend/server.js --name codeo
   pm2 save
   pm2 startup
   ```

---

## Step 4: Configure Nginx & SSL (Let's Encrypt)

1. **Install Nginx & Certbot:**
   ```bash
   sudo apt install -y nginx certbot python3-certbot-nginx
   ```

2. **Configure Nginx Site:**
   ```bash
   sudo nano /etc/nginx/sites-available/codeo
   ```

   Paste the configuration (includes Nginx-level Anti-DDoS rate and connection limits):
   ```nginx
   # Anti-DDoS Rate Limiting Zones (Drop abusive floods before they reach Node.js)
   limit_req_zone $binary_remote_addr zone=req_limit:10m rate=30r/s;
   limit_conn_zone $binary_remote_addr zone=conn_limit:10m;

   server {
       server_name yourdomain.com;

       # Max body size for code uploads
       client_max_body_size 10M;

       location / {
           # Apply connection and rate limits
           limit_conn conn_limit 30;
           limit_req zone=req_limit burst=50 nodelay;

           proxy_pass http://localhost:5000;
           proxy_http_version 1.1;

           # Support WebSockets for Socket.io & Yjs
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";

           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;

           # Timeout settings for real-time WebSockets
           proxy_read_timeout 86400s;
           proxy_send_timeout 86400s;
       }
   }
   ```

3. **Enable Site & Test:**
   ```bash
   sudo ln -s /etc/nginx/sites-available/codeo /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

4. **Obtain Free SSL Certificate:**
   ```bash
   sudo certbot --nginx -d yourdomain.com
   ```

---

## Step 5: Verify Everything

1. Open `https://yourdomain.com` in your browser.
2. Sign up or log in.
3. Create a room and open it in a second browser window or private tab to verify:
   * **Real-time editor sync (Yjs)**
   * **User presence and cursors (Socket.io)**
   * **Code execution (Self-hosted Judge0)**
   * **Voice / Video (Agora)**
   * **AI Code Explainer (Gemini)**
