#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# LocalChain – Full Stack Launcher (Mac / Linux)
# Installs deps, builds frontend, and starts everything via PM2.
# ──────────────────────────────────────────────────────────────
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo ""
echo "⛓  LocalChain Full Stack Launcher"
echo "─────────────────────────────────────────"

# ── Check prerequisites ──────────────────────────────────────
for cmd in node npm; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "✖ '$cmd' is required. Install Node.js >= 18 first."
    exit 1
  fi
done

# ── Install PM2 globally ────────────────────────────────────
if ! command -v pm2 >/dev/null 2>&1; then
  echo "📦 Installing PM2..."
  npm install -g pm2
fi

# ── Install backend deps ────────────────────────────────────
echo "📦 Installing backend dependencies..."
cd "$ROOT_DIR/dashboard/backend"
npm install --production

# ── Install & build frontend ────────────────────────────────
echo "📦 Installing frontend dependencies..."
cd "$ROOT_DIR/dashboard/frontend"
npm install
echo "🔨 Building frontend..."
npm run build

# ── Start everything with PM2 ───────────────────────────────
cd "$ROOT_DIR"
echo "▶️  Starting services..."
pm2 start ecosystem.config.js
pm2 save

# ── Get Tailscale IP ─────────────────────────────────────────
TS_IP=""
if command -v tailscale >/dev/null 2>&1; then
  TS_IP=$(tailscale ip -4 2>/dev/null || echo "")
fi

echo ""
echo "═══════════════════════════════════════════════════"
echo "  ⛓  LocalChain Stack Running"
echo "═══════════════════════════════════════════════════"
echo ""
echo "  Dashboard : http://${TS_IP:-localhost}:3000"
echo "  Backend   : http://${TS_IP:-localhost}:4000"
echo "  REST API  : http://${TS_IP:-localhost}:1317"
echo "  RPC       : http://${TS_IP:-localhost}:26657"
echo ""
echo "  PM2 status: pm2 status"
echo "  PM2 logs  : pm2 logs"
echo "  Stop all  : pm2 stop all"
echo "═══════════════════════════════════════════════════"
