#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# LocalChain — Genesis Generator for Multi-Validator Testnet
#
# Usage: ./docker/generate-genesis.sh [NUM_VALIDATORS]
#   Default: 4 validators
#
# This script:
#   1. Creates temporary directories for each validator
#   2. Runs `localchaind init` for each
#   3. Generates gentx files with staking
#   4. Collects gentxs into a final genesis.json
#   5. Outputs to docker/genesis/genesis.json
# ─────────────────────────────────────────────────────────────

set -euo pipefail

NUM_VALIDATORS=${1:-4}
CHAIN_ID="localchain"
STAKE_AMOUNT="100000000"  # 100 stake per validator
TEMP_DIR=$(mktemp -d)

echo "═══════════════════════════════════════════════════"
echo "  LocalChain Genesis Generator"
echo "═══════════════════════════════════════════════════"
echo "  Validators : $NUM_VALIDATORS"
echo "  Chain ID   : $CHAIN_ID"
echo "  Stake each : $STAKE_AMOUNT"
echo "  Temp dir   : $TEMP_DIR"
echo ""

# ── Step 1: Initialize each validator ──────────────────────
echo "[1/4] Initializing validator nodes..."

for i in $(seq 1 "$NUM_VALIDATORS"); do
  VHOME="$TEMP_DIR/validator-$i"
  mkdir -p "$VHOME"

  localchaind init "validator-$i" \
    --chain-id "$CHAIN_ID" \
    --home "$VHOME" \
    2>/dev/null

  echo "  ✓ validator-$i initialized"
done

# ── Step 2: Create genesis accounts and gentx ──────────────
echo ""
echo "[2/4] Creating genesis accounts and gentx files..."

for i in $(seq 1 "$NUM_VALIDATORS"); do
  VHOME="$TEMP_DIR/validator-$i"

  # Get validator key address
  VAL_ADDR=$(localchaind keys show validator-$i --home "$VHOME" --keyring-backend test --bech val -a 2>/dev/null || true)

  # If key doesn't exist, create it
  if [ -z "$VAL_ADDR" ]; then
    localchaind keys add "validator-$i" \
      --home "$VHOME" \
      --keyring-backend test \
      --output json 2>/dev/null > /dev/null

    VAL_ADDR=$(localchaind keys show validator-$i --home "$VHOME" --keyring-backend test --bech val -a 2>/dev/null)
  fi

  # Add genesis account with enough stake
  localchaind genesis add-genesis-account \
    "$(localchaind keys show validator-$i --home "$VHOME" --keyring-backend test -a)" \
    "$STAKE_AMOUNT"stake \
    --home "$VHOME"

  # Create gentx
  localchaind genesis gentx "validator-$i" \
    "$STAKE_AMOUNT"stake \
    --chain-id "$CHAIN_ID" \
    --home "$VHOME" \
    --keyring-backend test \
    --commission-rate "0.10" \
    --commission-max-rate "0.20" \
    --commission-max-change-rate "0.01" \
    --min-self-delegation "1" \
    2>/dev/null

  echo "  ✓ validator-$i gentx created"
done

# ── Step 3: Collect gentxs into final genesis ──────────────
echo ""
echo "[3/4] Collecting gentx files..."

# Use validator-1 as the collector
COLLECT_HOME="$TEMP_DIR/validator-1"

# Copy all gentx files to collector
for i in $(seq 2 "$NUM_VALIDATORS"); do
  cp "$TEMP_DIR/validator-$i/config/gentx/gentx-"*.json "$COLLECT_HOME/config/gentx/"
done

# Collect all gentxs
localchaind genesis collect-gentxs --home "$COLLECT_HOME" 2>/dev/null

echo "  ✓ Genesis collected with $NUM_VALIDATORS validators"

# ── Step 4: Output final genesis ───────────────────────────
echo ""
echo "[4/4] Writing genesis..."

OUTPUT_DIR="$(cd "$(dirname "$0")" && pwd)/genesis"
mkdir -p "$OUTPUT_DIR"

cp "$COLLECT_HOME/config/genesis.json" "$OUTPUT_DIR/genesis.json"

# Extract and display validator info
echo ""
echo "═══════════════════════════════════════════════════"
echo "  Genesis Summary"
echo "═══════════════════════════════════════════════════"

for i in $(seq 1 "$NUM_VALIDATORS"); do
  VHOME="$TEMP_DIR/validator-$i"
  NODE_ID=$(localchaind tendermint show-node-id --home "$VHOME")
  VAL_PUBKEY=$(jq -r '.validators[0].pub_key.value // empty' "$OUTPUT_DIR/genesis.json" 2>/dev/null || echo "—")
  echo "  validator-$i: node_id=$NODE_ID"
done

echo ""
echo "  Genesis written to: $OUTPUT_DIR/genesis.json"
echo "  Validators: $NUM_VALIDATORS"
echo ""

# Cleanup
rm -rf "$TEMP_DIR"

echo "  Done."
