// ─────────────────────────────────────────────────────────────
// LocalChain – Prometheus Metrics Service
// Uses prom-client for proper metrics exposition.
// ─────────────────────────────────────────────────────────────
const client = require("prom-client");
const os = require("os");

let register;
let metrics;

function createMetrics() {
  register = new client.Registry();
  const collectDefaultMetrics = client.collectDefaultMetrics;
  collectDefaultMetrics({ register });

  const m = {};

  m.apiRequestsTotal = new client.Counter({
    name: "localchain_api_requests_total",
    help: "Total API requests",
    labelNames: ["method", "path", "status"],
    registers: [register],
  });

  m.apiErrorsTotal = new client.Counter({
    name: "localchain_api_errors_total",
    help: "Total API errors",
    registers: [register],
  });

  m.requestDuration = new client.Histogram({
    name: "localchain_request_duration_seconds",
    help: "Request duration in seconds",
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [register],
  });

  m.blockHeight = new client.Gauge({
    name: "localchain_block_height",
    help: "Current block height",
    registers: [register],
  });

  m.peers = new client.Gauge({
    name: "localchain_peers",
    help: "Number of connected peers",
    registers: [register],
  });

  m.catchingUp = new client.Gauge({
    name: "localchain_catching_up",
    help: "Whether the node is catching up (1=yes, 0=no)",
    registers: [register],
  });

  m.systemMemUsedPercent = new client.Gauge({
    name: "localchain_system_mem_used_percent",
    help: "System memory usage percent",
    registers: [register],
  });

  m.systemCpuLoad = new client.Gauge({
    name: "localchain_system_cpu_load",
    help: "System 1-minute load average",
    registers: [register],
  });

  m.systemUptime = new client.Gauge({
    name: "localchain_system_uptime_seconds",
    help: "System uptime in seconds",
    registers: [register],
  });

  m.nodePoolSize = new client.Gauge({
    name: "localchain_node_pool_size",
    help: "Number of nodes in connection pool",
    registers: [register],
  });

  m.nodeOnline = new client.Gauge({
    name: "localchain_node_online",
    help: "Number of online nodes",
    registers: [register],
  });

  m.nodeOffline = new client.Gauge({
    name: "localchain_node_offline",
    help: "Number of offline nodes",
    registers: [register],
  });

  m.activeTenants = new client.Gauge({
    name: "localchain_active_tenants",
    help: "Number of active tenants",
    registers: [register],
  });

  m.activeApiKeys = new client.Gauge({
    name: "localchain_active_api_keys",
    help: "Number of active API keys",
    registers: [register],
  });

  m.txBroadcastTotal = new client.Counter({
    name: "localchain_tx_broadcast_total",
    help: "Total transactions broadcast",
    labelNames: ["status"],
    registers: [register],
  });

  m.nodeRegistrationsTotal = new client.Counter({
    name: "localchain_node_registrations_total",
    help: "Total node registrations",
    registers: [register],
  });

  m.nodeDeregistrationsTotal = new client.Counter({
    name: "localchain_node_deregistrations_total",
    help: "Total node deregistrations",
    registers: [register],
  });

  m.apiKeysCreatedTotal = new client.Counter({
    name: "localchain_api_keys_created_total",
    help: "Total API keys created",
    registers: [register],
  });

  m.apiKeysRevokedTotal = new client.Counter({
    name: "localchain_api_keys_revoked_total",
    help: "Total API keys revoked",
    registers: [register],
  });

  m.tenantsCreatedTotal = new client.Counter({
    name: "localchain_tenants_created_total",
    help: "Total tenants created",
    registers: [register],
  });

  m.quarantineTotal = new client.Counter({
    name: "localchain_quarantine_total",
    help: "Total items quarantined",
    registers: [register],
  });

  m.rateLimitExceededTotal = new client.Counter({
    name: "localchain_rate_limit_exceeded_total",
    help: "Total rate limit exceeded events",
    registers: [register],
  });

  m.upnpMappingsTotal = new client.Counter({
    name: "localchain_upnp_mappings_total",
    help: "Total UPnP port mappings created",
    registers: [register],
  });

  m.upnpMappingsActive = new client.Gauge({
    name: "localchain_upnp_mappings_active",
    help: "Number of active UPnP mappings",
    registers: [register],
  });

  m.quarantinePending = new client.Gauge({
    name: "localchain_quarantine_pending",
    help: "Number of pending quarantine items",
    registers: [register],
  });

  m.nodeLatency = new client.Histogram({
    name: "localchain_node_latency_seconds",
    help: "Node latency in seconds",
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
    registers: [register],
  });

  m.blockTime = new client.Histogram({
    name: "localchain_block_time_seconds",
    help: "Time between blocks in seconds",
    buckets: [0.5, 1, 2, 3, 5, 8, 10, 15],
    registers: [register],
  });

  m.info = new client.Gauge({
    name: "localchain_info",
    help: "LocalChain API info",
    labelNames: ["version", "platform"],
    registers: [register],
  });
  m.info.set({ version: "1.0.0", platform: os.platform() }, 1);

  return m;
}

metrics = createMetrics();

let lastBlockHeight = 0;
let lastBlockTime = 0;

function httpMiddleware(req, res, next) {
  const start = Date.now();

  const origEnd = res.end;
  res.end = function (...args) {
    const duration = (Date.now() - start) / 1000;
    const status = res.statusCode;

    metrics.apiRequestsTotal.inc({ method: req.method, path: req.path, status: String(status) });
    metrics.requestDuration.observe(duration);

    if (status >= 400) {
      metrics.apiErrorsTotal.inc();
    }

    origEnd.apply(res, args);
  };

  next();
}

function updateChainMetrics(chainInfo) {
  if (!chainInfo) return;

  const height = chainInfo.blockHeight || 0;
  metrics.blockHeight.set(height);
  metrics.peers.set(chainInfo.peers || 0);
  metrics.catchingUp.set(chainInfo.catchingUp ? 1 : 0);

  if (lastBlockHeight > 0 && height > lastBlockHeight) {
    const now = Date.now();
    if (lastBlockTime > 0) {
      const bt = (now - lastBlockTime) / 1000;
      metrics.blockTime.observe(bt);
    }
    lastBlockTime = now;
  } else if (lastBlockHeight === 0 && height > 0) {
    lastBlockTime = Date.now();
  }
  lastBlockHeight = height;
}

function updateNodePoolMetrics(poolStats) {
  if (!poolStats) return;
  metrics.nodePoolSize.set(poolStats.total || 0);
  metrics.nodeOnline.set(poolStats.online || 0);
  metrics.nodeOffline.set(poolStats.offline || 0);
}

function updateSystemMetrics() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  metrics.systemMemUsedPercent.set((1 - freeMem / totalMem) * 100);
  metrics.systemCpuLoad.set(os.loadavg()[0]);
  metrics.systemUptime.set(os.uptime());
}

function updateTenantMetrics(tenantStats) {
  if (!tenantStats) return;
  metrics.activeTenants.set(tenantStats.active_tenants || 0);
  metrics.activeApiKeys.set(tenantStats.total_keys || 0);
}

function updateQuarantineMetrics(count) {
  metrics.quarantinePending.set(count || 0);
}

function updateUpnpMetrics(count) {
  metrics.upnpMappingsActive.set(count || 0);
}

async function generatePrometheusText() {
  updateSystemMetrics();
  return await register.metrics();
}

async function getJsonSummary() {
  updateSystemMetrics();

  const metricFamilies = await register.getMetricsAsArray();
  let requestTotal = 0;
  let errorTotal = 0;

  for (const mf of metricFamilies) {
    if (mf.name === "localchain_api_requests_total") {
      const v = await mf.get();
      requestTotal = v.values.reduce((sum, x) => sum + x.value, 0);
    }
    if (mf.name === "localchain_api_errors_total") {
      const v = await mf.get();
      errorTotal = v.values.reduce((sum, x) => sum + x.value, 0);
    }
  }

  const bh = await metrics.blockHeight.get();
  const p = await metrics.peers.get();
  const cu = await metrics.catchingUp.get();
  const nps = await metrics.nodePoolSize.get();
  const no = await metrics.nodeOnline.get();
  const noff = await metrics.nodeOffline.get();
  const at = await metrics.activeTenants.get();
  const ak = await metrics.activeApiKeys.get();
  const mem = await metrics.systemMemUsedPercent.get();
  const cpu = await metrics.systemCpuLoad.get();
  const up = await metrics.systemUptime.get();
  const tx = await metrics.txBroadcastTotal.get();

  return {
    requests: {
      total: requestTotal,
      errors: errorTotal,
      errorRate: requestTotal > 0 ? ((errorTotal / requestTotal) * 100).toFixed(2) + "%" : "0%",
    },
    chain: {
      blockHeight: bh.values[0]?.value || 0,
      peers: p.values[0]?.value || 0,
      catchingUp: (cu.values[0]?.value || 0) === 1,
    },
    nodes: {
      poolSize: nps.values[0]?.value || 0,
      online: no.values[0]?.value || 0,
      offline: noff.values[0]?.value || 0,
    },
    tenants: {
      active: at.values[0]?.value || 0,
      apiKeys: ak.values[0]?.value || 0,
    },
    system: {
      memUsedPercent: Math.round(mem.values[0]?.value || 0),
      cpuLoad: (cpu.values[0]?.value || 0).toFixed(2),
      uptimeSeconds: Math.round(up.values[0]?.value || 0),
    },
    transactions: {
      total: tx.values.reduce((s, x) => s + x.value, 0),
    },
  };
}

function reset() {
  register.clear();
  metrics = createMetrics();
  lastBlockHeight = 0;
  lastBlockTime = 0;
}

module.exports = {
  get register() { return register; },
  reset,
  httpMiddleware,
  updateChainMetrics,
  updateNodePoolMetrics,
  updateSystemMetrics,
  updateTenantMetrics,
  updateQuarantineMetrics,
  updateUpnpMetrics,
  generatePrometheusText,
  getJsonSummary,
  get apiRequestsTotal() { return metrics.apiRequestsTotal; },
  get apiErrorsTotal() { return metrics.apiErrorsTotal; },
  get requestDuration() { return metrics.requestDuration; },
  get blockHeight() { return metrics.blockHeight; },
  get peers() { return metrics.peers; },
  get catchingUp() { return metrics.catchingUp; },
  get nodeLatency() { return metrics.nodeLatency; },
  get blockTime() { return metrics.blockTime; },
  get txBroadcastTotal() { return metrics.txBroadcastTotal; },
  get nodeRegistrationsTotal() { return metrics.nodeRegistrationsTotal; },
  get nodeDeregistrationsTotal() { return metrics.nodeDeregistrationsTotal; },
  get apiKeysCreatedTotal() { return metrics.apiKeysCreatedTotal; },
  get apiKeysRevokedTotal() { return metrics.apiKeysRevokedTotal; },
  get tenantsCreatedTotal() { return metrics.tenantsCreatedTotal; },
  get nodePoolSize() { return metrics.nodePoolSize; },
  get nodeOnline() { return metrics.nodeOnline; },
  get nodeOffline() { return metrics.nodeOffline; },
  get activeTenants() { return metrics.activeTenants; },
  get activeApiKeys() { return metrics.activeApiKeys; },
  get systemMemUsedPercent() { return metrics.systemMemUsedPercent; },
  get systemCpuLoad() { return metrics.systemCpuLoad; },
  get systemUptime() { return metrics.systemUptime; },
  get quarantinePending() { return metrics.quarantinePending; },
  get upnpMappingsActive() { return metrics.upnpMappingsActive; },
};
