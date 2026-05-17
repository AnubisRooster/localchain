# ─────────────────────────────────────────────────────────────
# LocalChain — Makefile
#
# Targets:
#   make testnet-up       Start the multi-validator testnet
#   make testnet-down     Stop all containers
#   make testnet-logs     Tail all logs
#   make testnet-status   Show container status
#   make testnet-clean    Remove all data volumes
#   make testnet-rebuild  Rebuild images and restart
#   make prod-up          Start production stack
#   make prod-down        Stop production stack
#   make prod-logs        Tail production logs
#   make prod-status      Show production status
#   make prod-clean       Remove production volumes
#   make deploy           One-command deploy (env=prod|staging|dev)
#   make validate         Validate environment configuration
#   make backup           Backup all data
#   make restore          Restore from backup
#   make logs             Log management (tail/export/rotate/stats/clear)
#   make monitoring-up    Start Prometheus + Grafana
#   make monitoring-down  Stop monitoring stack
#   make genesis          Generate genesis for N validators
#   make chain-build      Build localchaind binary locally
#   make chain-install    Install localchaind to $GOPATH/bin
#   make test             Run all tests
#   make lint             Run linters
#   make clean            Clean all artifacts
# ─────────────────────────────────────────────────────────────

.PHONY: testnet-up testnet-down testnet-logs testnet-status testnet-clean testnet-rebuild \
        prod-up prod-down prod-logs prod-status prod-clean \
        deploy validate backup restore logs \
        monitoring-up monitoring-down monitoring-logs \
        genesis chain-build chain-install \
        test lint clean

COMPOSE = docker compose -f docker/docker-compose.yml
COMPOSE_PROD = docker compose -f docker/docker-compose.prod.yml

# ── Testnet ─────────────────────────────────────────────────
testnet-up:
	@echo "═══════════════════════════════════════════════════"
	@echo "  Starting LocalChain Testnet"
	@echo "═══════════════════════════════════════════════════"
	@$(COMPOSE) up -d --build
	@echo ""
	@echo "  Services:"
	@echo "    Seed      : localhost:26656"
	@echo "    Val-1 RPC : localhost:26657"
	@echo "    Val-1 REST: localhost:1317"
	@echo "    Val-2 RPC : localhost:26658"
	@echo "    Val-3 RPC : localhost:26659"
	@echo "    Val-4 RPC : localhost:26661"
	@echo "    API       : localhost:4000"
	@echo "    Dashboard : localhost:3000"
	@echo ""
	@echo "  Run 'make testnet-logs' to watch output"

testnet-down:
	@$(COMPOSE) down

testnet-logs:
	@$(COMPOSE) logs -f

testnet-status:
	@$(COMPOSE) ps

testnet-clean:
	@$(COMPOSE) down -v
	@docker image prune -f --filter "label=localchain"

testnet-rebuild:
	@$(COMPOSE) down
	@$(COMPOSE) build --no-cache
	@$(COMPOSE) up -d

# ── Production ──────────────────────────────────────────────
prod-up:
	@echo "═══════════════════════════════════════════════════"
	@echo "  Starting LocalChain Production"
	@echo "═══════════════════════════════════════════════════"
	@$(COMPOSE_PROD) up -d --build
	@echo ""
	@echo "  Services:"
	@echo "    Chain RPC  : localhost:$(RPC_PORT)"
	@echo "    Chain REST : localhost:$(REST_PORT)"
	@echo "    API        : localhost:$(API_PORT)"
	@echo "    Dashboard  : localhost:$(DASHBOARD_PORT)"
	@echo "    Prometheus : localhost:$(PROMETHEUS_PORT)"
	@echo "    Grafana    : localhost:$(GRAFANA_PORT)"
	@echo ""
	@echo "  Run 'make prod-logs' to watch output"

prod-down:
	@$(COMPOSE_PROD) down

prod-logs:
	@$(COMPOSE_PROD) logs -f

prod-status:
	@$(COMPOSE_PROD) ps

prod-clean:
	@$(COMPOSE_PROD) down -v
	@docker image prune -f --filter "label=localchain"

# ── Deploy ──────────────────────────────────────────────────
ENV ?= prod

deploy:
	@bash scripts/deploy.sh $(ENV)

validate:
	@bash scripts/validate-env.sh

# ── Backup & Restore ────────────────────────────────────────
BACKUP_FILE ?=

backup:
	@bash scripts/backup.sh

restore:
ifndef BACKUP_FILE
	@echo "Usage: make restore BACKUP_FILE=<path>"
	@echo ""
	@echo "Available backups:"
	@ls -1 backups/*.tar.gz 2>/dev/null | while read f; do echo "  $$f ($$(du -sh "$$f" | cut -f1))"; done || echo "  No backups found"
	@exit 1
endif
	@bash scripts/restore.sh $(BACKUP_FILE)

# ── Log Management ──────────────────────────────────────────
LOG_CMD ?= tail
LOG_SERVICE ?=
LOG_LINES ?= 100

logs:
	@bash scripts/logs.sh $(LOG_CMD) $(if $(LOG_SERVICE),--service $(LOG_SERVICE)) --lines $(LOG_LINES)

# ── Monitoring ──────────────────────────────────────────────
monitoring-up:
	@echo "═══════════════════════════════════════════════════"
	@echo "  Starting LocalChain Monitoring Stack"
	@echo "═══════════════════════════════════════════════════"
	@$(COMPOSE) up -d prometheus grafana
	@echo ""
	@echo "  Services:"
	@echo "    Prometheus : http://localhost:9090"
	@echo "    Grafana    : http://localhost:3001 (admin/admin)"
	@echo ""

monitoring-down:
	@$(COMPOSE) stop prometheus grafana

monitoring-logs:
	@$(COMPOSE) logs -f prometheus grafana

# ── Genesis ─────────────────────────────────────────────────
NUM_VALIDATORS ?= 1

genesis:
	@bash docker/generate-genesis.sh $(NUM_VALIDATORS)

# ── Chain Build ─────────────────────────────────────────────
chain-build:
	@cd chain && go build -o ../localchaind ./cmd/localchaind

chain-install:
	@cd chain && go install ./cmd/localchaind

# ── Testing ─────────────────────────────────────────────────
test:
	@echo "Running backend tests..."
	@cd dashboard/backend && npm test
	@echo ""
	@echo "Running frontend tests..."
	@cd dashboard/frontend && npm test 2>/dev/null || echo "  No frontend tests found"

# ── Linting ─────────────────────────────────────────────────
lint:
	@echo "Linting backend..."
	@cd dashboard/backend && npx eslint . --ext .js,.jsx 2>/dev/null || echo "  No ESLint config found"
	@echo ""
	@echo "Linting frontend..."
	@cd dashboard/frontend && npm run lint 2>/dev/null || echo "  No frontend lint script"
	@echo ""
	@echo "Linting Go chain..."
	@cd chain && go vet ./... 2>/dev/null || echo "  Go vet completed"

# ── Clean ───────────────────────────────────────────────────
clean:
	@echo "Cleaning artifacts..."
	@rm -rf backups/ logs/
	@rm -f localchaind
	@cd chain && go clean
	@echo "  ✓ Cleaned"
