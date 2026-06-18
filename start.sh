#!/bin/bash
set -e

echo "==> Installing server dependencies..."
cd packages/server
npm install
echo "==> Building server..."
npm run build
cd ../..

echo "==> Building client..."
cd packages/client
npm install
npm run build
cd ../..

echo "==> Starting Colyseus server..."
NODE_ENV=production PORT=${PORT:-3000} node packages/server/dist/server.js
