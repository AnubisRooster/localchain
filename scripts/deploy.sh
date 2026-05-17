#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# LocalChain – Deploy Script
#
# One-command deployment for production or staging.
#
# Usage:
#   ./scripts/deploy.sh [environment]
#
# Environments:
#   prod      – Production (docker-compose.prod.yml)
#   staging   – Staging (docker-compose.yml)
#   dev       – Development (local PM2)
#
# Prerequisites:
#   - Docker & Docker Compose installed
#   - .env file configured (copy from .env.example)
#   - Chain binary built (make chain-install)
# ─────────────────────────────────────────────────────────────

set -euo pipefail

ENV="${1:-prod}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "═══════════════════════════════════════════════════════"
echo "  LocalChain Deploy"
echo "═══════════════════════════════════════════════════════"
echo "  Environment: $ENV"
echo "  Project root: $PROJECT_ROOT"
echo ""

# ── Validate prerequisites ─────────────────────────────────
echo "[1/5] Validating prerequisites..."

if ! command -v docker &> /dev/null; then
  echo "  ✗ Docker is required but not installed"
  exit 1
fi
echo "  ✓ Docker $(docker --version | cut -d' ' -f3)"

if ! command -v docker compose &> /dev/null; then
  echo "  ✗ Docker Compose is required but not installed"
  exit 1
fi
echo "  ✓ Docker Compose $(docker compose version | cut -d' ' -f4)"

if [ "$ENV" = "dev" ]; then
  if ! command -v node &> /dev/null; then
    echo "  ✗ Node.js is required for dev mode"
    exit 1
  fi
  echo "  ✓ Node.js $(node --version)"
fi

# ── Validate environment ───────────────────────────────────
echo "[2/5] Validating environment..."

if [ ! -f "$PROJECT_ROOT/.env" ]; then
  echo "  ✗ .env file not found"
  echo "    Run: cp .env.example .env"
  echo "    Then edit .env with your configuration"
  exit 1
fi

# Source .env for validation
set -a
source "$PROJECT_ROOT/.env"
set +a

# Required variables
REQUIRED_VARS=(
  "CHAIN_ID"
  "SIGNER_KEY"
  "VALIDATOR_SHARED_SECRET"
)

MISSING=0
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var:-}" ]; then
    echo "  ✗ $var is not set in .env"
    MISSING=$((MISSING + 1))
  fi
done

if [ $MISSING -gt 0 ]; then
  echo ""
  echo "  $MISSING required variable(s) missing. Please update .env"
  exit 1
fi

echo "  ✓ Environment validated"

# ── Validate config ────────────────────────────────────────
echo "[3/5] Validating configuration..."

# Check chain binary
if [ "$ENV" = "dev" ]; then
  if [ ! -f "${CHAIN_BINARY:-$HOME/go/bin/localchaind}" ]; then
    echo "  ✗ Chain binary not found at ${CHAIN_BINARY:-$HOME/go/bin/localchaind}"
    echo "    Run: make chain-install"
    exit 1
  fi
  echo "  ✓ Chain binary: $(ls -lh "${CHAIN_BINARY:-$HOME/go/bin/localchaind}" | awk '{print $5}')"
fi

# Check genesis
if [ "$ENV" != "dev" ]; then
  if [ ! -f "$PROJECT_ROOT/docker/genesis/genesis.json" ]; then
    echo "  ✗ Genesis file not found"
    echo "    Run: make genesis NUM_VALIDATORS=1"
    exit 1
  fi
  echo "  ✓ Genesis file present"
fi

# Check ports availability
check_port() {
  local port=$1
  if lsof -i ":$port" &> /dev/null; then
    echo "  ⚠ Port $port is in use"
    return 1
  fi
  return 0
}

echo "  Checking ports..."
check_port "${API_PORT:-4000}" || true
check_port "${DASHBOARD_PORT:-3000}" || true
check_port "${PROMETHEUS_PORT:-9090}" || true
check_port "${GRAFANA_PORT:-3001}" || true

# ── Deploy ─────────────────────────────────────────────────
echo ""
echo "[4/5] Deploying..."

case "$ENV" in
  prod)
    echo "  Starting production stack..."
    cd "$PROJECT_ROOT"
    docker compose -f docker/docker-compose.prod.yml up -d --build
    echo "  ✓ Production services started"
    ;;
  staging)
    echo "  Starting staging stack..."
    cd "$PROJECT_ROOT"
    docker compose -f docker/docker-compose.yml up -d --build
    echo "  ✓ Staging services started"
    ;;
  dev)
    echo "  Starting development services..."
    cd "$PROJECT_ROOT"

    # Start chain
    if pm2 list | grep -q localchaind; then
      pm2 restart localchaind
    else
      pm2 start ecosystem.config.js --only localchaind
    fi
    echo "  ✓ Chain started"

    # Start API
    if pm2 list | grep -q localchain-api; then
      pm2 restart localchain-api
    else
      pm2 start ecosystem.config.js --only localchain-api
    fi
    echo "  ✓ API started"

    # Start dashboard
    cd dashboard/frontend
    npm run dev &
    echo "  ✓ Dashboard started (port 3000)"
    ;;
  *)
    echo "  ✗ Unknown environment: $ENV"
    echo "    Valid: prod, staging, dev"
    exit 1
    ;;
esac

# ── Health check ───────────────────────────────────────────
echo ""
echo "[5/5] Running health checks..."

wait_for_service() {
  local name=$1
  local url=$2
  local max_attempts=${3:-30}
  local attempt=1

  echo -n "  Waiting for $name..."
  while [ $attempt -le $max_attempts ]; do
    if curl -sf "$url" > /dev/null 2>&1; then
      echo " ✓"
      return 0
    fi
    echo -n "."
    sleep 2
    attempt=$((attempt + 1))
  done
  echo " ✗ (timeout)"
  return 1
}

HEALTH_OK=true

if [ "$ENV" = "dev" ]; then
  wait_for_service "Chain" "http://localhost:26657/status" || HEALTH_OK=false
  wait_for_service "API" "http://localhost:4000/health" || HEALTH_OK=false
  wait_for_service "Dashboard" "http://localhost:3000" 20 || HEALTH_OK=false
else
  wait_for_service "Chain" "http://localhost:26657/status" 40 || HEALTH_OK=false
  wait_for_service "API" "http://localhost:4000/health" || HEALTH_OK=false
  wait_for_service "Dashboard" "http://localhost:3000" 20 || HEALTH_OK=false
  wait_for_service "Prometheus" "http://localhost:9090/-/healthy" 20 || HEALTH_OK=false
  wait_for_service "Grafana" "http://localhost:3001/api/health" 20 || HEALTH_OK=false
fi

echo ""
echo "═══════════════════════════════════════════════════════"
if [ "$HEALTH_OK" = true ]; then
  echo "  Deploy Successful"
  echo "═══════════════════════════════════════════════════════"
  echo ""
  echo "  Services:"
  [ "$ENV" = "dev" ] || echo "    Chain RPC    : http://localhost:${RPC_PORT:-26657}"
  [ "$ENV" = "dev" ] || echo "    Chain REST   : http://localhost:${REST_PORT:-1317}"
  echo "    API          : http://localhost:${API_PORT:-4000}"
  echo "    Dashboard    : http://localhost:${DASHBOARD_PORT:-3000}"
  [ "$ENV" = "dev" ] || echo "    Prometheus   : http://localhost:${PROMETHEUS_PORT:-9090}"
  [ "$ENV" = "dev" ] || echo "    Grafana      : http://localhost:${GRAFANA_PORT:-3001}"
  echo ""
  echo "  Logs: make prod-logs (or make testnet-logs)"
  echo "  Status: make prod-status (or make testnet-status)"
  echo "  Backup: ./scripts/backup.sh"
else
  echo "  Deploy Completed with Warnings"
  echo "═══════════════════════════════════════════════════════"
  echo ""
  echo "  Some services did not pass health checks."
  echo "  Check logs: make prod-logs"
  echo ""
  exit 1
fi
