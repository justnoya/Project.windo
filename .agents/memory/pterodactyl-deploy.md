---
name: Pterodactyl Deployment
description: How the server connects to Pterodactyl and what env vars are needed for production.
---

# Pterodactyl Deployment Pattern

## Connection priority in serverConnect.ts

1. `VITE_SERVER_URL` (baked at Vercel build time) → instant, zero round-trips
2. `localhost` → direct to port 3001 (local dev)
3. `/config` endpoint probe → fallback for staging/Replit

**Why:** VITE_ prefix means Vite bakes it into the bundle. No fetch() needed in prod.

## Key env vars

- Vercel: `VITE_SERVER_URL=https://goatpanel.duckdns.org:3002`
- Pterodactyl: `PORT`, `NODE_ENV=production`, `VITE_CLIENT_ID`, `CLIENT_SECRET`, optional `CORS_ORIGIN`

## Pterodactyl startup commands

- Install: `npm install --ignore-engines && npm run build`
- Start: `npm run serve` (NOT `npm run start` — avoids rebuilding on every restart)

## SSL requirement

Discord Activities = HTTPS iframe = all connections must be wss://. Server needs SSL.
Options: Cloudflare Tunnel (easiest), Caddy, or Nginx + Let's Encrypt. See PTERODACTYL.md.

## gracefullyShutdown

`gameServer.gracefullyShutdown(true)` — takes one boolean arg only. Second arg must be Error type (not number), so just pass true.
