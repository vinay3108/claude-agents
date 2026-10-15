#!/bin/bash
set -e

cd "$(dirname "$0")/.."

echo "[pm2] Building Next.js..."
npm run build

echo "[pm2] Starting Next.js..."
exec node_modules/.bin/next start
