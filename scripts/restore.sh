#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# LocalChain – Restore Script
#
# Restores from a backup archive created by backup.sh
#
# Usage:
#   ./scripts/restore.sh <backup.tar.gz> [--dry-run]
#
# Options:
#   --dry-run  Show what would be restored without making changes
# ─────────────────────────────────────────────────────────────

set -euo pipefail

DRY_RUN=false
BACKUP_FILE=""

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    *) BACKUP_FILE="$arg" ;;
  esac
done

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup.tar.gz> [--dry-run]"
  echo ""
  echo "Available backups:"
  ls -1 backups/*.tar.gz 2>/dev/null | while read f; do
    echo "  $f ($(du -sh "$f" | cut -f1))"
  done
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: Backup file not found: $BACKUP_FILE"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CHAIN_HOME="${CHAIN_HOME:-$HOME/.localchaind}"
DATA_DIR="$PROJECT_ROOT/data"
TEMP_DIR="$(mktemp -d)"

echo "═══════════════════════════════════════════════════════"
echo "  LocalChain Restore"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "  Backup  : $BACKUP_FILE"
echo "  Size    : $(du -sh "$BACKUP_FILE" | cut -f1)"
echo "  Dry run : $DRY_RUN"
echo "  Temp dir: $TEMP_DIR"
echo ""

# ── Extract ────────────────────────────────────────────────
echo "Extracting backup..."
tar xzf "$BACKUP_FILE" -C "$TEMP_DIR"
BACKUP_NAME="$(ls "$TEMP_DIR")"
BACKUP_PATH="$TEMP_DIR/$BACKUP_NAME"

# ── Show manifest ──────────────────────────────────────────
if [ -f "$BACKUP_PATH/manifest.json" ]; then
  echo "Backup manifest:"
  cat "$BACKUP_PATH/manifest.json" | python3 -m json.tool 2>/dev/null || cat "$BACKUP_PATH/manifest.json"
  echo ""
fi

if [ "$DRY_RUN" = true ]; then
  echo "[DRY RUN] No changes will be made."
  echo ""
  echo "Would restore:"
  [ -d "$BACKUP_PATH/chain/data" ] && echo "  - Chain state to $CHAIN_HOME/data"
  [ -d "$BACKUP_PATH/chain/config" ] && echo "  - Chain config to $CHAIN_HOME/config"
  [ -d "$BACKUP_PATH/chain/keyring-test" ] && echo "  - Keyring (test) to $CHAIN_HOME/keyring-test"
  [ -d "$BACKUP_PATH/chain/keyring-file" ] && echo "  - Keyring (file) to $CHAIN_HOME/keyring-file"
  [ -d "$BACKUP_PATH/databases" ] && echo "  - SQLite databases to $DATA_DIR"
  [ -d "$BACKUP_PATH/volumes" ] && echo "  - Docker volumes"
  [ -d "$BACKUP_PATH/config" ] && echo "  - Config files to $PROJECT_ROOT"
  rm -rf "$TEMP_DIR"
  exit 0
fi

# ── Confirm ────────────────────────────────────────────────
echo "WARNING: This will overwrite existing data."
echo ""
read -p "Continue? (y/N) " confirm
if [[ "$confirm" != [yY]* ]]; then
  echo "Aborted."
  rm -rf "$TEMP_DIR"
  exit 0
fi

# ── Stop services ──────────────────────────────────────────
echo ""
echo "[1/6] Stopping services..."
if command -v pm2 &> /dev/null; then
  pm2 stop localchaind localchain-api 2>/dev/null || true
  echo "  ✓ PM2 processes stopped"
fi
if command -v docker &> /dev/null; then
  docker compose -f "$PROJECT_ROOT/docker/docker-compose.yml" stop 2>/dev/null || true
  docker compose -f "$PROJECT_ROOT/docker/docker-compose.prod.yml" stop 2>/dev/null || true
  echo "  ✓ Docker containers stopped"
fi

# ── Restore chain state ────────────────────────────────────
echo "[2/6] Restoring chain state..."
if [ -d "$BACKUP_PATH/chain/data" ]; then
  mkdir -p "$CHAIN_HOME"
  [ -d "$CHAIN_HOME/data" ] && rm -rf "$CHAIN_HOME/data"
  cp -r "$BACKUP_PATH/chain/data" "$CHAIN_HOME/"
  echo "  ✓ Chain data restored"
fi

if [ -d "$BACKUP_PATH/chain/config" ]; then
  mkdir -p "$CHAIN_HOME"
  [ -d "$CHAIN_HOME/config" ] && rm -rf "$CHAIN_HOME/config"
  cp -r "$BACKUP_PATH/chain/config" "$CHAIN_HOME/"
  echo "  ✓ Chain config restored"
fi

if [ -d "$BACKUP_PATH/chain/keyring-test" ]; then
  [ -d "$CHAIN_HOME/keyring-test" ] && rm -rf "$CHAIN_HOME/keyring-test"
  cp -r "$BACKUP_PATH/chain/keyring-test" "$CHAIN_HOME/"
  echo "  ✓ Keyring (test) restored"
fi

if [ -d "$BACKUP_PATH/chain/keyring-file" ]; then
  [ -d "$CHAIN_HOME/keyring-file" ] && rm -rf "$CHAIN_HOME/keyring-file"
  cp -r "$BACKUP_PATH/chain/keyring-file" "$CHAIN_HOME/"
  echo "  ✓ Keyring (file) restored"
fi

# ── Restore databases ──────────────────────────────────────
echo "[3/6] Restoring SQLite databases..."
if [ -d "$BACKUP_PATH/databases" ]; then
  mkdir -p "$DATA_DIR"
  cp "$BACKUP_PATH/databases"/*.db "$DATA_DIR/" 2>/dev/null || true
  cp "$BACKUP_PATH/databases"/*.db-wal "$DATA_DIR/" 2>/dev/null || true
  cp "$BACKUP_PATH/databases"/*.db-shm "$DATA_DIR/" 2>/dev/null || true
  echo "  ✓ Databases restored"
fi

# ── Restore Docker volumes ─────────────────────────────────
echo "[4/6] Restoring Docker volumes..."
if [ -d "$BACKUP_PATH/volumes" ]; then
  for vol_file in "$BACKUP_PATH/volumes"/*.tar.gz; do
    [ -f "$vol_file" ] || continue
    vol_name="$(basename "$vol_file" .tar.gz)"
    docker volume create "$vol_name" 2>/dev/null || true
    docker run --rm \
      -v "$vol_name":/restore \
      -v "$(dirname "$vol_file")":/backup:ro \
      alpine tar xzf "/backup/$(basename "$vol_file")" -C /restore
    echo "  ✓ Volume: $vol_name"
  done
fi

# ── Restore config ─────────────────────────────────────────
echo "[5/6] Restoring configuration..."
if [ -d "$BACKUP_PATH/config" ]; then
  for f in $(find "$BACKUP_PATH/config" -type f); do
    rel_path="${f#$BACKUP_PATH/config/}"
    target="$PROJECT_ROOT/$rel_path"
    mkdir -p "$(dirname "$target")"
    cp "$f" "$target"
    echo "  ✓ $rel_path"
  done
fi

# ── Cleanup ────────────────────────────────────────────────
echo "[6/6] Cleaning up..."
rm -rf "$TEMP_DIR"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Restore Complete"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "  Next steps:"
echo "    1. Review restored config: cat $CHAIN_HOME/config/config.toml"
echo "    2. Start services: make prod-up (or make testnet-up)"
echo "    3. Verify chain: curl http://localhost:26657/status"
echo ""
