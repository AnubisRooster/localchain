#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# LocalChain – Generate Join Token
#
# Usage:
#   ./scripts/generate-token.sh
#   ./scripts/generate-token.sh --api-port 5000
# ──────────────────────────────────────────────────────────────
set -euo pipefail

API_PORT="${1:-4000}"

# Parse optional --api-port flag
if [[ "${1:-}" == "--api-port" ]]; then
  API_PORT="${2:-4000}"
fi

API_URL="http://localhost:${API_PORT}"

# Check API is running
if ! curl -sf "$API_URL/health" > /dev/null 2>&1; then
  echo "Error: API not reachable at $API_URL"
  echo "Is the backend running?"
  exit 1
fi

# Generate token (requires an API key for admin auth)
echo "Generating join token..."
echo ""
echo "Note: This endpoint requires an API key."
echo "Set X-API-Key header or provide an API key:"
echo ""
read -sp "API Key: " API_KEY
echo ""

RESPONSE=$(curl -sf -X POST "$API_URL/api/join-token" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY")

TOKEN=$(echo "$RESPONSE" | jq -r '.token')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "Error: Failed to generate token"
  echo "Response: $RESPONSE"
  exit 1
fi

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Join Token Generated"
echo "═══════════════════════════════════════════════════"
echo ""
echo "  On the new device, run:"
echo ""
echo "    ./join.sh $TOKEN"
echo ""
echo "  This token contains your shared secret."
echo "  Share it only with devices you trust."
echo "═══════════════════════════════════════════════════"
