#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# LocalChain – Log Management Script
#
# Manage, rotate, and export logs from all services.
#
# Usage:
#   ./scripts/logs.sh [command] [options]
#
# Commands:
#   tail      – Tail logs from all services (default)
#   export    – Export logs to a file
#   rotate    – Rotate log files
#   stats     – Show log statistics
#   clear     – Clear all logs
#
# Options:
#   --service <name>  Filter by service (validator, api, dashboard, etc.)
#   --since <time>    Show logs since (e.g., 1h, 30m, 2024-01-01)
#   --lines <n>       Number of lines (default: 100)
#   --output <file>   Output file for export
# ─────────────────────────────────────────────────────────────

set -euo pipefail

COMMAND="${1:-tail}"
shift || true

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_ROOT/logs"
mkdir -p "$LOG_DIR"

SERVICE=""
SINCE=""
LINES=100
OUTPUT=""

while [ $# -gt 0 ]; do
  case "$1" in
    --service) SERVICE="$2"; shift 2 ;;
    --since) SINCE="$2"; shift 2 ;;
    --lines) LINES="$2"; shift 2 ;;
    --output) OUTPUT="$2"; shift 2 ;;
    *) shift ;;
  esac
done

COMPOSE_FILES="-f $PROJECT_ROOT/docker/docker-compose.yml -f $PROJECT_ROOT/docker/docker-compose.prod.yml"

case "$COMMAND" in
  tail)
    echo "Tailing logs (--lines=$LINES, service=${SERVICE:-all})..."
    if [ -n "$SERVICE" ]; then
      docker compose $COMPOSE_FILES logs --tail="$LINES" -f "$SERVICE"
    else
      docker compose $COMPOSE_FILES logs --tail="$LINES" -f
    fi
    ;;

  export)
    TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
    OUTPUT_FILE="${OUTPUT:-$LOG_DIR/localchain_logs_${TIMESTAMP}.log}"

    echo "Exporting logs to $OUTPUT_FILE..."
    {
      echo "# LocalChain Log Export"
      echo "# Timestamp: $TIMESTAMP"
      echo "# Services: ${SERVICE:-all}"
      echo "# Since: ${SINCE:-all}"
      echo ""

      if [ -n "$SERVICE" ]; then
        docker compose $COMPOSE_FILES logs --tail=10000 "$SERVICE"
      else
        docker compose $COMPOSE_FILES logs --tail=10000
      fi
    } > "$OUTPUT_FILE"

    FILE_SIZE=$(du -sh "$OUTPUT_FILE" | cut -f1)
    echo "  ✓ Exported to $OUTPUT_FILE ($FILE_SIZE)"
    ;;

  rotate)
    echo "Rotating logs..."

    # Rotate Docker logs
    for container in $(docker ps -q --filter "name=lc-"); do
      name=$(docker inspect --format='{{.Name}}' "$container" | sed 's/^\///')
      log_path=$(docker inspect --format='{{.LogPath}}' "$container")
      if [ -n "$log_path" ] && [ -f "$log_path" ]; then
        log_size=$(du -sh "$log_path" | cut -f1)
        echo "  Rotating $name ($log_size)..."
        echo "" > "$log_path"
      fi
    done

    # Rotate application logs
    if [ -d "$LOG_DIR" ]; then
      find "$LOG_DIR" -name "*.log" -mtime +7 -delete 2>/dev/null || true
      echo "  ✓ Cleaned logs older than 7 days"
    fi

    echo "  ✓ Log rotation complete"
    ;;

  stats)
    echo "Log Statistics"
    echo "═══════════════════════════════════════════════════════"
    echo ""

    # Docker container logs
    echo "Docker Containers:"
    for container in $(docker ps -q --filter "name=lc-" 2>/dev/null); do
      name=$(docker inspect --format='{{.Name}}' "$container" | sed 's/^\///')
      log_path=$(docker inspect --format='{{.LogPath}}' "$container")
      if [ -f "$log_path" ]; then
        size=$(du -sh "$log_path" | cut -f1)
        lines=$(wc -l < "$log_path" 2>/dev/null || echo 0)
        echo "  $name: $size ($lines lines)"
      fi
    done
    echo ""

    # Application logs
    if [ -d "$LOG_DIR" ]; then
      echo "Application Logs:"
      du -sh "$LOG_DIR"/*.log 2>/dev/null | while read size path; do
        echo "  $(basename "$path"): $size"
      done
      echo ""
      echo "Total log directory: $(du -sh "$LOG_DIR" | cut -f1)"
    fi

    # Error count
    echo ""
    echo "Recent Errors (last 1000 lines):"
    for container in $(docker ps -q --filter "name=lc-" 2>/dev/null); do
      name=$(docker inspect --format='{{.Name}}' "$container" | sed 's/^\///')
      error_count=$(docker compose $COMPOSE_FILES logs --tail=1000 "$name" 2>/dev/null | grep -ci "error\|panic\|fatal" || echo 0)
      if [ "$error_count" -gt 0 ]; then
        echo "  $name: $error_count errors"
      fi
    done
    ;;

  clear)
    echo "Clearing all logs..."

    # Clear Docker logs
    for container in $(docker ps -q --filter "name=lc-" 2>/dev/null); do
      name=$(docker inspect --format='{{.Name}}' "$container" | sed 's/^\///')
      log_path=$(docker inspect --format='{{.LogPath}}' "$container")
      if [ -f "$log_path" ]; then
        echo "" > "$log_path"
        echo "  ✓ Cleared $name logs"
      fi
    done

    # Clear application logs
    if [ -d "$LOG_DIR" ]; then
      rm -f "$LOG_DIR"/*.log
      echo "  ✓ Cleared application logs"
    fi

    echo "  ✓ All logs cleared"
    ;;

  *)
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  tail      – Tail logs from all services (default)"
    echo "  export    – Export logs to a file"
    echo "  rotate    – Rotate log files"
    echo "  stats     – Show log statistics"
    echo "  clear     – Clear all logs"
    echo ""
    echo "Options:"
    echo "  --service <name>  Filter by service"
    echo "  --since <time>    Show logs since"
    echo "  --lines <n>       Number of lines"
    echo "  --output <file>   Output file"
    exit 1
    ;;
esac
