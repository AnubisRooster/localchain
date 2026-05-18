#!/usr/bin/env bash
set -euo pipefail

if [ -z "${JOIN_TOKEN:-}" ]; then
  echo "Error: JOIN_TOKEN environment variable is required"
  echo "Usage: docker run -e JOIN_TOKEN=<token> localchain-join"
  exit 1
fi

MONIKER="${MONIKER:-node-docker-$$}"

# Run join script with --no-start (we'll exec localchaind directly)
/join.sh "$JOIN_TOKEN" \
  --moniker "$MONIKER" \
  --home "$CHAIN_HOME" \
  --no-start

# Start localchaind as PID 1
exec localchaind start \
  --home "$CHAIN_HOME" \
  --rpc.laddr "tcp://0.0.0.0:26657" \
  --p2p.laddr "tcp://0.0.0.0:26656" \
  --minimum-gas-prices "0stake"
