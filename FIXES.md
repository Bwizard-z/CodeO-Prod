# 🛠️ CodeO Production Troubleshooting & Fixes Playbook

This document serves as an operational troubleshooting guide for production deployment, debugging, and recovery of the **CodeO** platform and its supporting microservices (**Node.js Backend**, **Judge0 Engine**, **Nginx**, and **Supabase**).

---

## 📌 Issue 1: Code Execution Error — *"Program finished with no output"* / Status 13 (Internal Error)

### Symptoms:
* The web editor's terminal displays `(!) Error` in red with:  
  `Program finished with no output.`
* Checking Judge0 directly via curl:
  ```bash
  curl -X POST "http://localhost:2358/submissions?wait=true" \
    -H "Content-Type: application/json" \
    -d '{"source_code": "print(12345)", "language_id": 71}'
  ```
  Returns:
  ```json
  {
    "message": "No such file or directory @ rb_sysopen - /box/script.py",
    "status": { "id": 13, "description": "Internal Error" }
  }
  ```
* Checking Docker logs with `sudo docker logs --tail 30 judge0-v1131_server_1` shows:
  ```text
  Failed to create control group /sys/fs/cgroup/memory/box-XX/: No such file or directory
  chown: cannot access '/box': No such file or directory
  ```

### Root Cause:
Judge0's sandboxing mechanism (`isolate`) strictly requires **Linux cgroups v1** (specifically the memory controller `/sys/fs/cgroup/memory`). Modern Ubuntu distributions (22.04 LTS / 24.04 LTS on Google Cloud / AWS) boot with **cgroups v2** unified hierarchy by default, which causes sandbox creation to fail.

### Solution:
1. **Enable cgroups v1 in GRUB on the Linux Host:**
   ```bash
   echo 'GRUB_CMDLINE_LINUX="systemd.unified_cgroup_hierarchy=0"' | sudo tee /etc/default/grub.d/99-cgroup.cfg
   sudo update-grub
   sudo reboot
   ```
2. **Wait 30 seconds for the VM to reboot, reconnect via SSH, and verify Judge0:**
   ```bash
   curl -X POST "http://localhost:2358/submissions?wait=true" \
     -H "Content-Type: application/json" \
     -d '{"source_code": "print(12345)", "language_id": 71}'
   ```
   *Expected Output:*
   ```json
   {"stdout":"12345\n","time":"0.03","memory":8376,"status":{"id":3,"description":"Accepted"}}
   ```
3. **Restart the CodeO application in PM2:**
   ```bash
   cd ~/codeo
   pm2 start backend/server.js --name codeo
   pm2 save
   ```

---

## 📌 Issue 2: Infinite Loading Spinner & *"timeout of 15000ms exceeded"*

### Symptoms:
* The webpage hangs indefinitely on:  
  *"Loading your workspace..."*
* Browser DevTools Console shows:  
  `AxiosError: timeout of 15000ms exceeded`

### Root Causes:
1. **Testing Multiple Accounts in the Same Browser Window:**  
   Supabase uses `localStorage` to store the active authentication token. Opening multiple tabs in the same regular browser window causes accounts to overwrite each other's session tokens, causing auth locks and infinite token refresh loops.
2. **Sequential Database Queries Under Load:**  
   `roomService.js` was querying the room, host, and members sequentially, adding delay under high concurrent loads.
3. **Nginx Rate-Limiting:**  
   Opening multiple tabs simultaneously bursts 80–120+ asset requests from the same IP address, triggering Nginx's `burst=60` limit.

### Solutions:
1. **Testing Best Practice:**  
   When pair-programming or testing multiple user accounts on one computer, always isolate sessions:
   * **User 1:** Normal Chrome Window
   * **User 2:** Chrome Incognito / Private Window
   * **User 3:** Microsoft Edge, Firefox, or a separate Chrome profile
2. **Codebase Optimizations Applied:**
   * **API Timeout:** Increased from `15000ms` to `30000ms` in `frontend/src/services/api.js`.
   * **Auth Interceptor Safeguard:** Wrapped `supabase.auth.getSession()` in a 2.5s `Promise.race` timeout to prevent localStorage lock contention.
   * **Parallelized Queries:** Implemented `Promise.all` in `backend/services/roomService.js` for room members and host queries.
3. **Nginx Burst & Connection Adjustments:**
   In `/etc/nginx/sites-available/codeo`:
   ```nginx
   location / {
       limit_conn codeo_conn 80;
       limit_req zone=codeo_req burst=150 nodelay;
       ...
   ```
   Reload Nginx:
   ```bash
   sudo nginx -t && sudo systemctl reload nginx
   ```

---

## 📌 Issue 3: PM2 Process Missing After Server Reboot

### Symptoms:
* Running `pm2 status` shows an empty list after a VM reboot.
* The frontend loads, but API requests return `502 Bad Gateway` from Nginx.

### Solution:
1. **Start the CodeO application:**
   ```bash
   cd ~/codeo
   pm2 start backend/server.js --name codeo
   ```
2. **Save the current list for automatic restoration on boot:**
   ```bash
   pm2 save
   ```
3. **Register PM2 system startup hook (only needed once):**
   ```bash
   pm2 startup
   ```
   *(Run the exact `sudo env PATH=...` command that PM2 prints in the terminal).*

---

## 📌 Issue 4: Judge0 Docker Containers Stopped

### Symptoms:
* Running `sudo docker ps` shows no containers or fewer than 4 containers running.
* API calls to code execution return `connect ECONNREFUSED 127.0.0.1:2358`.

### Solution:
Restart the entire Judge0 Docker compose stack:
```bash
cd ~/judge0
sudo docker-compose down -v
sudo docker-compose up -d
```
Verify all 4 containers are marked `Up`:
* `judge0-v1131_server_1`
* `judge0-v1131_workers_1`
* `judge0-v1131_db_1`
* `judge0-v1131_redis_1`

---

## 🚀 Quick Health Check Cheat Sheet

Run these anytime to check health on the VPS:

```bash
# 1. Check CodeO Node.js backend
pm2 status
pm2 logs codeo --lines 30

# 2. Check Judge0 Docker containers
sudo docker ps

# 3. Test Judge0 execution directly
curl -X POST "http://localhost:2358/submissions?wait=true" \
  -H "Content-Type: application/json" \
  -d '{"source_code": "print(100+1)", "language_id": 71}'

# 4. Check Nginx logs for blocks or rate-limits
sudo tail -n 30 /var/log/nginx/error.log
```
