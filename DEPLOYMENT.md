# 🚀 CODEO - Production VPS Deployment Guide (Google Cloud / Linux)

> Complete, step-by-step production deployment guide for running **CodeO** (Frontend React SPA + Unified Node.js Backend + WebSockets + Self-Hosted Judge0 Engine) on a Linux Virtual Private Server (Google Cloud Compute Engine, DigitalOcean, AWS EC2, or Hetzner).
>
> 🎓 **A College Project By [Bharanindra Acharya](https://www.linkedin.com/in/bharanindra-acharya-229887395?utm_source=share_via&utm_content=profile&utm_medium=member_android)**  
> 🌐 **Live Production Deployment:** [https://codeo.duckdns.org](https://codeo.duckdns.org)

---

## 🏛️ Architecture Overview

On your production VPS:

```
                            Internet (HTTPS: 443 / HTTP: 80)
                                           │
                                ┌──────────▼──────────┐
                                │   Nginx Web Server   │
                                │ (SSL + Rate Limiting)│
                                └──────────┬──────────┘
                                           │
                         http://localhost:5000 (Internal)
                         ws://localhost:5000   (WebSockets)
                                           │
                                ┌──────────▼──────────┐
                                │    CODEO Server     │
                                │  (Node.js Express)  │
                                ├─────────────────────┤
                                │ • Serves React SPA  │
                                │ • REST API (/api)   │
                                │ • Socket.io Presence│
                                │ • Yjs WebSockets    │
                                └──────────┬──────────┘
                                           │
                               ┌───────────┴───────────┐
                               │                       │
                     ┌─────────▼────────┐     ┌────────▼────────┐
                     │  Supabase Cloud  │     │  Judge0 Docker  │
                     │  (DB, Auth, SQL) │     │  (Port 2358)    │
                     └──────────────────┘     └─────────────────┘
```

* **Zero CORS issues:** Frontend and Backend share the exact same origin.
* **Isolated Sandbox:** Judge0 runs in isolated Docker containers on port 2358 and is never exposed directly to the public internet.

---

## 📋 Recommended Server Specifications

* **Cloud Provider**: Google Cloud Platform (Compute Engine `e2-medium` or `e2-standard-2`), DigitalOcean Droplet, AWS EC2, or Hetzner.
* **OS**: Ubuntu 22.04 LTS or 24.04 LTS (x86_64).
* **CPU / RAM**: 2+ vCPUs, 4GB+ RAM (*plus 4GB swap space*).
* **Disk**: 30GB+ SSD / Persistent Disk.
* **Open Firewall Ports**: TCP 22 (SSH), TCP 80 (HTTP), TCP 443 (HTTPS).

---

## Step 1: System Preparation & Swap Space

Log into your VPS via SSH:
```bash
ssh username@<YOUR_VPS_IP>
```

### 1. Update Packages
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git wget unzip build-essential software-properties-common
```

### 2. Configure 4GB Swap Space
*(Crucial to prevent out-of-memory errors during Vite production compilation and code execution):*
```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## Step 2: Install Docker, Node.js & PM2

### 1. Install Docker & Docker Compose
```bash
sudo apt install -y docker.io docker-compose
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
```

### 2. Install Node.js 22 LTS (Required for native WebSocket support)
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Verify versions
node -v   # v22.x.x
npm -v    # v10.x.x / v11.x.x
```

### 3. Install PM2 Process Manager Globally
```bash
sudo npm install -g pm2
```

---

## Step 3: Set Up Self-Hosted Judge0 Engine

Judge0 runs isolated Linux sandbox containers to safely execute user code.

### 1. Download & Extract Judge0
```bash
mkdir -p ~/judge0 && cd ~/judge0
wget https://github.com/judge0/judge0/releases/download/v1.13.1/judge0-v1.13.1.zip
unzip judge0-v1.13.1.zip
```

### 2. Generate Random Database Passwords
```bash
sed -i "s/YOUR_POSTGRES_PASSWORD/$(openssl rand -hex 16)/g" judge0.conf
sed -i "s/YOUR_REDIS_PASSWORD/$(openssl rand -hex 16)/g" judge0.conf
```

### 3. Start Judge0 in Background
```bash
sudo docker-compose up -d db redis
sleep 10
sudo docker-compose up -d
```

### 4. Verify Judge0
```bash
curl http://localhost:2358/api/v1/about
# Should return: {"version":"1.13.1", ...}
```

---

## Step 4: Deploy CODEO Application

### 1. Clone the Production Repository
```bash
cd ~
git clone https://github.com/Bwizard-z/CodeO-Prod.git codeo
cd codeo
```

### 2. Configure Backend `.env`
```bash
cp backend/.env.example backend/.env
nano backend/.env
```

**Set production environment variables:**
```env
PORT=5000
NODE_ENV=production

# Your domain or sslip.io address (No trailing slash)
CLIENT_URL=https://codeo.yourdomain.com
# Example if using IP without a custom domain:
# CLIENT_URL=https://34.120.xx.xx.sslip.io

# Supabase Credentials
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_KEY=your-supabase-service-role-key

# Judge0 Execution Engine (points to local Docker)
JUDGE0_URL=http://localhost:2358/api/v1

# Google Gemini AI
GEMINI_API_KEY=your-gemini-api-key

# Agora Voice & Video Chat
AGORA_APP_ID=your-agora-app-id
AGORA_APP_CERTIFICATE=your-agora-app-certificate
```

### 3. Configure Frontend `.env.local`
```bash
nano frontend/.env.local
```
**Add client keys:**
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_AGORA_APP_ID=your-agora-app-id
```

### 4. Install Dependencies & Build Frontend
```bash
# If cloned on Linux after Windows development, ensure platform binaries are resolved:
rm -rf package-lock.json node_modules frontend/node_modules backend/node_modules

# Install monorepo dependencies
npm install

# Compile optimized frontend SPA into frontend/dist
npm run build
```

Verify that `frontend/dist/index.html` exists:
```bash
ls -l frontend/dist
```

### 5. Launch CODEO with PM2
```bash
pm2 start backend/server.js --name codeo
pm2 save
pm2 startup
# (Run the generated sudo env command that PM2 displays)

# Ensure Judge0 Docker containers auto-restart on VM reboot
sudo docker update --restart always $(sudo docker ps -q)
```

Verify status:
```bash
pm2 status
pm2 logs codeo --lines 20
```

---

## Step 5: Configure Nginx & Let's Encrypt SSL

Nginx proxies HTTP and WebSockets (`/socket.io` and `/yjs`), manages SSL termination, and provides anti-DDoS rate limits.

### 1. Install Nginx & Certbot
```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

### 2. Configure Nginx Virtual Host
```bash
sudo nano /etc/nginx/sites-available/codeo
```

Replace `codeo.yourdomain.com` with your custom domain or `<YOUR_VPS_IP>.sslip.io`:

```nginx
# Anti-DDoS Rate & Connection Limiting Zones
limit_req_zone $binary_remote_addr zone=codeo_req:10m rate=30r/s;
limit_conn_zone $binary_remote_addr zone=codeo_conn:10m;

server {
    listen 80;
    listen [::]:80;
    server_name codeo.yourdomain.com; # <-- Replace with your domain or IP.sslip.io

    client_max_body_size 20M;

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/rss+xml font/truetype font/opentype application/vnd.ms-fontobject image/svg+xml;

    location / {
        limit_conn codeo_conn 40;
        limit_req zone=codeo_req burst=60 nodelay;

        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;

        # WebSocket support for Socket.io and Yjs
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Keep persistent WebSocket connections alive
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
        proxy_buffering off;
    }
}
```

### 3. Enable Site & Test Nginx
```bash
sudo ln -s /etc/nginx/sites-available/codeo /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

### 4. Provision Free SSL Certificate
```bash
sudo certbot --nginx -d codeo.yourdomain.com
```
*(Choose redirect HTTP to HTTPS when prompted).*

Test automatic renewal:
```bash
sudo certbot renew --dry-run
```

---

## Step 6: Verify Deployment

1. Open `https://codeo.yourdomain.com` in your browser.
2. Sign up or log in.
3. Create a room and open it in two separate browser tabs to test:
   * **Real-time editor sync (Yjs CRDT)**
   * **Live collaborative cursors & presence (Socket.io)**
   * **Code execution (Self-hosted Judge0)**
   * **Language switching & boilerplates**
   * **Agora Voice & Video calls**
   * **Gemini AI code explanations**

---

## 🛠️ Maintenance & Rolling Updates

### Update to Latest Code (Zero-Downtime)
```bash
cd ~/codeo
git pull origin main
npm install
npm run build
pm2 reload codeo
```

### Handy PM2 Commands
```bash
pm2 logs codeo        # Stream real-time logs
pm2 monit             # Interactive CPU/Memory dashboard
pm2 restart codeo     # Hard restart
pm2 stop codeo        # Stop app
```
