#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# LocalChain – Zero-Touch Node Join Script
#
# Usage:
#   ./join.sh <token> [OPTIONS]
#
# Options:
#   --moniker <name>     Set a custom node name (default: auto-generated)
#   --home <path>        Chain home directory (default: ~/.localchaind)
#   --p2p-port <port>    P2P port (default: 26656)
#   --rpc-port <port>    RPC port (default: 26657)
#   --rest-port <port>   REST port (default: 1317)
#   --no-start           Configure only, don't start the node
#   --dry-run            Show what would be done without executing
# ──────────────────────────────────────────────────────────────
set -euo pipefail

# ── Defaults ─────────────────────────────────────────────────
TOKEN="${1:-}"
MONIKER=""
CHAIN_HOME="${HOME}/.localchaind"
P2P_PORT=26656
RPC_PORT=26657
REST_PORT=1317
NO_START=false
DRY_RUN=false

# ── Parse optional arguments ────────────────────────────────
shift || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --moniker) MONIKER="$2"; shift 2 ;;
    --home) CHAIN_HOME="$2"; shift 2 ;;
    --p2p-port) P2P_PORT="$2"; shift 2 ;;
    --rpc-port) RPC_PORT="$2"; shift 2 ;;
    --rest-port) REST_PORT="$2"; shift 2 ;;
    --no-start) NO_START=true; shift ;;
    --dry-run) DRY_RUN=true; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ── Helpers ──────────────────────────────────────────────────
info()  { echo "  $*"; }
ok()    { echo "✔ $*"; }
warn()  { echo "⚠ $*"; }
err()   { echo "✖ $*" >&2; }

# ── Step 0: Check prerequisites ─────────────────────────────
echo ""
echo "⛓  LocalChain Node Join"
echo "─────────────────────────────────────────"

if [ -z "$TOKEN" ]; then
  err "Usage: ./join.sh <token> [OPTIONS]"
  echo ""
  echo "Get a token from the origin node:"
  echo "  ./scripts/generate-token.sh"
  exit 1
fi

MISSING_DEPS=()
for cmd in curl jq base64; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    MISSING_DEPS+=("$cmd")
  fi
done

if [ ${#MISSING_DEPS[@]} -gt 0 ]; then
  err "Missing dependencies: ${MISSING_DEPS[*]}"
  echo ""
  echo "Install with:"
  echo "  macOS:  brew install ${MISSING_DEPS[*]}"
  echo "  Ubuntu: apt install ${MISSING_DEPS[*]}"
  exit 1
fi

# Check localchaind
LOCALCHAIND_BIN=""
if command -v localchaind >/dev/null 2>&1; then
  LOCALCHAIND_BIN="localchaind"
elif [ -f "${HOME}/go/bin/localchaind" ]; then
  LOCALCHAIND_BIN="${HOME}/go/bin/localchaind"
fi

if [ -z "$LOCALCHAIND_BIN" ]; then
  err "localchaind not found on PATH"
  echo ""
  echo "Build it first:"
  echo "  cd chain && make install"
  echo ""
  echo "Or set CHAIN_BINARY env var to the binary path."
  exit 1
fi

info "Using: $LOCALCHAIND_BIN"

# ── Step 1: Decode the token ────────────────────────────────
info "Decoding join token..."

# Base64url decode (replace -_ with +/, add padding)
decode_base64url() {
  local input="$1"
  local padded="${input}=="
  padded="${padded//-/+}"
  padded="${padded//_//}"
  # Remove extra padding
  local len=${#input}
  local mod=$((len % 4))
  if [ $mod -eq 2 ]; then
    padded="${padded}=="
  elif [ $mod -eq 3 ]; then
    padded="${padded}="
  fi
  echo "$padded" | base64 -d 2>/dev/null || echo "$padded" | base64 --decode 2>/dev/null
}

TOKEN_JSON=$(decode_base64url "$TOKEN")

API_URLS=$(echo "$TOKEN_JSON" | jq -r '.api[]' 2>/dev/null)
SHARED_SECRET=$(echo "$TOKEN_JSON" | jq -r '.secret' 2>/dev/null)
CHAIN_ID=$(echo "$TOKEN_JSON" | jq -r '.chain_id' 2>/dev/null)

if [ -z "$API_URLS" ] || [ "$SHARED_SECRET" = "null" ] || [ "$CHAIN_ID" = "null" ]; then
  err "Invalid token: missing required fields (api, secret, chain_id)"
  exit 1
fi

if [ "$DRY_RUN" = true ]; then
  echo ""
  echo "[DRY RUN] Would use:"
  echo "  API URLs : $(echo "$API_URLS" | tr '\n' ', ')"
  echo "  Chain ID : $CHAIN_ID"
  echo "  Home     : $CHAIN_HOME"
  echo "  Moniker  : ${MONIKER:-auto-generated}"
  exit 0
fi

# ── Step 2: Find a reachable API ────────────────────────────
info "Finding reachable API endpoint..."

API_URL=""
while IFS= read -r url; do
  if curl -sf --connect-timeout 3 "$url/health" >/dev/null 2>&1; then
    API_URL="$url"
    ok "Reachable: $url"
    break
  fi
done <<< "$API_URLS"

if [ -z "$API_URL" ]; then
  err "Could not reach any API endpoint in the token."
  echo "  The origin node's IP may have changed — request a new token."
  echo ""
  echo "  Attempted URLs:"
  while IFS= read -r url; do
    echo "    - $url"
  done <<< "$API_URLS"
  exit 1
fi

# ── Step 3: Fetch the bootstrap bundle ──────────────────────
info "Fetching bootstrap bundle..."

BOOTSTRAP=$(curl -sf -H "X-Shared-Secret: $SHARED_SECRET" "$API_URL/api/bootstrap" 2>/dev/null) || {
  err "Failed to fetch bootstrap bundle."
  echo "  The shared secret may be incorrect or the origin is unreachable."
  exit 1
}

BOOTSTRAP_CHAIN_ID=$(echo "$BOOTSTRAP" | jq -r '.chain_id')
BOOTSTRAP_GENESIS=$(echo "$BOOTSTRAP" | jq '.genesis')
SEED_PEERS=$(echo "$BOOTSTRAP" | jq '.seed_peers')
BLOCK_HEIGHT=$(echo "$BOOTSTRAP" | jq -r '.network_info.block_height')

if [ "$BOOTSTRAP_CHAIN_ID" != "$CHAIN_ID" ]; then
  warn "Chain ID mismatch: token=$CHAIN_ID, bootstrap=$BOOTSTRAP_CHAIN_ID"
  CHAIN_ID="$BOOTSTRAP_CHAIN_ID"
fi

ok "Chain: $CHAIN_ID (height: $BLOCK_HEIGHT)"

# ── Step 4: Check if already initialized ────────────────────
GENESIS_FILE="$CHAIN_HOME/config/genesis.json"
SKIP_INIT=false

if [ -f "$GENESIS_FILE" ]; then
  EXISTING_CHAIN_ID=$(jq -r '.chain_id' "$GENESIS_FILE" 2>/dev/null || echo "")
  if [ "$EXISTING_CHAIN_ID" = "$CHAIN_ID" ]; then
    info "Chain already initialized with same chain_id — skipping init"
    SKIP_INIT=true
  else
    err "Chain home exists with different chain_id ($EXISTING_CHAIN_ID)"
    echo "  Use --home to specify a different directory, or remove the existing chain."
    exit 1
  fi
fi

# ── Step 5: Initialize the chain ────────────────────────────
if [ "$SKIP_INIT" = false ]; then
  # Generate moniker if not provided
  if [ -z "$MONIKER" ]; then
    MONIKER="node-$(hostname)-$(date +%s | tail -c 5)"
  fi

  info "Initializing chain: $MONIKER"
  $LOCALCHAIND init "$MONIKER" --chain-id "$CHAIN_ID" --home "$CHAIN_HOME"

  # Write genesis
  info "Writing genesis..."
  echo "$BOOTSTRAP_GENESIS" > "$GENESIS_FILE"
  ok "Genesis written"
else
  if [ -z "$MONIKER" ]; then
    MONIKER=$(jq -r '.moniker' "$CHAIN_HOME/config/config.toml" 2>/dev/null || echo "node-rejoin")
  fi
fi

# ── Step 6: Configure CometBFT ──────────────────────────────
CONFIG="$CHAIN_HOME/config/config.toml"

info "Configuring CometBFT..."

# Bind to all interfaces
sed -i 's|^laddr = "tcp://127.0.0.1:26657"|laddr = "tcp://0.0.0.0:26657"|' "$CONFIG"
sed -i 's|^pex = .*|pex = true|' "$CONFIG"
sed -i 's|^addr_book_strict = .*|addr_book_strict = false|' "$CONFIG"

# Build persistent_peers string
PEERS=""
# Detect if joining node has Tailscale
HAS_TAILSCALE=false
if command -v tailscale >/dev/null 2>&1; then
  TS_IP=$(tailscale ip -4 2>/dev/null || echo "")
  if [ -n "$TS_IP" ]; then
    HAS_TAILSCALE=true
  fi
fi

# Parse seed peers and select best address per peer
PEER_COUNT=$(echo "$SEED_PEERS" | jq 'length')
for ((i=0; i<PEER_COUNT; i++)); do
  NODE_ID=$(echo "$SEED_PEERS" | jq -r ".[$i].node_id")
  ADDRESSES=$(echo "$SEED_PEERS" | jq -r ".[$i].addresses[]")

  # Select address based on priority: tailscale > public > lan
  SELECTED_ADDR=""
  if [ "$HAS_TAILSCALE" = true ]; then
    SELECTED_ADDR=$(echo "$SEED_PEERS" | jq -r ".[$i].addresses[] | select(.type == \"tailscale\") | .address" | head -1)
  fi
  if [ -z "$SELECTED_ADDR" ]; then
    SELECTED_ADDR=$(echo "$SEED_PEERS" | jq -r ".[$i].addresses[] | select(.type == \"public\") | .address" | head -1)
  fi
  if [ -z "$SELECTED_ADDR" ]; then
    SELECTED_ADDR=$(echo "$SEED_PEERS" | jq -r ".[$i].addresses[] | select(.type == \"lan\") | .address" | head -1)
  fi

  if [ -n "$SELECTED_ADDR" ] && [ "$SELECTED_ADDR" != "null" ]; then
    if [ -n "$PEERS" ]; then
      PEERS="${PEERS},"
    fi
    PEERS="${PEERS}${NODE_ID}@${SELECTED_ADDR}"
  fi
done

sed -i "s|^persistent_peers = .*|persistent_peers = \"$PEERS\"|" "$CONFIG"

# Set external_address
EXTERNAL_ADDR=""
if [ "$HAS_TAILSCALE" = true ]; then
  EXTERNAL_ADDR="${TS_IP}:${P2P_PORT}"
  info "External address (Tailscale): $EXTERNAL_ADDR"
fi

sed -i "s|^external_address = .*|external_address = \"$EXTERNAL_ADDR\"|" "$CONFIG"

ok "CometBFT configured"

# ── Step 7: Start the node ──────────────────────────────────
if [ "$NO_START" = false ]; then
  info "Starting node..."

  if command -v pm2 >/dev/null 2>&1; then
    pm2 start "$LOCALCHAIND" --name localchaind -- start --home "$CHAIN_HOME" --minimum-gas-prices 0stake
    ok "Started via PM2"
  else
    nohup "$LOCALCHAIND" start --home "$CHAIN_HOME" --minimum-gas-prices 0stake > "$CHAIN_HOME/node.log" 2>&1 &
    ok "Started in background (log: $CHAIN_HOME/node.log)"
  fi

  # Wait for RPC
  info "Waiting for RPC to come online..."
  for i in $(seq 1 30); do
    if curl -sf "http://localhost:${RPC_PORT}/status" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done

  # Get status
  STATUS=$(curl -sf "http://localhost:${RPC_PORT}/status" 2>/dev/null || echo "{}")
  SYNCING=$(echo "$STATUS" | jq -r '.result.sync_info.catching_up // "unknown"')
  HEIGHT=$(echo "$STATUS" | jq -r '.result.sync_info.latest_block_height // "0"')

  if [ "$SYNCING" = "true" ]; then
    STATUS_TEXT="Syncing (height $HEIGHT / $BLOCK_HEIGHT)"
  else
    STATUS_TEXT="Synced (height $HEIGHT)"
  fi
else
  STATUS_TEXT="Not started (--no-start)"
  SYNCING="unknown"
  HEIGHT="0"
fi

# ── Step 8: Register with the origin ────────────────────────
NODE_ID=$($LOCALCHAIND_BIN tendermint show-node-id --home "$CHAIN_HOME" 2>/dev/null || echo "unknown")

info "Registering with origin..."

# Detect this node's addresses
LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "127.0.0.1")
if [ -z "$LAN_IP" ]; then
  LAN_IP=$(ifconfig 2>/dev/null | grep 'inet ' | grep -v '127.0.0.1' | head -1 | awk '{print $2}' || echo "127.0.0.1")
fi

if [ "$HAS_TAILSCALE" = true ]; then
  PUBLIC_ENDPOINT="${TS_IP}:${P2P_PORT}"
else
  PUBLIC_ENDPOINT="${LAN_IP}:${P2P_PORT}"
fi

curl -sf -X POST "$API_URL/api/nodes/register" \
  -H "Content-Type: application/json" \
  -H "X-Shared-Secret: $SHARED_SECRET" \
  -d "{
    \"node_id\": \"$NODE_ID\",
    \"moniker\": \"$MONIKER\",
    \"public_endpoint\": \"$PUBLIC_ENDPOINT\",
    \"rpc_port\": $RPC_PORT,
    \"rest_port\": $REST_PORT,
    \"p2p_port\": $P2P_PORT
  }" 2>/dev/null || warn "Failed to register with origin (node will still sync)"

# ── Step 9: Print summary ───────────────────────────────────
DASHBOARD_URL=$(echo "$API_URL" | sed 's|:4000|:3000|')

echo ""
echo "═══════════════════════════════════════════════════"
echo "  LocalChain Node Joined Successfully"
echo "═══════════════════════════════════════════════════"
echo ""
echo "  Moniker     : $MONIKER"
echo "  Node ID     : $NODE_ID"
echo "  Chain ID    : $CHAIN_ID"
echo "  API         : $API_URL"
echo "  Status      : $STATUS_TEXT"
echo "  Dashboard   : $DASHBOARD_URL"
echo ""
echo "  To check status:  $LOCALCHAIND_BIN status --home $CHAIN_HOME"
if command -v pm2 >/dev/null 2>&1; then
  echo "  To view logs:     pm2 logs localchaind"
else
  echo "  To view logs:     tail -f $CHAIN_HOME/node.log"
fi
echo "═══════════════════════════════════════════════════"
echo ""
