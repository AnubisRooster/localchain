#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# LocalChain – Backup Script
#
# Creates a timestamped backup of:
#   - Chain state (~/.localchaind/data)
#   - Chain config (~/.localchaind/config)
#   - SQLite databases (auth, registry, tenant, reputation, audit, quarantine)
#   - Docker volumes (if running in Docker)
#   - Environment configs
#
# Usage:
#   ./scripts/backup.sh [output_dir]
#
# Output: backup_<timestamp>.tar.gz
# ─────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${1:-$PROJECT_ROOT/backups}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_NAME="localchain_backup_${TIMESTAMP}"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"

CHAIN_HOME="${CHAIN_HOME:-$HOME/.localchaind}"
DATA_DIR="$PROJECT_ROOT/data"

echo "═══════════════════════════════════════════════════════"
echo "  LocalChain Backup"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "  Timestamp : $TIMESTAMP"
echo "  Output    : $BACKUP_PATH.tar.gz"
echo "  Chain home: $CHAIN_HOME"
echo "  Data dir  : $DATA_DIR"
echo ""

mkdir -p "$BACKUP_PATH"

# ── Chain state ────────────────────────────────────────────
echo "[1/6] Backing up chain state..."
if [ -d "$CHAIN_HOME/data" ]; then
  mkdir -p "$BACKUP_PATH/chain"
  cp -r "$CHAIN_HOME/data" "$BACKUP_PATH/chain/"
  echo "  ✓ Chain data ($(du -sh "$BACKUP_PATH/chain/data" | cut -f1))"
else
  echo "  ⚠ Chain data directory not found at $CHAIN_HOME/data"
fi

# ── Chain config ───────────────────────────────────────────
echo "[2/6] Backing up chain config..."
if [ -d "$CHAIN_HOME/config" ]; then
  mkdir -p "$BACKUP_PATH/chain"
  cp -r "$CHAIN_HOME/config" "$BACKUP_PATH/chain/"
  echo "  ✓ Chain config"
else
  echo "  ⚠ Chain config directory not found at $CHAIN_HOME/config"
fi

# ── Keyring ────────────────────────────────────────────────
echo "[3/6] Backing up keyring..."
if [ -d "$CHAIN_HOME/keyring-test" ]; then
  mkdir -p "$BACKUP_PATH/chain"
  cp -r "$CHAIN_HOME/keyring-test" "$BACKUP_PATH/chain/"
  echo "  ✓ Keyring (test)"
fi
if [ -d "$CHAIN_HOME/keyring-file" ]; then
  mkdir -p "$BACKUP_PATH/chain"
  cp -r "$CHAIN_HOME/keyring-file" "$BACKUP_PATH/chain/"
  echo "  ✓ Keyring (file)"
fi

# ── SQLite databases ───────────────────────────────────────
echo "[4/6] Backing up SQLite databases..."
if [ -d "$DATA_DIR" ]; then
  mkdir -p "$BACKUP_PATH/databases"
  for db in auth.db registry.db tenants.db reputation.db audit.db quarantine.db; do
    if [ -f "$DATA_DIR/$db" ]; then
      cp "$DATA_DIR/$db" "$BACKUP_PATH/databases/"
      cp "$DATA_DIR/${db}-wal" "$BACKUP_PATH/databases/" 2>/dev/null || true
      cp "$DATA_DIR/${db}-shm" "$BACKUP_PATH/databases/" 2>/dev/null || true
      echo "  ✓ $db"
    fi
  done
else
  echo "  ⚠ Data directory not found at $DATA_DIR"
fi

# ── Docker volumes ─────────────────────────────────────────
echo "[5/6] Backing up Docker volumes..."
if command -v docker &> /dev/null; then
  VOLUMES=$(docker volume ls -q --filter "name=localchain" 2>/dev/null || true)
  if [ -n "$VOLUMES" ]; then
    mkdir -p "$BACKUP_PATH/volumes"
    for vol in $VOLUMES; do
      docker run --rm \
        -v "$vol":/source:ro \
        -v "$BACKUP_PATH/volumes":/backup \
        alpine tar czf "/backup/${vol}.tar.gz" -C /source .
      echo "  ✓ Volume: $vol"
    done
  else
    echo "  ⚠ No LocalChain Docker volumes found"
  fi
else
  echo "  ⚠ Docker not available, skipping volume backup"
fi

# ── Config files ───────────────────────────────────────────
echo "[6/6] Backing up configuration..."
mkdir -p "$BACKUP_PATH/config"
for f in docker/docker-compose.yml docker/docker-compose.prod.yml \
         docker/monitoring/prometheus/prometheus.yml \
         .env .env.example Makefile ecosystem.config.js; do
  if [ -f "$PROJECT_ROOT/$f" ]; then
    mkdir -p "$BACKUP_PATH/config/$(dirname "$f")"
    cp "$PROJECT_ROOT/$f" "$BACKUP_PATH/config/$f"
    echo "  ✓ $f"
  fi
done

# ── Create manifest ────────────────────────────────────────
cat > "$BACKUP_PATH/manifest.json" << EOF
{
  "backup_name": "$BACKUP_NAME",
  "timestamp": "$TIMESTAMP",
  "chain_home": "$CHAIN_HOME",
  "data_dir": "$DATA_DIR",
  "project_root": "$PROJECT_ROOT",
  "components": {
    "chain_state": $([ -d "$BACKUP_PATH/chain/data" ] && echo "true" || echo "false"),
    "chain_config": $([ -d "$BACKUP_PATH/chain/config" ] && echo "true" || echo "false"),
    "keyring": $([ -d "$BACKUP_PATH/chain/keyring-test" ] || [ -d "$BACKUP_PATH/chain/keyring-file" ] && echo "true" || echo "false"),
    "databases": $([ -d "$BACKUP_PATH/databases" ] && echo "true" || echo "false"),
    "volumes": $([ -d "$BACKUP_PATH/volumes" ] && echo "true" || echo "false"),
    "config": $([ -d "$BACKUP_PATH/config" ] && echo "true" || echo "false")
  }
}
EOF

# ── Compress ───────────────────────────────────────────────
echo ""
echo "Compressing backup..."
cd "$BACKUP_DIR"
tar czf "${BACKUP_NAME}.tar.gz" "$BACKUP_NAME"
rm -rf "$BACKUP_NAME"

BACKUP_SIZE=$(du -sh "${BACKUP_NAME}.tar.gz" | cut -f1)

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Backup Complete"
echo "═══════════════════════════════════════════════════════"
echo "  File: $BACKUP_DIR/${BACKUP_NAME}.tar.gz"
echo "  Size: $BACKUP_SIZE"
echo ""
echo "  To restore: ./scripts/restore.sh $BACKUP_DIR/${BACKUP_NAME}.tar.gz"
echo ""
