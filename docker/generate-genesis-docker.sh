#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# LocalChain — Genesis Generator (Single Validator)
#
# Creates a single-validator genesis for the Docker testnet.
# Multi-validator support requires manual gentx coordination.
# ─────────────────────────────────────────────────────────────

set -eu

NUM_VALIDATORS=1
CHAIN_ID="localchain"
STAKE_AMOUNT="100000000"
OUTPUT_DIR="$(cd "$(dirname "$0")" && pwd)/genesis"

echo "═══════════════════════════════════════════════════"
echo "  LocalChain Genesis Generator"
echo "═══════════════════════════════════════════════════"
echo "  Validators : $NUM_VALIDATORS (single-validator testnet)"
echo "  Chain ID   : $CHAIN_ID"
echo "  Stake      : $STAKE_AMOUNT"
echo ""

rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

docker run --rm --entrypoint bash \
  -v "$OUTPUT_DIR:/output" \
  localchain:latest \
  -c '
CHAIN_ID="${1:-localchain}"
STAKE="${2:-100000000}"
H=/genesis

echo "Initializing validator-1..."
localchaind init validator-1 --chain-id "$CHAIN_ID" --home "$H" > /dev/null 2>&1
localchaind keys add validator-1 --home "$H" --keyring-backend test > /dev/null 2>&1 || true
ACCT=$(localchaind keys show validator-1 --home "$H" --keyring-backend test -a 2>&1)
echo "  Account: $ACCT"

localchaind genesis add-genesis-account "$ACCT" "${STAKE}stake" --home "$H"
echo "  Genesis account added"

localchaind genesis gentx validator-1 "${STAKE}stake" \
  --chain-id "$CHAIN_ID" \
  --home "$H" \
  --keyring-backend test \
  --commission-rate "0.10" \
  --commission-max-rate "0.20" \
  --commission-max-change-rate "0.01" \
  --min-self-delegation "1" \
  2>&1
echo "  Gentx created"

localchaind genesis collect-gentxs --home "$H" 2>&1
echo "  Gentx collected"

cp "$H/config/genesis.json" /output/genesis.json
mkdir -p /output/validator-1
cp "$H/config/priv_validator_key.json" /output/validator-1/
cp "$H/config/node_key.json" /output/validator-1/

NODE_ID=$(localchaind tendermint show-node-id --home "$H" 2>/dev/null)
echo "  Node ID: $NODE_ID"

GEN_TXS=$(python3 -c "import json; d=json.load(open(\"/output/genesis.json\")); print(len(d[\"app_state\"][\"genutil\"][\"gen_txs\"]))" 2>/dev/null || echo "error")
echo "  Validators in genesis: $GEN_TXS"
echo "Done."
' genesis-script "$CHAIN_ID" "$STAKE_AMOUNT"

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Output"
echo "═══════════════════════════════════════════════════"
echo "  Genesis: $OUTPUT_DIR/genesis.json"
echo "  Keys:    $OUTPUT_DIR/validator-1/"
echo ""
echo "  Note: Single-validator testnet. Multi-validator"
echo "  requires manual gentx coordination."
echo ""
echo "  Done."
