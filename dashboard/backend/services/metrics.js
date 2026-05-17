// ─────────────────────────────────────────────────────────────
// LocalChain – Prometheus Metrics Service
// Counters, gauges, histograms, and summary metrics.
// ─────────────────────────────────────────────────────────────

const os = require("os");

// ── Metric stores ──────────────────────────────────────────
const counters = new Map();
const gauges = new Map();
const histograms = new Map();

// ── HTTP request tracking ──────────────────────────────────
const requestLatencies = [];
const MAX_LATENCY_SAMPLES = 1000;

function init() {
  // Counters
  counters.set("localchain_api_requests_total", { value: 0, help: "Total API requests", type: "counter" });
  counters.set("localchain_api_errors_total", { value: 0, help: "Total API errors", type: "counter" });
  counters.set("localchain_api_requests_by_path_total", { values: new Map(), help: "Total API requests by path", type: "counter" });
  counters.set("localchain_api_requests_by_method_total", { values: new Map(), help: "Total API requests by HTTP method", type: "counter" });
  counters.set("localchain_api_requests_by_status_total", { values: new Map(), help: "Total API requests by status code", type: "counter" });
  counters.set("localchain_tx_broadcast_total", { value: 0, help: "Total transactions broadcast", type: "counter" });
  counters.set("localchain_tx_broadcast_success_total", { value: 0, help: "Successful transaction broadcasts", type: "counter" });
  counters.set("localchain_tx_broadcast_failed_total", { value: 0, help: "Failed transaction broadcasts", type: "counter" });
  counters.set("localchain_node_registrations_total", { value: 0, help: "Total node registrations", type: "counter" });
  counters.set("localchain_node_deregistrations_total", { value: 0, help: "Total node deregistrations", type: "counter" });
  counters.set("localchain_api_keys_created_total", { value: 0, help: "Total API keys created", type: "counter" });
  counters.set("localchain_api_keys_revoked_total", { value: 0, help: "Total API keys revoked", type: "counter" });
  counters.set("localchain_tenants_created_total", { value: 0, help: "Total tenants created", type: "counter" });
  counters.set("localchain_rate_limit_exceeded_total", { value: 0, help: "Total rate limit exceeded events", type: "counter" });
  counters.set("localchain_quarantine_total", { value: 0, help: "Total items quarantined", type: "counter" });
  counters.set("localchain_upnp_mappings_total", { value: 0, help: "Total UPnP port mappings created", type: "counter" });

  // Gauges
  gauges.set("localchain_block_height", { value: 0, help: "Current block height", type: "gauge" });
  gauges.set("localchain_peers", { value: 0, help: "Number of connected peers", type: "gauge" });
  gauges.set("localchain_catching_up", { value: 0, help: "Whether the node is catching up (1=yes, 0=no)", type: "gauge" });
  gauges.set("localchain_system_mem_used_percent", { value: 0, help: "System memory usage percent", type: "gauge" });
  gauges.set("localchain_system_cpu_load", { value: 0, help: "System 1-minute load average", type: "gauge" });
  gauges.set("localchain_system_uptime_seconds", { value: 0, help: "System uptime in seconds", type: "gauge" });
  gauges.set("localchain_node_pool_size", { value: 0, help: "Number of nodes in connection pool", type: "gauge" });
  gauges.set("localchain_node_online", { value: 0, help: "Number of online nodes", type: "gauge" });
  gauges.set("localchain_node_offline", { value: 0, help: "Number of offline nodes", type: "gauge" });
  gauges.set("localchain_active_tenants", { value: 0, help: "Number of active tenants", type: "gauge" });
  gauges.set("localchain_active_api_keys", { value: 0, help: "Number of active API keys", type: "gauge" });
  gauges.set("localchain_quarantine_pending", { value: 0, help: "Number of pending quarantine items", type: "gauge" });
  gauges.set("localchain_upnp_mappings_active", { value: 0, help: "Number of active UPnP mappings", type: "gauge" });
  gauges.set("localchain_process_heap_used_mb", { value: 0, help: "Node.js heap used in MB", type: "gauge" });
  gauges.set("localchain_process_heap_total_mb", { value: 0, help: "Node.js heap total in MB", type: "gauge" });
  gauges.set("localchain_process_rss_mb", { value: 0, help: "Node.js RSS memory in MB", type: "gauge" });

  // Histograms
  histograms.set("localchain_request_duration_seconds", { help: "Request duration in seconds", type: "histogram", buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10], samples: [] });
  histograms.set("localchain_block_time_seconds", { help: "Time between blocks in seconds", type: "histogram", buckets: [0.5, 1, 2, 3, 5, 8, 10, 15], samples: [] });
  histograms.set("localchain_node_latency_seconds", { help: "Node latency in seconds", type: "histogram", buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1], samples: [] });
}

// ── Counter operations ─────────────────────────────────────
function incCounter(name, labels = {}, value = 1) {
  const c = counters.get(name);
  if (!c) return;
  if (c.values) {
    const key = Object.entries(labels).sort().map(([k, v]) => `${k}="${v}"`).join(",");
    c.values.set(key, (c.values.get(key) || 0) + value);
  } else {
    c.value += value;
  }
}

function setGauge(name, value) {
  const g = gauges.get(name);
  if (g) g.value = value;
}

function incGauge(name, delta = 1) {
  const g = gauges.get(name);
  if (g) g.value += delta;
}

function observeHistogram(name, value) {
  const h = histograms.get(name);
  if (!h) return;
  h.samples.push(value);
  if (h.samples.length > 10000) h.samples = h.samples.slice(-5000);
}

// ── HTTP middleware ────────────────────────────────────────
let lastBlockHeight = 0;
let lastBlockTime = 0;

function httpMiddleware(req, res, next) {
  const start = Date.now();

  incCounter("localchain_api_requests_total");
  incCounter("localchain_api_requests_by_method_total", { method: req.method });

  const origEnd = res.end;
  res.end = function (...args) {
    const duration = (Date.now() - start) / 1000;
    const status = res.statusCode;

    incCounter("localchain_api_requests_by_path_total", { path: req.path });
    incCounter("localchain_api_requests_by_status_total", { status: String(status) });
    observeHistogram("localchain_request_duration_seconds", duration);

    if (status >= 400) {
      incCounter("localchain_api_errors_total");
    }

    origEnd.apply(res, args);
  };

  next();
}

// ── Chain metrics updater ──────────────────────────────────
function updateChainMetrics(chainInfo) {
  if (!chainInfo) return;

  const height = chainInfo.blockHeight || 0;
  setGauge("localchain_block_height", height);
  setGauge("localchain_peers", chainInfo.peers || 0);
  setGauge("localchain_catching_up", chainInfo.catchingUp ? 1 : 0);

  if (lastBlockHeight > 0 && height > lastBlockHeight) {
    const now = Date.now();
    if (lastBlockTime > 0) {
      const blockTime = (now - lastBlockTime) / 1000;
      observeHistogram("localchain_block_time_seconds", blockTime);
    }
    lastBlockTime = now;
  }
  lastBlockHeight = height;
}

function updateNodePoolMetrics(poolStats) {
  if (!poolStats) return;
  setGauge("localchain_node_pool_size", poolStats.total || 0);
  setGauge("localchain_node_online", poolStats.online || 0);
  setGauge("localchain_node_offline", poolStats.offline || 0);
}

function updateSystemMetrics() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  setGauge("localchain_system_mem_used_percent", ((1 - freeMem / totalMem) * 100));
  setGauge("localchain_system_cpu_load", os.loadavg()[0]);
  setGauge("localchain_system_uptime_seconds", os.uptime());

  try {
    const memUsage = process.memoryUsage();
    setGauge("localchain_process_heap_used_mb", Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100);
    setGauge("localchain_process_heap_total_mb", Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100);
    setGauge("localchain_process_rss_mb", Math.round(memUsage.rss / 1024 / 1024 * 100) / 100);
  } catch {}
}

function updateTenantMetrics(tenantStats) {
  if (!tenantStats) return;
  setGauge("localchain_active_tenants", tenantStats.active_tenants || 0);
  setGauge("localchain_active_api_keys", tenantStats.total_keys || 0);
}

function updateQuarantineMetrics(count) {
  setGauge("localchain_quarantine_pending", count || 0);
}

function updateUpnpMetrics(count) {
  setGauge("localchain_upnp_mappings_active", count || 0);
}

// ── Prometheus text format ─────────────────────────────────
function histogramStats(samples, buckets) {
  if (!samples || samples.length === 0) {
    return { count: 0, sum: 0, bucketLines: "" };
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const count = sorted.length;

  let cumulative = 0;
  const bucketLines = buckets.map((le) => {
    cumulative += sorted.filter((v) => v <= le).length;
    return `  le="${le}" ${cumulative}`;
  }).join("\n");

  return { count, sum, bucketLines, cumulative };
}

function generatePrometheusText() {
  updateSystemMetrics();

  const lines = [];
  lines.push("# HELP localchain_info LocalChain API info");
  lines.push("# TYPE localchain_info gauge");
  lines.push(`localchain_info{version="1.0.0", platform="${os.platform()}"} 1`);

  // Counters
  for (const [name, metric] of counters) {
    lines.push(`# HELP ${name} ${metric.help}`);
    lines.push(`# TYPE ${name} counter`);
    if (metric.values) {
      for (const [labels, value] of metric.values) {
        lines.push(`${name}{${labels}} ${value}`);
      }
    } else {
      lines.push(`${name} ${metric.value}`);
    }
  }

  // Gauges
  for (const [name, metric] of gauges) {
    lines.push(`# HELP ${name} ${metric.help}`);
    lines.push(`# TYPE ${name} gauge`);
    lines.push(`${name} ${metric.value}`);
  }

  // Histograms
  for (const [name, metric] of histograms) {
    lines.push(`# HELP ${name} ${metric.help}`);
    lines.push(`# TYPE ${name} histogram`);
    const stats = histogramStats(metric.samples, metric.buckets);
    for (const le of metric.buckets) {
      const count = metric.samples.filter((v) => v <= le).length;
      lines.push(`${name}_bucket{le="${le}"} ${count}`);
    }
    lines.push(`${name}_bucket{le="+Inf"} ${stats.count}`);
    lines.push(`${name}_sum ${stats.sum.toFixed(6)}`);
    lines.push(`${name}_count ${stats.count}`);
  }

  // Latency percentiles (from samples)
  if (requestLatencies.length > 0) {
    const sorted = [...requestLatencies].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    lines.push("# HELP localchain_request_latency_p50 Request latency p50 (ms)");
    lines.push("# TYPE localchain_request_latency_p50 gauge");
    lines.push(`localchain_request_latency_p50 ${p50}`);
    lines.push("# HELP localchain_request_latency_p95 Request latency p95 (ms)");
    lines.push("# TYPE localchain_request_latency_p95 gauge");
    lines.push(`localchain_request_latency_p95 ${p95}`);
    lines.push("# HELP localchain_request_latency_p99 Request latency p99 (ms)");
    lines.push("# TYPE localchain_request_latency_p99 gauge");
    lines.push(`localchain_request_latency_p99 ${p99}`);
  }

  return lines.join("\n") + "\n";
}

// ── JSON summary for dashboard ─────────────────────────────
function getJsonSummary() {
  updateSystemMetrics();

  const h = histograms.get("localchain_request_duration_seconds");
  const latencies = h ? [...h.samples].sort((a, b) => a - b) : [];
  const p50 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.5)] * 1000 : 0;
  const p95 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] * 1000 : 0;
  const p99 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.99)] * 1000 : 0;

  const reqCounter = counters.get("localchain_api_requests_total");
  const errCounter = counters.get("localchain_api_errors_total");
  const pathCounter = counters.get("localchain_api_requests_by_path_total");

  const topPaths = pathCounter ? [...pathCounter.values.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([labels, value]) => ({ path: labels.replace('path="', '').replace('"', ''), count: value }))
    : [];

  return {
    requests: {
      total: reqCounter ? reqCounter.value : 0,
      errors: errCounter ? errCounter.value : 0,
      errorRate: reqCounter && reqCounter.value > 0
        ? ((errCounter ? errCounter.value : 0) / reqCounter.value * 100).toFixed(2) + "%"
        : "0%",
    },
    latency: {
      p50_ms: Math.round(p50),
      p95_ms: Math.round(p95),
      p99_ms: Math.round(p99),
    },
    chain: {
      blockHeight: gauges.get("localchain_block_height")?.value || 0,
      peers: gauges.get("localchain_peers")?.value || 0,
      catchingUp: gauges.get("localchain_catching_up")?.value === 1,
    },
    nodes: {
      poolSize: gauges.get("localchain_node_pool_size")?.value || 0,
      online: gauges.get("localchain_node_online")?.value || 0,
      offline: gauges.get("localchain_node_offline")?.value || 0,
    },
    tenants: {
      active: gauges.get("localchain_active_tenants")?.value || 0,
      apiKeys: gauges.get("localchain_active_api_keys")?.value || 0,
    },
    system: {
      memUsedPercent: Math.round(gauges.get("localchain_system_mem_used_percent")?.value || 0),
      cpuLoad: (gauges.get("localchain_system_cpu_load")?.value || 0).toFixed(2),
      uptimeSeconds: Math.round(gauges.get("localchain_system_uptime_seconds")?.value || 0),
      heapUsedMB: gauges.get("localchain_process_heap_used_mb")?.value || 0,
      rssMB: gauges.get("localchain_process_rss_mb")?.value || 0,
    },
    transactions: {
      total: counters.get("localchain_tx_broadcast_total")?.value || 0,
      success: counters.get("localchain_tx_broadcast_success_total")?.value || 0,
      failed: counters.get("localchain_tx_broadcast_failed_total")?.value || 0,
    },
    topPaths,
  };
}

function reset() {
  counters.clear();
  gauges.clear();
  histograms.clear();
  requestLatencies.length = 0;
  lastBlockHeight = 0;
  lastBlockTime = 0;
  init();
}

init();

module.exports = {
  init,
  reset,
  incCounter,
  setGauge,
  incGauge,
  observeHistogram,
  httpMiddleware,
  updateChainMetrics,
  updateNodePoolMetrics,
  updateSystemMetrics,
  updateTenantMetrics,
  updateQuarantineMetrics,
  updateUpnpMetrics,
  generatePrometheusText,
  getJsonSummary,
  counters,
  gauges,
  histograms,
};
