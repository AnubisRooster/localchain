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
#   make genesis          Generate genesis for N validators
#   make chain-build      Build localchaind binary locally
#   make chain-install    Install localchaind to $GOPATH/bin
# ─────────────────────────────────────────────────────────────

.PHONY: testnet-up testnet-down testnet-logs testnet-status testnet-clean testnet-rebuild genesis chain-build chain-install

COMPOSE = docker compose -f docker/docker-compose.yml

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

# ── Genesis ─────────────────────────────────────────────────
genesis:
	@bash docker/generate-genesis.sh $(NUM_VALIDATORS)

# ── Chain Build ─────────────────────────────────────────────
chain-build:
	@cd chain && go build -o ../localchaind ./cmd/localchaind

chain-install:
	@cd chain && go install ./cmd/localchaind
