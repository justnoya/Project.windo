#!/bin/bash
set -e

echo ""
echo "========================================="
echo "  Windows XP Activity — Pterodactyl Boot"
echo "========================================="
echo ""

# ── Install all dependencies (including devDeps for tsc) ─────
echo "[1/3] Installing server dependencies..."
cd packages/server
npm install --no-audit --no-fund --ignore-scripts --registry=https://registry.npmjs.org
echo "      Done."

# ── Build TypeScript ──────────────────────────────────────────
echo "[2/3] Building server..."
npx tsc
echo "      Done."
cd ../..

# ── Start ─────────────────────────────────────────────────────
echo "[3/3] Starting server on port ${PORT:-3000}..."
echo ""
NODE_ENV=production PORT=${PORT:-3000} node packages/server/dist/server.js
