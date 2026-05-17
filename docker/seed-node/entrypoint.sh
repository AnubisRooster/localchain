#!/usr/bin/env bash
set -euo pipefail

echo "═══════════════════════════════════════════════════"
echo "  LocalChain Seed Node"
echo "═══════════════════════════════════════════════════"

# Initialize if not already done
if [ ! -f "$CHAIN_HOME/config/node_key.json" ]; then
  echo "[seed] Initializing node..."
  localchaind init "$NODE_NAME" --chain-id localchain --home "$CHAIN_HOME"
fi

# Copy genesis if provided externally
if [ -f "/genesis/genesis.json" ]; then
  echo "[seed] Using provided genesis..."
  cp /genesis/genesis.json "$CHAIN_HOME/config/genesis.json"
fi

# Configure P2P for seed mode
CONFIG="$CHAIN_HOME/config/config.toml"

# Bind to all interfaces
sed -i 's|^laddr = "tcp://127.0.0.1:26657"|laddr = "tcp://0.0.0.0:26657"|' "$CONFIG"
sed -i 's|^laddr = "tcp://0.0.0.0:26656"|laddr = "tcp://0.0.0.0:26656"|' "$CONFIG"

# Enable peer exchange
sed -i 's|^pex = .*|pex = true|' "$CONFIG"

# Enable seed mode
sed -i 's|^seed_mode = .*|seed_mode = true|' "$CONFIG"

# Allow duplicate IPs (Docker NAT)
sed -i 's|^allow_duplicate_ip = .*|allow_duplicate_ip = true|' "$CONFIG"

# Disable strict address routing (Docker networks)
sed -i 's|^addr_book_strict = .*|addr_book_strict = false|' "$CONFIG"

# Enable Prometheus
sed -i 's|^prometheus = .*|prometheus = true|' "$CONFIG"

# Set external address if provided
if [ -n "${EXTERNAL_ADDRESS:-}" ]; then
  sed -i "s|^external_address = .*|external_address = \"$EXTERNAL_ADDRESS\"|" "$CONFIG"
fi

# Set seeds if provided
if [ -n "${SEEDS:-}" ]; then
  sed -i "s|^seeds = .*|seeds = \"$SEEDS\"|" "$CONFIG"
fi

# Set persistent peers if provided
if [ -n "${PERSISTENT_PEERS:-}" ]; then
  sed -i "s|^persistent_peers = .*|persistent_peers = \"$PERSISTENT_PEERS\"|" "$CONFIG"
fi

echo "[seed] Node ID: $(localchaind tendermint show-node-id --home "$CHAIN_HOME")"
echo "[seed] Starting seed node..."

exec localchaind start --home "$CHAIN_HOME" --rpc.laddr "tcp://0.0.0.0:26657" --p2p.laddr "tcp://0.0.0.0:26656"
