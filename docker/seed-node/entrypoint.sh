#!/usr/bin/env bash
set -euo pipefail

echo "═══════════════════════════════════════════════════"
echo "  LocalChain Seed Node (PEX only - not a validator)"
echo "═══════════════════════════════════════════════════"

# Initialize if not already done
if [ ! -f "$CHAIN_HOME/config/node_key.json" ]; then
  echo "[seed] Initializing seed node..."
  localchaind init "$NODE_NAME" --chain-id localchain --home "$CHAIN_HOME" > /dev/null 2>&1
  echo "[seed] Initialization complete"
fi

# DO NOT copy genesis - seed node runs its own empty chain for peer discovery only
# Validators will have the real multi-validator genesis

# Set minimum gas price
APP_TOML="$CHAIN_HOME/config/app.toml"
if [ -f "$APP_TOML" ]; then
  sed -i 's|^minimum-gas-prices = ""|minimum-gas-prices = "0stake"|' "$APP_TOML"
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

echo "[seed] Node ID: $(localchaind tendermint show-node-id --home "$CHAIN_HOME")"
echo "[seed] Starting seed node (PEX mode)..."

exec localchaind start --home "$CHAIN_HOME" --minimum-gas-prices "0stake"
