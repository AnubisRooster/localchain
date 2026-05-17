#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# LocalChain – Environment Validation Script
#
# Validates .env configuration and system prerequisites.
# Run before deployment to catch misconfigurations early.
#
# Usage:
#   ./scripts/validate-env.sh [--strict]
#
# Exit codes:
#   0 – All checks passed
#   1 – Errors found (deployment will fail)
#   2 – Warnings only (deployment may work)
# ─────────────────────────────────────────────────────────────

set -uo pipefail

STRICT=false
if [ "${1:-}" = "--strict" ]; then
  STRICT=true
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_ROOT/.env"

ERRORS=0
WARNINGS=0

pass() { echo "  ✓ $1"; }
fail() { echo "  ✗ $1"; ERRORS=$((ERRORS + 1)); }
warn() { echo "  ⚠ $1"; WARNINGS=$((WARNINGS + 1)); }

echo "═══════════════════════════════════════════════════════"
echo "  LocalChain Environment Validation"
echo "═══════════════════════════════════════════════════════"
echo ""

# ── .env file ──────────────────────────────────────────────
echo "[1/6] Environment file"
if [ ! -f "$ENV_FILE" ]; then
  fail ".env file not found (copy from .env.example)"
else
  pass ".env file exists"
  set -a
  source "$ENV_FILE"
  set +a
fi

# ── Required variables ─────────────────────────────────────
echo "[2/6] Required variables"

if [ -z "${CHAIN_ID:-}" ]; then
  fail "CHAIN_ID is not set"
else
  pass "CHAIN_ID=$CHAIN_ID"
fi

if [ -z "${SIGNER_KEY:-}" ]; then
  fail "SIGNER_KEY is not set"
else
  pass "SIGNER_KEY=$SIGNER_KEY"
fi

if [ -z "${VALIDATOR_SHARED_SECRET:-}" ]; then
  fail "VALIDATOR_SHARED_SECRET is not set"
elif [ "$VALIDATOR_SHARED_SECRET" = "change-this-to-a-secure-secret" ]; then
  if [ "$STRICT" = true ]; then
    fail "VALIDATOR_SHARED_SECRET still has default value"
  else
    warn "VALIDATOR_SHARED_SECRET uses default value"
  fi
else
  pass "VALIDATOR_SHARED_SECRET is set (custom)"
fi

# ── System prerequisites ───────────────────────────────────
echo "[3/6] System prerequisites"

if command -v docker &> /dev/null; then
  pass "Docker $(docker --version | cut -d' ' -f3)"
else
  fail "Docker not found"
fi

if command -v docker compose &> /dev/null; then
  pass "Docker Compose $(docker compose version | cut -d' ' -f4)"
else
  fail "Docker Compose not found"
fi

if command -v node &> /dev/null; then
  NODE_VER=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$NODE_VER" -ge 18 ]; then
    pass "Node.js $(node --version)"
  else
    fail "Node.js >= 18 required (found $(node --version))"
  fi
else
  warn "Node.js not found (required for dev mode)"
fi

if command -v go &> /dev/null; then
  pass "Go $(go version | cut -d' ' -f3)"
else
  warn "Go not found (required for chain builds)"
fi

# ── Chain binary ───────────────────────────────────────────
echo "[4/6] Chain binary"
CHAIN_BIN="${CHAIN_BINARY:-$HOME/go/bin/localchaind}"
if [ -f "$CHAIN_BIN" ]; then
  pass "Chain binary: $CHAIN_BIN ($(ls -lh "$CHAIN_BIN" | awk '{print $5}'))"
else
  warn "Chain binary not found at $CHAIN_BIN"
  warn "Run: make chain-install"
fi

# ── Port availability ──────────────────────────────────────
echo "[5/6] Port availability"

check_port() {
  local port=$1
  local name=$2
  if lsof -i ":$port" &> /dev/null; then
    local proc=$(lsof -i ":$port" | tail -1 | awk '{print $1}')
    warn "$name port $port in use by $proc"
  else
    pass "$name port $port available"
  fi
}

check_port "${P2P_PORT:-26656}" "P2P"
check_port "${RPC_PORT:-26657}" "RPC"
check_port "${REST_PORT:-1317}" "REST"
check_port "${API_PORT:-4000}" "API"
check_port "${DASHBOARD_PORT:-3000}" "Dashboard"
check_port "${PROMETHEUS_PORT:-9090}" "Prometheus"
check_port "${GRAFANA_PORT:-3001}" "Grafana"

# ── Disk space ─────────────────────────────────────────────
echo "[6/6] Disk space"

AVAILABLE_GB=$(df -h "$PROJECT_ROOT" | tail -1 | awk '{print $4}' | sed 's/G//')
if [ -n "$AVAILABLE_GB" ]; then
  if (( $(echo "$AVAILABLE_GB > 5" | bc -l 2>/dev/null || echo 1) )); then
    pass "Disk space: ${AVAILABLE_GB}GB available"
  else
    warn "Low disk space: ${AVAILABLE_GB}GB available (recommend > 5GB)"
  fi
else
  warn "Could not determine available disk space"
fi

# ── Summary ────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════"
if [ $ERRORS -gt 0 ]; then
  echo "  Result: FAILED ($ERRORS errors, $WARNINGS warnings)"
  echo "═══════════════════════════════════════════════════════"
  echo ""
  echo "  Fix errors before deploying."
  exit 1
elif [ $WARNINGS -gt 0 ] && [ "$STRICT" = true ]; then
  echo "  Result: WARNINGS ($WARNINGS warnings, strict mode)"
  echo "═══════════════════════════════════════════════════════"
  exit 2
else
  echo "  Result: PASSED ($WARNINGS warnings)"
  echo "═══════════════════════════════════════════════════════"
  exit 0
fi
