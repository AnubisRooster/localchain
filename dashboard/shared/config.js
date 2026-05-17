// ─────────────────────────────────────────────
// LocalChain – Shared Configuration
// ─────────────────────────────────────────────
const path = require("path");

const home = process.env.HOME || process.env.USERPROFILE || "";

const config = {
  chainId: process.env.CHAIN_ID || "localchain",

  // Chain binary (for tx submission)
  chainBinary: process.env.CHAIN_BINARY || path.join(home, "go", "bin", "localchaind"),
  chainHome: process.env.CHAIN_HOME || path.join(home, ".localchaind"),
  keyringBackend: process.env.KEYRING_BACKEND || "test",
  signerKey: process.env.SIGNER_KEY || "validator",

  // Cosmos / Tendermint endpoints (bootstrap node)
  cosmosRest: process.env.COSMOS_REST || "http://localhost:1317",
  tendermintRpc: process.env.TENDERMINT_RPC || "http://localhost:26657",

  // Dashboard backend
  apiPort: parseInt(process.env.API_PORT, 10) || 4000,
  apiHost: process.env.API_HOST || "0.0.0.0",

  // Frontend
  frontendPort: parseInt(process.env.FRONTEND_PORT, 10) || 3000,

  // Monitoring
  prometheusPort: parseInt(process.env.PROMETHEUS_PORT, 10) || 9090,
  grafanaPort: parseInt(process.env.GRAFANA_PORT, 10) || 3001,

  // Watchdog
  watchdogInterval: parseInt(process.env.WATCHDOG_INTERVAL, 10) || 5000,
  maxCpuPercent: parseInt(process.env.MAX_CPU, 10) || 80,
  maxMemPercent: parseInt(process.env.MAX_MEM, 10) || 80,
  staleBlockMinutes: parseInt(process.env.STALE_BLOCK_MIN, 10) || 5,

  // Known nodes – populated at runtime by Tailscale discovery
  knownNodes: (process.env.KNOWN_NODES || "").split(",").filter(Boolean),
};

module.exports = config;
