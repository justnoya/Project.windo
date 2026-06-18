#!/bin/bash
set -e

echo ""
echo "========================================="
echo "  Windows XP Activity — Pterodactyl Boot"
echo "========================================="
echo ""

# ── Install production dependencies only ─────
echo "[1/2] Installing server dependencies..."
cd packages/server
npm install --omit=dev --no-audit --no-fund
echo "      Done."
cd ../..

# ── Start ─────────────────────────────────────
echo "[2/2] Starting server on port ${PORT:-3000}..."
echo ""
NODE_ENV=production PORT=${PORT:-3000} node packages/server/dist/server.js
