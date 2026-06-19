# Pterodactyl Panel — Colyseus Server Deployment Guide

This guide covers deploying the `packages/server` Colyseus server to a Pterodactyl Panel, and connecting it to the Vercel-hosted client.

---

## Architecture Overview

```
Discord Client (iframe)
        │
        │  WebSocket + HTTP
        ▼
Vercel (packages/client)      ←── auto-deploys from git
        │
        │  wss://goatpanel.duckdns.org:PORT
        ▼
Pterodactyl Panel (packages/server)   ←── you deploy manually
```

---

## Step 1 — Set up the Pterodactyl Egg

Use the **Generic: Node.js** egg (or any Node.js egg in your panel).

**Recommended egg settings:**

| Setting | Value |
|---------|-------|
| Docker Image | `ghcr.io/pterodactyl/yolks:nodejs_20` |
| Start Command | `npm run serve` |
| Install Script | `npm install --ignore-engines && npm run build` |
| Stop Command | `^C` (sends SIGINT — server shuts down gracefully) |

> **Why `npm run serve` not `npm run start`?**
> `start` rebuilds every time (slow). We build once during install, then `serve` just runs the pre-built `dist/server.js`. Much faster restarts.

---

## Step 2 — Environment Variables (Pterodactyl → Startup tab)

Set these in your server's **Startup → Variables** section:

| Variable | Value | Notes |
|----------|-------|-------|
| `PORT` | `3002` | Match the port exposed in your egg |
| `NODE_ENV` | `production` | Required — enables prod optimizations |
| `VITE_CLIENT_ID` | `123456789012345678` | From Discord Developer Portal |
| `CLIENT_SECRET` | `your_secret_here` | From Discord Developer Portal. Mark as **hidden**. |
| `CORS_ORIGIN` | `https://your-app.vercel.app` | Optional but recommended. Your Vercel URL. |

---

## Step 3 — SSL / HTTPS (Required for Discord Activities)

Discord Activities run inside HTTPS iframes. WebSocket connections **must** use `wss://` (secure). Your Pterodactyl server port must be accessible via HTTPS.

### Option A — Cloudflare Tunnel (Recommended, Free, Zero Port-Forwarding)

1. Install `cloudflared` on the machine running Pterodactyl.
2. Create a tunnel:
   ```bash
   cloudflared tunnel create winxp-server
   cloudflared tunnel route dns winxp-server server.yourdomain.com
   ```
3. Configure `~/.cloudflared/config.yml`:
   ```yaml
   tunnel: <YOUR_TUNNEL_ID>
   credentials-file: /root/.cloudflared/<YOUR_TUNNEL_ID>.json

   ingress:
     - hostname: server.yourdomain.com
       service: http://localhost:3002
     - service: http_status:404
   ```
4. Run: `cloudflared tunnel run winxp-server`
5. Your server is now at `https://server.yourdomain.com` — no cert setup needed.

### Option B — Nginx Reverse Proxy + Let's Encrypt

```nginx
server {
    listen 443 ssl;
    server_name goatpanel.duckdns.org;

    ssl_certificate     /etc/letsencrypt/live/goatpanel.duckdns.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/goatpanel.duckdns.org/privkey.pem;

    location / {
        proxy_pass         http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade    $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host       $host;
        proxy_set_header   X-Real-IP  $remote_addr;
        proxy_read_timeout 86400;   # keep WebSocket connections alive
    }
}
```

Get a cert: `certbot --nginx -d goatpanel.duckdns.org`

### Option C — Caddy (Simplest, Auto-SSL)

```caddyfile
goatpanel.duckdns.org {
    reverse_proxy localhost:3002 {
        header_up Upgrade {http.request.header.Upgrade}
        header_up Connection {http.request.header.Connection}
    }
}
```

Run: `caddy run --config /etc/caddy/Caddyfile`

---

## Step 4 — Connect Vercel to Pterodactyl

In **Vercel → Project → Settings → Environment Variables**, add:

| Variable | Value |
|----------|-------|
| `VITE_SERVER_URL` | `https://goatpanel.duckdns.org:3002` |
| `VITE_CLIENT_ID` | `your_discord_client_id` |

> `VITE_SERVER_URL` is baked into the client bundle at build time. The client will connect directly to Pterodactyl with no extra round-trips. This is the production fast path.

After setting these, **trigger a new Vercel deployment** (push any commit, or use the "Redeploy" button).

---

## Step 5 — Verify It's Working

### Test the server health endpoint

```bash
curl https://goatpanel.duckdns.org:3002/health
# Expected: {"ok":true,"uptime":42,"env":"production"}
```

### Test WebSocket connection

```bash
# Install wscat: npm install -g wscat
wscat -c wss://goatpanel.duckdns.org:3002
# Should connect (will close immediately — that's fine)
```

### Test in the game

Open your Vercel deployment → Game Menu. The connection status dot should turn **green** within 2 seconds.

---

## Deploying Updates

Whenever you update `packages/server`:

1. Upload the updated files to the Pterodactyl file manager (or use SFTP).
2. In the Console tab, run:
   ```
   npm run build
   ```
3. Restart the server from the panel.

> No Vercel redeploy needed unless you changed the client code.

---

## Monitoring

The Colyseus admin monitor is available at:
```
https://goatpanel.duckdns.org:3002/colyseus
```

This shows active rooms, connected clients, CPU/memory usage, and message throughput in real time.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Connection dot stays red | Server unreachable / CORS | Check `/health` endpoint manually |
| `Mixed Content` browser error | Server not on HTTPS | Complete Step 3 (SSL setup) |
| WebSocket closes immediately | Port not exposed in egg | Check Pterodactyl egg port config |
| `SIGTERM` kills server hard | Old server code | Make sure you deployed the latest `server.ts` with graceful shutdown |
| Players can't see each other | Wrong room filter | Ensure both clients join the same `channelId` |
| `/colyseus` monitor 404 | Router not mounted | Check `NODE_ENV=production` is set |

---

## File Locations

```
packages/server/
├── src/server.ts          ← Express + Colyseus setup
├── src/rooms/GameRoom.ts  ← Room logic (chat, cursors, notes)
├── src/schemas/           ← Colyseus state schemas
├── dist/                  ← Built output (auto-generated by npm run build)
├── .env.example           ← Template for environment variables
└── package.json           ← Scripts: build / serve / start / dev
```
