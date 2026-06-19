---
name: Project Stack
description: Discord Activity monorepo - client Vite/TS, server Colyseus/Express.
---

# Project Stack

**Client:** `packages/client` — Vite + TypeScript + Phaser 3. Deploys to Vercel. Windows XP-themed DOM overlay on top of Phaser canvas.

**Server:** `packages/server` — Colyseus + Express + TypeScript. Hosted on Pterodactyl Panel at goatpanel.duckdns.org:3002. Uses `--ignore-engines` (Node 20, requires 22 but works fine).

**Key patterns:**
- All XP windows built with `makeDesktopIconImg` / `makeDesktopIcon` factory methods
- Windows tracked in `this.wins` Map, taskbar buttons in `this.tbBtns`
- CSS cursor selectors must be updated when adding new interactive button classes
- Sound via `SoundManager.windowOpen()`, `SoundManager.click()`

**Server npmrc:** `engine-strict=false` in `packages/server/.npmrc`
