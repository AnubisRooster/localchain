# ⛓ LocalChain

A self-hosted, multi-validator blockchain with a dashboard, security pipeline, monitoring, and watchdog auto-recovery. Built on Cosmos SDK + Tendermint (CometBFT), with a Next.js frontend, Express API backend, and Docker-based multi-node testnet.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    LocalChain Monorepo                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │   Next.js     │───▶│   Express    │───▶│  Cosmos SDK  │   │
│  │  Frontend     │    │  API Server  │    │  localchaind │   │
│  │  (port 3000)  │    │  (port 4000) │    │  (port 26657)│   │
│  └──────────────┘    └──────────────┘    └──────────────┘   │
│         │                   │                   │            │
│         │            ┌──────┴──────┐            │            │
│         │            │  Security   │            │            │
│         │            │  Pipeline   │            │            │
│         │            └─────────────┘            │            │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │   Grafana    │    │  Prometheus  │    │   Watchdog   │   │
│  │  (port 3001) │    │  (port 9090) │    │  (auto-fix)  │   │
│  └──────────────┘    └──────────────┘    └──────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Docker Testnet: 4 Validators + Seed Node + API      │   │
│  │  P2P: port 26656 | RPC: 26657 | REST: 1317           │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Components

| Component | Port | Purpose |
|-----------|------|---------|
| **Next.js Frontend** | 3000 | Dashboard UI — blocks, transactions, nodes, security |
| **Express API** | 4000 | Proxies Cosmos REST + Tendermint RPC, security middleware |
| **Cosmos REST** | 1317 | Cosmos SDK REST API (localchaind) |
| **Tendermint RPC** | 26657 | Tendermint RPC endpoint |
| **Tendermint P2P** | 26656 | Peer-to-peer consensus network |
| **Prometheus** | 9090 | Metrics scraping and alerting |
| **Grafana** | 3001 | Visualization dashboards |
| **Watchdog** | — | Auto-recovery monitor for node health |
| **Seed Node** | 26656 | PEX peer discovery for new validators |

## Features

### Dashboard Pages

- **Dashboard** — Real-time chain health: block height, validators, latency, memory usage, live block chart
- **Transactions** — Query and search on-chain transactions by hash, height, or tag
- **Explorer** — Browse blocks and transaction details
- **Nodes** — Aggregate health view of all known network peers (Tailscale-discovered)
- **Security** — Threat monitoring dashboard with quarantine review, filtering, and triage

### Security Pipeline

Every record submission passes through a 9-layer middleware chain:

```
POST /api/records
  │
  ├─ 1. Rate Limiter          — 10 submissions/min, 100 API req/min
  ├─ 2. Address Limiter       — 10 submissions per address/min
  ├─ 3. Validation            — Zod schema enforcement
  ├─ 4. Sanitization          — Strip control chars, zero-width, null bytes
  ├─ 5. Reputation Check      — Address scoring (0-100), block/suspicious/normal/trusted
  ├─ 6. Content Analysis      — Entropy analysis, content classification
  ├─ 7. Injection Scanner     — Pattern detection: eval_execution, ignore_previous, xxe, etc.
  ├─ 8. Quarantine            — Blocked threats stored in separate DB
  └─ 9. Audit Logger          — Append-only audit trail
```

Threats are quarantined in `data/quarantine.db` (separate from `data/audit.db`) and can be reviewed via the Security dashboard.

### Watchdog Auto-Recovery

Monitors the chain node with configurable rules (`watchdog/rules.json`):

- **Stale blocks** — Detects when no new blocks are produced
- **CPU overload** — Triggers when CPU exceeds threshold
- **Memory pressure** — Triggers when memory exceeds threshold
- **Process death** — Detects when `localchaind` process disappears
- **RPC health** — Verifies Tendermint RPC responsiveness

Actions: auto-restart via PM2 with cooldown (60s) and max restart cap (5/hr) to prevent restart loops.

### Monitoring

- **Prometheus** scrapes metrics from both the chain node (`:26660/metrics`) and API server (`:4000/api/metrics`)
- **Grafana** dashboard (`monitoring/grafana-dashboard.json`) provides visual panels
- **Alert rules** (`monitoring/alerts.yml`) define thresholds for notifications

## Quick Start

### Prerequisites

- **Node.js** >= 18
- **Go** >= 1.25 (for building `localchaind`)
- **Docker** + **Docker Compose** (for multi-validator testnet)
- **PM2** (installed automatically by `start.sh`)
- **Tailscale** (optional, for multi-node discovery)

### Option 1: Docker Multi-Validator Testnet (Recommended)

Spin up a 4-validator testnet with seed node, API gateway, and dashboard:

```bash
# Start the testnet
make testnet-up

# Watch logs
make testnet-logs

# Check status
make testnet-status

# Stop
make testnet-down

# Clean everything (including data volumes)
make testnet-clean
```

This builds `localchaind` from source inside Docker, generates a genesis with 4 validators, and starts the full network.

### Option 2: Single-Node Launch (Mac / Linux)

```bash
./start.sh          # Mac / Linux
.\start.ps1         # Windows
```

This installs dependencies, builds the frontend, and starts all services via PM2.

### Manual Setup

```bash
# 1. Install backend dependencies
cd dashboard/backend && npm install --production

# 2. Install and build frontend
cd ../frontend && npm install && npm run build

# 3. Install watchdog dependencies
cd ../../watchdog && npm install

# 4. Start all services
cd .. && pm2 start ecosystem.config.js && pm2 save
```

### Environment Variables

All configuration lives in `dashboard/shared/config.js`. Override via environment:

| Variable | Default | Description |
|----------|---------|-------------|
| `CHAIN_ID` | `localchain` | Chain ID |
| `CHAIN_BINARY` | `~/go/bin/localchaind` | Path to chain binary |
| `CHAIN_HOME` | `~/.localchaind` | Chain home directory |
| `KEYRING_BACKEND` | `test` | Keyring backend type |
| `SIGNER_KEY` | `validator` | Key name for signing txs |
| `COSMOS_REST` | `http://localhost:1317` | Cosmos REST endpoint |
| `TENDERMINT_RPC` | `http://localhost:26657` | Tendermint RPC endpoint |
| `API_PORT` | `4000` | API server port |
| `FRONTEND_PORT` | `3000` | Frontend port |
| `KNOWN_NODES` | `""` | Comma-separated node IPs |

## API Endpoints

### Chain Data

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Chain health status |
| `GET` | `/api/records` | Query create-record transactions |
| `POST` | `/api/records` | Submit a new record (with security pipeline) |
| `GET` | `/api/blocks/latest` | Latest block + recent blocks |
| `GET` | `/api/block/:height` | Block by height |
| `GET` | `/api/tx/:hash` | Transaction by hash |
| `GET` | `/api/txs` | Search transactions |
| `GET` | `/api/validators` | Active validator list |
| `GET` | `/api/nodes` | Node health aggregation |
| `GET` | `/api/net_info` | Peer details |
| `GET` | `/api/system` | System metrics |
| `GET` | `/api/metrics` | Prometheus-format metrics |

### Security

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/audit` | Query audit log entries |
| `GET` | `/api/audit/stats` | Audit statistics |
| `GET` | `/api/quarantine` | Query quarantined threats |
| `GET` | `/api/quarantine/stats` | Quarantine statistics |
| `POST` | `/api/quarantine/:id/review` | Review a threat entry |
| `DELETE` | `/api/quarantine/:id` | Delete a threat entry |
| `GET` | `/api/reputation/:address` | Get address reputation score |

## Screenshots

### Dashboard — Chain Overview

The main dashboard shows real-time chain health with stat cards for block height, validator count, RPC latency, and memory usage. A live area chart tracks block height over time, with a recent blocks table and active validator list below.

```
┌──────────────────────────────────────────────────────────────────┐
│  Dashboard                                    ● Online            │
├──────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────┐ │
│  │ Block Height│  │ Validators  │  │  Latency    │  │ Memory  │ │
│  │   14,832    │  │     1       │  │   12ms      │  │  34.2%  │ │
│  │   Synced    │  │ Height 14832│  │ RPC RTT     │  │ Load 0.4│ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────┘ │
│                                                                  │
│  ┌────────────────────────┐  ┌────────────────────────────────┐  │
│  │  Block Height (live)   │  │        Recent Blocks           │  │
│  │   ╱╲                  │  │  Height   Txs   Time            │  │
│  │  ╱  ╲    ╱╲           │  │  14832     3    10:42:15 AM     │  │
│  │ ╱    ╲  ╱  ╲          │  │  14831     1    10:42:08 AM     │  │
│  │────────────────       │  │  14830     0    10:42:01 AM     │  │
│  └────────────────────────┘  └────────────────────────────────┘  │
│                                                                  │
│  Active Validators                                               │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Address                        │  Voting Power            │  │
│  │  9C67C...                      │  100                     │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### Security Monitor

The security dashboard provides a full threat review interface with filtering by threat level, status, and risk score. Top threat patterns and source IPs are shown as clickable filters. Each threat entry can be expanded to see full details, findings, and raw content.

```
┌──────────────────────────────────────────────────────────────────┐
│  Security Monitor                                                │
│  Review blocked transactions and security threats                │
├──────────────────────────────────────────────────────────────────┤
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌─────┐│
│  │Blocked │ │Pending │ │Reviewed│ │Dismissed│ │ Last24h│ │Crit ││
│  │  142   │ │   23   │ │   89   │ │   30   │ │   18   │ │  7  ││
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘ └─────┘│
│                                                                  │
│  Top Threat Patterns                                             │
│  [eval_execution (34)] [ignore_previous (28)] [encoded_script]  │
│                                                                  │
│  [All Threats ▼] [All Statuses ▼] [Min risk] [Clear Filters]    │
│                                                                  │
│  ID  │ Time        │ Threat  │ Score │ IP        │ Summary  │...│
│  ────┼─────────────┼─────────┼───────┼───────────┼──────────┼   │
│  #142│ 5/17 10:30  │CRITICAL │  15   │10.0.0.5   │eval()... │[View]│
│  #141│ 5/17 10:28  │HIGH     │  10   │10.0.0.8   │<script>│[View]│
│  #140│ 5/17 10:15  │MEDIUM   │   6   │10.0.0.12  │base64.. │[View]│
└──────────────────────────────────────────────────────────────────┘
```

### Nodes View

Shows health status of all known network peers with block height, latency, and sync status.

```
┌──────────────────────────────────────────────────────────────────┐
│  Nodes                                                           │
│  Network topology and peer health                                │
├──────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Host        │ Status  │ Block   │ Latency │ Syncing      │  │
│  │  100.64.0.5  │ ● Online│  14832  │  12ms   │ No           │  │
│  │  100.64.0.8  │ ● Online│  14832  │  45ms   │ No           │  │
│  │  100.64.0.12 │ ● Offline│  —     │  5002ms │ —            │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

## PM2 Management

```bash
pm2 status              # View all running services
pm2 logs                # Tail all logs
pm2 logs localchain-api # Tail API logs only
pm2 restart all         # Restart everything
pm2 stop all            # Stop all services
pm2 delete all          # Remove from PM2 process list
```

## Testing

```bash
# Backend tests (15 test files, 231 tests)
cd dashboard/backend && npm test

# Frontend tests
cd dashboard/frontend && npm test

# Watchdog tests
cd watchdog && npm test
```

## Chain Development

The Cosmos SDK chain source lives in `chain/`.

```bash
# Build localchaind binary
make chain-build

# Install to $GOPATH/bin
make chain-install

# Run Go tests
cd chain && go test ./...

# Generate protobuf files
cd chain && make proto-gen

# Run linter
cd chain && make lint
```

## Docker Testnet

The `docker/` directory contains everything needed to run a multi-validator testnet locally.

### Architecture

```
seed-node (PEX) ──┬── validator-1 ── API ── Dashboard
                  ├── validator-2
                  ├── validator-3
                  └── validator-4
```

All validators share a common genesis and discover each other via the seed node's PEX reactor.

### Make Targets

| Command | Description |
|---------|-------------|
| `make testnet-up` | Build images, generate genesis, start all containers |
| `make testnet-down` | Stop all containers |
| `make testnet-logs` | Tail all container logs |
| `make testnet-status` | Show running containers |
| `make testnet-clean` | Stop and remove all data volumes |
| `make testnet-rebuild` | Rebuild images from scratch and restart |
| `make genesis` | Generate genesis for N validators (default: 4) |
| `make genesis NUM_VALIDATORS=6` | Generate genesis for 6 validators |

### Port Mapping

| Service | Host Port | Container Port |
|---------|-----------|----------------|
| Seed Node P2P | 26656 | 26656 |
| Validator 1 RPC | 26657 | 26657 |
| Validator 1 REST | 1317 | 1317 |
| Validator 2 RPC | 26658 | 26657 |
| Validator 2 REST | 1320 | 1317 |
| Validator 3 RPC | 26659 | 26657 |
| Validator 3 REST | 1323 | 1317 |
| Validator 4 RPC | 26661 | 26657 |
| Validator 4 REST | 1326 | 1317 |
| API Gateway | 4000 | 4000 |
| Dashboard | 3000 | 3000 |

### Adding Remote Validators

To join the network from a remote machine:

1. Build `localchaind` from source (`make chain-install`)
2. Initialize: `localchaind init my-validator --chain-id localchain`
3. Fetch genesis from a running node: `curl http://<seed-host>:26657/genesis | jq .result.genesis > ~/.localchaind/config/genesis.json`
4. Configure seeds: edit `~/.localchaind/config/config.toml`, set `seeds = "<node-id>@<seed-host>:26656"`
5. Start: `localchaind start`

The PEX reactor will automatically discover and connect to all validators.

## Project Structure

```
localchain/
├── chain/                    ← Cosmos SDK chain source (Go)
│   ├── app/                  ← Chain app setup (staking, gov, IBC, records)
│   ├── cmd/localchaind/      ← CLI entry point
│   ├── proto/                ← Protobuf definitions
│   ├── x/records/            ← Custom records module
│   ├── go.mod / go.sum       ← Go dependencies
│   └── Makefile              ← Go build targets
├── dashboard/
│   ├── backend/
│   │   ├── middleware/          # Security pipeline (validation, sanitization, scanning, audit)
│   │   ├── services/            # Reputation, content analysis, quarantine
│   │   ├── __tests__/           # 15 test files
│   │   ├── server.js            # Express API server
│   │   └── package.json
│   ├── frontend/
│   │   ├── pages/               # Dashboard, Explorer, Nodes, Transactions, Security
│   │   ├── components/          # Shared UI components
│   │   ├── __tests__/           # Frontend tests
│   │   └── package.json
│   └── shared/
│       └── config.js            # Centralized configuration
├── docker/
│   ├── Dockerfile.chain         # Multi-stage Go build for localchaind
│   ├── docker-compose.yml       # Multi-validator testnet
│   ├── seed-node/               # Seed node Dockerfile + entrypoint
│   ├── validator/               # Validator Dockerfile + entrypoint
│   ├── api-gateway/             # Express API Dockerfile
│   ├── dashboard/               # Next.js frontend Dockerfile
│   └── generate-genesis.sh      # Genesis assembly script
├── config/
│   └── config.toml.template     # P2P-ready Tendermint config
├── watchdog/
│   ├── watchdog.js              # Auto-recovery monitor
│   ├── rules.json               # Configurable check rules
│   └── __tests__/
├── monitoring/
│   ├── prometheus.yml           # Prometheus scrape config
│   ├── alerts.yml               # Alert rules
│   └── grafana-dashboard.json   # Pre-built Grafana dashboard
├── ecosystem.config.js          # PM2 process definitions
├── start.sh                     # Mac/Linux launcher
├── start.ps1                    # Windows launcher
├── Makefile                     # Top-level build + testnet targets
└── .gitignore
```

## License

MIT
