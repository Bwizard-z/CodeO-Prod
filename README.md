# 🚀 CODEO - Real-time Collaborative Code Editor & Studio

> **CodeO** is a production-grade, real-time collaborative code editor and development studio featuring live Yjs CRDT document synchronization, Monaco editor, Socket.io presence & cursors, Agora voice/video communication, Google Gemini AI code analysis, and self-hosted Judge0 isolated multi-language code execution.
>
> 🎓 **A College Project By [Bharanindra Acharya](https://www.linkedin.com/in/bharanindra-acharya-229887395?utm_source=share_via&utm_content=profile&utm_medium=member_android)**  
> 🌐 **Live Demo:** [https://codeo.duckdns.org](https://codeo.duckdns.org)

This guide provides end-to-end instructions for provisioning a **Google Cloud Platform (GCP) Compute Engine VM**, configuring VPC firewalls, setting up system services, and deploying CodeO with zero downtime and automatic SSL.

---

## 📑 Table of Contents
1. [Architecture Overview](#-architecture-overview)
2. [Prerequisites](#-prerequisites)
3. [Step 1: Create a Google Cloud Compute Engine VM](#step-1-create-a-google-cloud-compute-engine-vm)
4. [Step 2: Reserve a Static External IP Address](#step-2-reserve-a-static-external-ip-address)
5. [Step 3: Configure GCP VPC Firewall Rules](#step-3-configure-gcp-vpc-firewall-rules)
6. [Step 4: Connect to VM & System Preparation](#step-4-connect-to-vm--system-preparation)
7. [Step 5: Install Dependencies (Node.js, Docker, PM2, Nginx)](#step-5-install-dependencies-nodejs-docker-pm2-nginx)
8. [Step 6: Set Up Judge0 Execution Engine](#step-6-set-up-judge0-execution-engine)
9. [Step 7: Deploy CODEO Application](#step-7-deploy-codeo-application)
10. [Step 8: Configure Nginx Reverse Proxy & WebSockets](#step-8-configure-nginx-reverse-proxy--websockets)
11. [Step 9: Set Up Free SSL Certificate (Let's Encrypt)](#step-9-set-up-free-ssl-certificate-lets-encrypt)
12. [Step 10: Useful PM2 & Maintenance Commands](#step-10-useful-pm2--maintenance-commands)
13. [Troubleshooting & Common GCP Issues](#-troubleshooting--common-gcp-issues)

---

## 🏛 Architecture Overview

In production, CodeO runs as a **unified high-performance server** behind an Nginx reverse proxy on your GCP VM:

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

* **Zero CORS issues**: The frontend bundle (`frontend/dist`) is served by Express from the same origin.
* **Isolated Sandbox**: Judge0 runs inside local Docker containers on port 2358 and is never exposed directly to the internet.

---

## 📋 Prerequisites

Before starting, ensure you have:
1. A **Google Cloud Platform** account ([console.cloud.google.com](https://console.cloud.google.com/)) with active billing or the $300 Free Trial.
2. An SSH key pair (or use GCP's one-click browser-based SSH terminal).
3. Your third-party service credentials:
   - **Supabase**: Project URL, Anon Key, Service Role Key (run `supabase_schema.sql` in Supabase SQL Editor).
   - **Google Gemini API**: API Key from [Google AI Studio](https://aistudio.google.com/).
   - **Agora**: App ID and App Certificate from [Agora Console](https://console.agora.io/).
4. *(Optional)* A custom domain name (or use free `sslip.io` hostname: `<your-gcp-ip>.sslip.io`).

---

## Step 1: Create a Google Cloud Compute Engine VM

1. Log in to the [GCP Console](https://console.cloud.google.com/).
2. Select or create a project.
3. Open the navigation menu (top left) ➔ **Compute Engine** ➔ **VM instances**.
4. Click **Create Instance**:
   * **Name**: `codeo-vm`
   * **Region & Zone**: Choose your nearest region (e.g., `us-central1`, `asia-south1`, `europe-west1`).
   * **Machine configuration**:
     * Series: **E2**
     * Machine type:
       * **Recommended**: `e2-medium` (2 vCPUs, 4 GB memory) or `e2-standard-2` (2 vCPUs, 8 GB memory) — optimal for Node.js + Judge0 compilers.
       * *Budget / Free Tier*: `e2-micro` (2 vCPUs, 1 GB memory) — *requires 4GB swap space (covered in Step 4)*.
   * **Boot disk**:
     * Click **Change**
     * Operating system: **Ubuntu**
     * Version: **Ubuntu 22.04 LTS** or **Ubuntu 24.04 LTS**
     * Boot disk type: **Balanced persistent disk**
     * Size: **30 GB to 50 GB**
     * Click **Select**
   * **Firewall**:
     * ✅ Check **Allow HTTP traffic**
     * ✅ Check **Allow HTTPS traffic**
5. Click **Create** and wait 30–60 seconds until the green checkmark appears.

---

## Step 2: Reserve a Static External IP Address

By default, GCP assigns an ephemeral IP address that changes whenever the VM restarts. Make it static so your domain and SSL remain permanent:

1. In the GCP Console, navigate to **VPC network** ➔ **IP addresses** (or search "IP addresses" in the top bar).
2. Find the external IP assigned to your `codeo-vm`.
3. Click the three dots `...` on the right (or click **Reserve static address**).
4. Change the type from **Ephemeral** to **Static**.
5. Name it `codeo-static-ip` and click **Reserve**.

---

## Step 3: Configure GCP VPC Firewall Rules

When you checked "Allow HTTP traffic" and "Allow HTTPS traffic", GCP automatically added the `http-server` and `https-server` network tags to your VM. Verify that port 80 and 443 are open to the internet:

1. Navigate to **VPC network** ➔ **Firewall**.
2. Confirm the following two default rules exist:
   * `default-allow-http` (TCP port 80, source `0.0.0.0/0`)
   * `default-allow-https` (TCP port 443, source `0.0.0.0/0`)
3. If they are missing, click **Create Firewall Rule**:
   * Name: `allow-http-https`
   * Targets: `All instances in the network`
   * Source IPv4 ranges: `0.0.0.0/0`
   * Protocols and ports: Specified protocols ➔ Check `TCP` ➔ Enter `80, 443`
   * Click **Create**.

---

## Step 4: Connect to VM & System Preparation

### 1. Connect via SSH
You can connect in one of two ways:
* **Option A (One-Click Browser SSH)**: On the **VM instances** page in GCP Console, click the **SSH** button next to your instance.
* **Option B (Local Terminal via gcloud)**:
  ```bash
  gcloud compute ssh codeo-vm --zone=<YOUR_VM_ZONE>
  ```
* **Option C (Standard SSH)**:
  ```bash
  ssh -i ~/.ssh/id_rsa username@<YOUR_GCP_STATIC_IP>
  ```

### 2. Configure 4GB Swap Space
Swap memory is essential on cloud VMs to prevent compiler spikes or out-of-memory errors during builds:
```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## Step 5: Install Dependencies (Node.js, Docker, PM2, Nginx)

Run the following commands inside your GCP VM terminal:

```bash
# 1. Update system packages
sudo apt update && sudo apt upgrade -y

# 2. Install essential build tools & Git
sudo apt install -y git curl wget unzip build-essential software-properties-common

# 3. Install Docker & Docker Compose
sudo apt install -y docker.io docker-compose
sudo systemctl enable --now docker
sudo usermod -aG docker $USER

# 4. Install Node.js 22 LTS (Required for native WebSocket & modern Supabase SDK)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Verify Node and npm
node -v  # v22.x.x
npm -v   # v10.x.x / v11.x.x

# 5. Install PM2 process manager globally
sudo npm install -g pm2

# 6. Install Nginx and Certbot
sudo apt install -y nginx certbot python3-certbot-nginx
```

---

## Step 6: Set Up Judge0 Execution Engine

CodeO can run code via a self-hosted Judge0 instance or via RapidAPI.

### Option A: Self-Hosted Judge0 Docker Engine (Recommended)
```bash
mkdir -p ~/judge0 && cd ~/judge0
wget https://github.com/judge0/judge0/releases/download/v1.13.1/judge0-v1.13.1.zip
unzip judge0-v1.13.1.zip

# Generate secure random passwords
sed -i "s/YOUR_POSTGRES_PASSWORD/$(openssl rand -hex 16)/g" judge0.conf
sed -i "s/YOUR_REDIS_PASSWORD/$(openssl rand -hex 16)/g" judge0.conf

# Start Judge0 background services
sudo docker-compose up -d db redis
sleep 10
sudo docker-compose up -d

# Verify Judge0 is running on localhost:2358
curl http://localhost:2358/api/v1/about
# Should return JSON with version 1.13.1
```

### Option B: RapidAPI Judge0 (Cloud Alternative)
If you prefer not to run Judge0 in Docker:
1. Subscribe to Judge0 on [RapidAPI](https://rapidapi.com/hermanzdosilovic/api/judge0-ce).
2. Set in `backend/.env`:
   ```env
   JUDGE0_URL=https://judge0-ce.p.rapidapi.com
   RAPIDAPI_KEY=your_rapidapi_key
   ```

---

## Step 7: Deploy CODEO Application

### 1. Clone the Repository
```bash
cd ~
git clone https://github.com/Bwizard-z/CodeO-Prod.git codeo
cd codeo
```

### 2. Configure Production Environment Variables
Create the backend `.env`:
```bash
cp backend/.env.example backend/.env
nano backend/.env
```

Paste your production credentials:
```env
PORT=5000
NODE_ENV=production

# Your domain or sslip.io address (No trailing slash)
CLIENT_URL=https://codeo.yourdomain.com
# Example using sslip.io if you do not have a custom domain:
# CLIENT_URL=https://34.120.xx.xx.sslip.io

# Supabase Credentials
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_KEY=your-supabase-service-role-key

# Judge0 Execution Engine (points to local Docker)
JUDGE0_URL=http://localhost:2358/api/v1
# If using RapidAPI:
# JUDGE0_URL=https://judge0-ce.p.rapidapi.com
# RAPIDAPI_KEY=your-rapidapi-key

# Google Gemini AI
GEMINI_API_KEY=your-gemini-api-key

# Agora Voice & Video Chat
AGORA_APP_ID=your-agora-app-id
AGORA_APP_CERTIFICATE=your-agora-app-certificate
```

Create the frontend environment file:
```bash
nano frontend/.env.local
```
Add:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_AGORA_APP_ID=your-agora-app-id
```

### 3. Install Dependencies & Build Frontend
```bash
# If cloned on Linux after Windows development, ensure platform binaries are fetched:
rm -rf package-lock.json node_modules frontend/node_modules backend/node_modules

# Install all root, backend, and frontend dependencies
npm install

# Build optimized production React SPA into frontend/dist
npm run build
```

Verify that `frontend/dist/index.html` exists:
```bash
ls -l frontend/dist
```

### 4. Start Application with PM2
```bash
# Start unified server with PM2
pm2 start backend/server.js --name codeo

# Save current PM2 processes
pm2 save

# Setup PM2 systemd startup hook for automatic restart upon VM reboot
pm2 startup
# (Run the sudo command that PM2 prints on screen)

# Ensure Judge0 Docker containers auto-restart on VM reboot
sudo docker update --restart always $(sudo docker ps -q)
```

Check server status:
```bash
pm2 status
pm2 logs codeo --lines 20
```

---

## Step 8: Configure Nginx Reverse Proxy & WebSockets

Nginx forwards external web traffic to Node.js, handles SSL termination, and proxies WebSocket connections (`/socket.io` and `/yjs`).

### 1. Create Nginx Configuration
```bash
sudo nano /etc/nginx/sites-available/codeo
```

Replace `codeo.yourdomain.com` with your actual domain name (or `<YOUR_GCP_STATIC_IP>.sslip.io`):

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

### 2. Enable Site and Restart Nginx
```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/codeo /etc/nginx/sites-enabled/

# Remove default site if present
sudo rm -f /etc/nginx/sites-enabled/default

# Test configuration syntax
sudo nginx -t

# Reload Nginx
sudo systemctl restart nginx
```

---

## Step 9: Set Up Free SSL Certificate (Let's Encrypt)

Certbot will automatically provision an SSL certificate and configure HTTPS in Nginx.

```bash
# Obtain and install SSL certificate
sudo certbot --nginx -d codeo.yourdomain.com
```
*(Choose to redirect HTTP to HTTPS when prompted).*

Certbot also configures an automatic renewal timer. Test it:
```bash
sudo certbot renew --dry-run
```

---

## Step 10: Useful PM2 & Maintenance Commands

### Monitoring & Managing CodeO
```bash
# View real-time application logs
pm2 logs codeo

# Monitor CPU & Memory usage live
pm2 monit

# Restart the application
pm2 restart codeo

# Stop the application
pm2 stop codeo
```

### Updating CodeO to the Latest Code
Whenever you push updates to GitHub, deploy them in 3 commands:
```bash
cd ~/codeo
git pull origin main
npm install
npm run build
pm2 reload codeo
```

---

## 🔍 Troubleshooting & Common GCP Issues

### 1. Website times out / Port 80 & 443 inaccessible
* **Cause**: GCP VPC Firewall rules or network tags are missing.
* **Fix**:
  1. Go to GCP Console ➔ **VPC network** ➔ **Firewall**.
  2. Ensure rules allow TCP ports `80, 443` with source `0.0.0.0/0`.
  3. Ensure your VM instance has the `http-server` and `https-server` network tags assigned.

### 2. WebSocket connection failed (`/yjs` or `/socket.io`)
* **Cause**: Missing `Upgrade` headers or proxy timeout in Nginx.
* **Fix**: Ensure your Nginx configuration contains:
  ```nginx
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_read_timeout 86400s;
  ```
  Then reload: `sudo nginx -s reload`.

### 3. Build fails with `JavaScript heap out of memory` during `npm run build`
* **Cause**: VM ran out of physical RAM during Vite compilation.
* **Fix**: Ensure your 4GB swap space is enabled (`free -h`). You can also allocate more memory to Node:
  ```bash
  NODE_OPTIONS="--max-old-space-size=2048" npm run build
  ```

### 4. 502 Bad Gateway
* **Cause**: Node.js backend is not running or crashed.
* **Fix**: Check PM2 logs:
  ```bash
  pm2 logs codeo --err
  ```
  Verify if port 5000 is listening:
  ```bash
  sudo ss -tulpn | grep 5000
  ```

### 5. Judge0 returns 500 or Connection Refused
* **Fix**: Ensure Docker containers are running:
  ```bash
  cd ~/judge0 && sudo docker-compose ps
  ```
  Restart containers if stopped:
  ```bash
  sudo docker-compose up -d
  ```

---

## 🔒 Security Best Practices for GCP VM

1. **Keep Operating System Updated**:
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```
2. **Install Fail2ban**:
   ```bash
   sudo apt install -y fail2ban
   sudo systemctl enable --now fail2ban
   ```
3. **Database Security**:
   Always run Supabase queries through row-level security (RLS) policies defined in `supabase_schema.sql`. Keep `SUPABASE_SERVICE_KEY` strictly inside `backend/.env` and never expose it on the frontend.

---

🎉 **Congratulations! Your CodeO studio is now live and running on Google Cloud Platform with SSL and WebSockets!**
