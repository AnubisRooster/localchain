# ⛓ LocalChain

A self-hosted blockchain dashboard with built-in security pipeline, monitoring, and watchdog auto-recovery. Built on Cosmos SDK + Tendermint, with a Next.js frontend, Express API backend, and PM2-managed processes.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      LocalChain Stack                        │
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
└─────────────────────────────────────────────────────────────┘
```

### Components

| Component | Port | Purpose |
|-----------|------|---------|
| **Next.js Frontend** | 3000 | Dashboard UI — blocks, transactions, nodes, security |
| **Express API** | 4000 | Proxies Cosmos REST + Tendermint RPC, security middleware |
| **Cosmos REST** | 1317 | Cosmos SDK REST API (localchaind) |
| **Tendermint RPC** | 26657 | Tendermint RPC endpoint |
| **Prometheus** | 9090 | Metrics scraping and alerting |
| **Grafana** | 3001 | Visualization dashboards |
| **Watchdog** | — | Auto-recovery monitor for node health |

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
- **PM2** (installed automatically by `start.sh`)
- **localchaind** binary built and on PATH (or set `CHAIN_BINARY` env var)
- **Tailscale** (optional, for multi-node discovery)

### One-Command Launch

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

## Project Structure

```
localchain/
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
└── .gitignore
```

## License

MIT
