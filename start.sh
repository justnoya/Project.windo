#!/bin/bash
set -e

echo ""
echo "========================================="
echo "  Windows XP Activity — Pterodactyl Boot"
echo "========================================="
echo ""

# ── Install server deps ──────────────────────
echo "[1/4] Installing server dependencies..."
cd packages/server
npm install --no-audit --no-fund --ignore-engines
echo "      Done."
cd ../..

# ── Build server ─────────────────────────────
echo "[2/4] Building server (TypeScript)..."
cd packages/server
npm run build
echo "      Done."
cd ../..

# ── Build client ─────────────────────────────
echo "[3/4] Building client (Vite)..."
cd packages/client
npm install --no-audit --no-fund --ignore-engines
npm run build
echo "      Done."
cd ../..

# ── Start ────────────────────────────────────
echo "[4/4] Starting server on port ${PORT:-3000}..."
echo ""
NODE_ENV=production PORT=${PORT:-3000} node packages/server/dist/server.js
