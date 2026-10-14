# 🚀 CODEO - Oracle Cloud Free Tier VPS Setup & Deployment Guide

> **CodeO** is a real-time collaborative code editor and development studio featuring live Yjs document sync, Monaco editor, Socket.io presence, Agora voice & video chat, Gemini AI explanations, and Judge0 code execution.

This guide provides end-to-end instructions for provisioning an **Oracle Cloud Infrastructure (OCI) Always Free Tier VPS**, configuring firewalls, setting up system services, and deploying CodeO with zero downtime and automatic SSL.

---

## 📑 Table of Contents
1. [Architecture Overview](#-architecture-overview)
2. [Prerequisites](#-prerequisites)
3. [Step 1: Provision Oracle Cloud Free Tier VPS](#step-1-provision-oracle-cloud-free-tier-vps)
4. [Step 2: Configure Oracle Cloud Firewall & Networking (CRITICAL)](#step-2-configure-oracle-cloud-firewall--networking-critical)
5. [Step 3: Connect & Initialize VPS](#step-3-connect--initialize-vps)
6. [Step 4: Install Dependencies (Node.js, Docker, PM2, Nginx)](#step-4-install-dependencies-nodejs-docker-pm2-nginx)
7. [Step 5: Set Up Judge0 Execution Engine](#step-5-set-up-judge0-execution-engine)
8. [Step 6: Deploy CODEO Application](#step-6-deploy-codeo-application)
9. [Step 7: Configure Nginx Reverse Proxy & WebSockets](#step-7-configure-nginx-reverse-proxy--websockets)
10. [Step 8: Set Up Free SSL Certificate (Let's Encrypt)](#step-8-set-up-free-ssl-certificate-lets-encrypt)
11. [Step 9: Useful PM2 & Maintenance Commands](#step-9-useful-pm2--maintenance-commands)
12. [Troubleshooting & Common Oracle Cloud Issues](#-troubleshooting--common-oracle-cloud-issues)

---

## 🏛 Architecture Overview

In production, CodeO runs as a **unified high-performance server** behind an Nginx reverse proxy:

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
* **Isolated Execution**: Judge0 runs inside local Docker containers on port 2358 and is never exposed directly to the internet.

---

## 📋 Prerequisites

Before starting, ensure you have:
1. An **Oracle Cloud Free Tier** account ([cloud.oracle.com](https://cloud.oracle.com/)).
2. An SSH key pair on your local machine (`ssh-keygen -t ed25519` or `id_rsa`).
3. Your third-party service credentials:
   - **Supabase**: Project URL, Anon Key, Service Role Key (run `supabase_schema.sql` in Supabase SQL Editor).
   - **Google Gemini API**: API Key from [Google AI Studio](https://aistudio.google.com/).
   - **Agora**: App ID and App Certificate from [Agora Console](https://console.agora.io/).
4. *(Optional)* A domain name pointed to your VPS (or use free `sslip.io` hostname: `<your-ip>.sslip.io`).

---

## Step 1: Provision Oracle Cloud Free Tier VPS

Oracle Cloud provides one of the most generous Always Free computing tiers in the industry.

### 1. Create Compute Instance
1. Log in to the [Oracle Cloud Console](https://cloud.oracle.com/).
2. Open the navigation menu (top left) ➔ **Compute** ➔ **Instances** ➔ **Create Instance**.
3. Configure the instance:
   * **Name**: `codeo-vps`
   * **Placement**: Leave default Availability Domain.
   * **Image**: Click **Change image** ➔ Select **Canonical Ubuntu** ➔ Choose **Ubuntu 22.04 LTS** or **Ubuntu 24.04 LTS**.
   * **Shape**: Click **Change shape**:
     * **Recommended (Ampere ARM64)**: Select **Ampere** ➔ **VM.Standard.A1.Flex** ➔ Set **2 to 4 OCPUs** and **12 to 24 GB RAM** (Always Free eligible!).
     * *Alternative (AMD x86)*: **VM.Standard.E2.1.Micro** (1/8 OCPU, 1 GB RAM - *Requires 4GB swap to run smoothly*).
   * **Networking**:
     * Create a new Virtual Cloud Network (VCN) or select existing.
     * Select **Assign a public IPv4 address**.
   * **Add SSH Keys**: Select **Upload public key files (.pub)** or paste your local public key (`~/.ssh/id_ed25519.pub` or `~/.ssh/id_rsa.pub`).
   * **Boot Volume**: Default (50 GB - 100 GB Always Free).
4. Click **Create** and wait 1–2 minutes until the status becomes **Running**.

### 2. (Recommended) Assign a Reserved Public IP
By default, ephemeral IPs change if the instance is terminated or rebuilt:
1. In the instance details page, click on your **Primary VNIC**.
2. Click **IPv4 Addresses** on the left menu.
3. Click the three dots `...` next to the assigned public IP ➔ **Edit**.
4. Change IP type to **No Public IP**, then update.
5. Edit again, choose **Reserved Public IP** ➔ **Create a new Reserved IP** ➔ Name it `codeo-reserved-ip`.

---

## Step 2: Configure Oracle Cloud Firewall & Networking (CRITICAL)

> ⚠️ **IMPORTANT**: Oracle Cloud has **TWO separate firewalls**:
> 1. Cloud-level Virtual Cloud Network (VCN) Security Lists.
> 2. OS-level `iptables` / `ufw` inside the Ubuntu virtual machine.
>
> If you do not configure **both**, port 80 and 443 will be blocked and your website will timeout!

### Part A: Oracle VCN Ingress Rules (Cloud Console)
1. In the OCI Console, navigate to **Networking** ➔ **Virtual Cloud Networks**.
2. Click your VCN ➔ Click **Security Lists** ➔ Click **Default Security List for `<your-vcn>`**.
3. Under **Ingress Rules**, click **Add Ingress Rules**:
   * **Rule 1 (HTTP)**:
     * Source CIDR: `0.0.0.0/0`
     * IP Protocol: `TCP`
     * Destination Port Range: `80`
     * Description: `Allow HTTP traffic`
   * **Rule 2 (HTTPS)**:
     * Source CIDR: `0.0.0.0/0`
     * IP Protocol: `TCP`
     * Destination Port Range: `443`
     * Description: `Allow HTTPS traffic`
4. Click **Add Ingress Rules**.

---

## Step 3: Connect & Initialize VPS

### 1. SSH into the Instance
On your local terminal (PowerShell, macOS, or Linux):
```bash
ssh -i ~/.ssh/id_ed25519 ubuntu@<YOUR_VPS_PUBLIC_IP>
```

### 2. Open Ubuntu OS-Level Firewall (Iptables / UFW)
Oracle's default Ubuntu images install strict `iptables` rules that drop all non-SSH inbound traffic. Run these commands to permanently allow ports 80 and 443:

```bash
# Allow HTTP, HTTPS, and SSH via iptables
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT

# Save iptables rules so they persist across reboots
sudo apt update && sudo apt install -y iptables-persistent netfilter-persistent
sudo netfilter-persistent save
sudo netfilter-persistent reload

# (Optional) If UFW is active:
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload
```

### 3. Create 4GB Swap Space
Swap prevents build crashes and out-of-memory errors:
```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## Step 4: Install Dependencies (Node.js, Docker, PM2, Nginx)

Run the following commands on the VPS:

```bash
# 1. Update system packages
sudo apt update && sudo apt upgrade -y

# 2. Install essential build tools & Git
sudo apt install -y git curl wget unzip build-essential software-properties-common

# 3. Install Docker & Docker Compose
sudo apt install -y docker.io docker-compose
sudo systemctl enable --now docker
sudo usermod -aG docker $USER

# 4. Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify Node and npm
node -v  # v20.x.x
npm -v   # v10.x.x

# 5. Install PM2 (Process Manager) globally
sudo npm install -g pm2

# 6. Install Nginx and Certbot
sudo apt install -y nginx certbot python3-certbot-nginx
```

---

## Step 5: Set Up Judge0 Execution Engine

CodeO can run code via a self-hosted Judge0 instance or via RapidAPI.

### Option A: Self-Hosted Judge0 (x86 or ARM with emulation)
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

> 💡 *Note on ARM64 (Ampere A1)*: If running on Ampere ARM64 and you encounter architecture errors with Judge0 x86_64 binaries, install QEMU user emulation:
> ```bash
> sudo apt install -y qemu-user-static binfmt-support
> ```
> Or use **Option B** (RapidAPI Judge0) below.

### Option B: RapidAPI Judge0 (Cloud Alternative)
If you prefer not to self-host Dockerized Judge0:
1. Subscribe to Judge0 on [RapidAPI](https://rapidapi.com/hermanzdosilovic/api/judge0-ce).
2. Set in `backend/.env`:
   ```env
   JUDGE0_URL=https://judge0-ce.p.rapidapi.com
   RAPIDAPI_KEY=your_rapidapi_key
   ```

---

## Step 6: Deploy CODEO Application

### 1. Clone the Repository
```bash
cd ~
git clone https://github.com/YOUR_GITHUB_USERNAME/codeo.git
cd codeo
```

### 2. Configure Environment Variables
Create the production backend `.env`:
```bash
cp backend/.env.example backend/.env
nano backend/.env
```

Paste and adjust your configuration:
```env
PORT=5000
NODE_ENV=production

# Your domain or sslip.io address (No trailing slash)
CLIENT_URL=https://codeo.yourdomain.com
# Example with sslip.io if you do not own a domain:
# CLIENT_URL=https://129.153.xx.xx.sslip.io

# Supabase Credentials
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_KEY=your-supabase-service-role-key

# Judge0 Execution Engine
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

Create the frontend production environment file:
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
# Install all root, backend, and frontend packages
npm install

# Build the production React SPA bundle into frontend/dist
npm run build
```

Verify that `frontend/dist/index.html` exists:
```bash
ls -l frontend/dist
```

### 4. Start Application with PM2
```bash
# Start backend server (which also serves frontend/dist)
pm2 start backend/server.js --name codeo

# Save the PM2 list
pm2 save

# Setup PM2 systemd startup hook so it starts automatically upon VPS reboot
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

Check server status:
```bash
pm2 status
pm2 logs codeo --lines 20
```

---

## Step 7: Configure Nginx Reverse Proxy & WebSockets

Nginx forwards public requests to Node.js, terminates SSL, handles WebSocket upgrades, and limits request rates.

### 1. Create Nginx Configuration
```bash
sudo nano /etc/nginx/sites-available/codeo
```

Replace `codeo.yourdomain.com` with your actual domain name (or `<YOUR_VPS_IP>.sslip.io`):

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

### 2. Enable Site and Test Configuration
```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/codeo /etc/nginx/sites-enabled/

# Remove default Nginx site if present
sudo rm -f /etc/nginx/sites-enabled/default

# Test configuration for syntax errors
sudo nginx -t

# Reload Nginx
sudo systemctl restart nginx
```

---

## Step 8: Set Up Free SSL Certificate (Let's Encrypt)

Certbot will automatically obtain an SSL certificate and configure HTTPS in Nginx.

```bash
# Obtain and install SSL certificate
sudo certbot --nginx -d codeo.yourdomain.com
```
*(Choose redirect HTTP to HTTPS when prompted).*

Certbot also configures an automatic renewal cron job. Test it:
```bash
sudo certbot renew --dry-run
```

---

## Step 9: Useful PM2 & Maintenance Commands

### Monitoring & Managing CodeO
```bash
# View real-time logs
pm2 logs codeo

# Monitor CPU & Memory usage
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

## 🔍 Troubleshooting & Common Oracle Cloud Issues

### 1. Website times out / Port 80 & 443 inaccessible
* **Cause**: Oracle VCN Ingress Rules or guest OS `iptables` are blocking traffic.
* **Fix**:
  1. Confirm OCI Console ➔ VCN ➔ Security Lists has Ingress Rules for ports 80 and 443 with source `0.0.0.0/0`.
  2. Run `sudo iptables -L -n -v` on your VPS. If default policies drop traffic, run:
     ```bash
     sudo iptables -I INPUT 1 -p tcp --dport 80 -j ACCEPT
     sudo iptables -I INPUT 1 -p tcp --dport 443 -j ACCEPT
     sudo netfilter-persistent save
     ```

### 2. WebSocket connection failed (`/yjs` or `/socket.io`)
* **Cause**: Missing `Upgrade` headers or reverse proxy timeout in Nginx.
* **Fix**: Ensure your Nginx configuration contains:
  ```nginx
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_read_timeout 86400s;
  ```
  Then reload Nginx: `sudo nginx -s reload`.

### 3. Build fails with `JavaScript heap out of memory` during `npm run build`
* **Cause**: VPS ran out of physical RAM.
* **Fix**: Ensure your 4GB swap space is enabled (`free -h`). You can also allocate more memory to Node:
  ```bash
  NODE_OPTIONS="--max-old-space-size=2048" npm run build
  ```

### 4. 502 Bad Gateway
* **Cause**: Node.js backend is not running or crashed.
* **Fix**: Check PM2 logs to diagnose:
  ```bash
  pm2 logs codeo --err
  ```
  Verify if port 5000 is listening:
  ```bash
  sudo netstat -tlpn | grep 5000
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

## 🔒 Security Best Practices for Oracle Cloud VPS

1. **Disable SSH Password Authentication**:
   Ensure `/etc/ssh/sshd_config` has `PasswordAuthentication no`.
2. **Set up Fail2ban**:
   ```bash
   sudo apt install -y fail2ban
   sudo systemctl enable --now fail2ban
   ```
3. **Database Security**:
   Always run Supabase queries through row-level security (RLS) policies defined in `supabase_schema.sql`. Keep `SUPABASE_SERVICE_KEY` strictly inside `backend/.env` and never expose it on the frontend.
4. **Regular Updates**:
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

---

🎉 **Congratulations! Your CodeO studio is now live and running on Oracle Cloud Always Free VPS with SSL and WebSockets!**
