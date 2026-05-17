// ─────────────────────────────────────────────────────────────
// LocalChain – Watchdog
// Monitors the blockchain node and auto-recovers failures.
// Run via PM2: pm2 start watchdog/watchdog.js
// ─────────────────────────────────────────────────────────────
const { execFile } = require("child_process");
const os = require("os");
const fs = require("fs");
const http = require("http");
const path = require("path");

// ── Load rules ──────────────────────────────────────────────
const rulesPath = path.join(__dirname, "rules.json");
const { rules, settings } = JSON.parse(fs.readFileSync(rulesPath, "utf8"));

const CHECK_INTERVAL = settings.checkIntervalMs || 5000;
const COOLDOWN = settings.restartCooldownMs || 60000;
const MAX_RESTARTS = settings.maxRestartsPerHour || 5;
const HEALTH_PORT = settings.healthPort || 3002;

let lastRestartTime = 0;
let restartsThisHour = 0;
let lastKnownHeight = 0;
let lastHeightChangeTime = Date.now();
let watchdogStartTime = Date.now();
let totalChecks = 0;
let failedChecks = 0;

// ── Logging ─────────────────────────────────────────────────
const logFile = settings.logFile
  ? fs.createWriteStream(path.join(__dirname, settings.logFile), { flags: "a" })
  : null;

function log(level, msg) {
  const line = `[${new Date().toISOString()}] [${level}] ${msg}`;
  console.log(line);
  if (logFile) logFile.write(line + "\n");
}

// ── HTTP helper ─────────────────────────────────────────────
function httpGet(url, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("timeout"));
    });
  });
}

// ── execFile wrapper ────────────────────────────────────────
function runCommand(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 10000, ...options }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout.trim());
    });
  });
}

// ══════════════════════════════════════════════════════════
// Check functions
// ══════════════════════════════════════════════════════════

async function checkStaleBlocks(rule) {
  try {
    const status = await httpGet("http://localhost:26657/status");
    const height = parseInt(status.result.sync_info.latest_block_height, 10);

    if (height !== lastKnownHeight) {
      lastKnownHeight = height;
      lastHeightChangeTime = Date.now();
      return { ok: true, height };
    }

    const staleMins = (Date.now() - lastHeightChangeTime) / 60000;
    if (staleMins >= rule.thresholdMinutes) {
      return {
        ok: false,
        reason: `No new blocks for ${staleMins.toFixed(1)} minutes (stuck at ${height})`,
      };
    }
    return { ok: true, height, staleMins: staleMins.toFixed(1) };
  } catch (err) {
    return { ok: false, reason: `RPC unreachable: ${err.message}` };
  }
}

function checkCpuLoad(rule) {
  const load1m = os.loadavg()[0];
  const cpuCount = os.cpus().length;
  const loadPercent = (load1m / cpuCount) * 100;

  if (loadPercent > rule.thresholdPercent) {
    return {
      ok: false,
      reason: `CPU load ${loadPercent.toFixed(1)}% exceeds ${rule.thresholdPercent}%`,
    };
  }
  return { ok: true, loadPercent: loadPercent.toFixed(1) };
}

function checkMemoryUsage(rule) {
  const usedPercent = ((1 - os.freemem() / os.totalmem()) * 100);

  if (usedPercent > rule.thresholdPercent) {
    return {
      ok: false,
      reason: `Memory ${usedPercent.toFixed(1)}% exceeds ${rule.thresholdPercent}%`,
    };
  }
  return { ok: true, memPercent: usedPercent.toFixed(1) };
}

async function checkProcessAlive(rule) {
  try {
    const processName = rule.processName || "localchaind";

    if (os.platform() === "win32") {
      const result = await runCommand("tasklist", ["/FI", `IMAGENAME eq ${processName}.exe`, "/NH"]);
      return { ok: result.includes(processName), pid: "win32" };
    }

    const result = await runCommand("pgrep", ["-f", processName]);
    const pids = result.split("\n").filter(Boolean);
    return pids.length > 0
      ? { ok: true, pid: pids[0] }
      : { ok: false, reason: `${processName} process not found` };
  } catch {
    return { ok: false, reason: `${rule.processName || "localchaind"} process not found` };
  }
}

async function checkRpcHealth(rule) {
  try {
    const endpoint = rule.endpoint || "http://localhost:26657/status";
    await httpGet(endpoint, rule.timeoutMs || 5000);
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: `RPC health check failed: ${err.message}` };
  }
}

const CHECK_MAP = {
  staleBlocks: checkStaleBlocks,
  cpuLoad: checkCpuLoad,
  memoryUsage: checkMemoryUsage,
  processAlive: checkProcessAlive,
  rpcHealth: checkRpcHealth,
};

// ══════════════════════════════════════════════════════════
// Actions
// ══════════════════════════════════════════════════════════

function canRestart() {
  const now = Date.now();

  if (now - lastRestartTime > 3600000) {
    restartsThisHour = 0;
  }

  if (now - lastRestartTime < COOLDOWN) {
    log("WARN", `Restart cooldown active (${((COOLDOWN - (now - lastRestartTime)) / 1000).toFixed(0)}s remaining)`);
    return false;
  }

  if (restartsThisHour >= MAX_RESTARTS) {
    log("ERROR", `Max restarts (${MAX_RESTARTS}/hr) reached — manual intervention needed`);
    return false;
  }

  return true;
}

function performAction(action) {
  if (!canRestart()) return;

  const now = Date.now();
  lastRestartTime = now;
  restartsThisHour++;

  if (action === "restart") {
    log("ACTION", "Restarting localchaind via PM2...");
    runCommand("pm2", ["restart", "localchaind"])
      .then((stdout) => log("ACTION", `PM2 restart output: ${stdout}`))
      .catch((err) => {
        log("ERROR", `PM2 restart failed: ${err.message}`);
        log("ACTION", "Fallback: killing localchaind...");
        runCommand("pkill", ["-f", "localchaind"]).catch(() => {});
      });
  } else if (action === "start") {
    log("ACTION", "Starting localchaind via PM2...");
    runCommand("pm2", ["start", "localchaind"])
      .then((stdout) => log("ACTION", `PM2 start output: ${stdout}`))
      .catch((err) => log("ERROR", `PM2 start failed: ${err.message}`));
  }
}

// ══════════════════════════════════════════════════════════
// Watchdog self-health endpoint
// ══════════════════════════════════════════════════════════

function startHealthServer() {
  const server = http.createServer((req, res) => {
    if (req.url === "/health" || req.url === "/") {
      const uptime = Math.round((Date.now() - watchdogStartTime) / 1000);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        status: "ok",
        uptime_seconds: uptime,
        checks: {
          total: totalChecks,
          failed: failedChecks,
          success_rate: totalChecks > 0 ? ((1 - failedChecks / totalChecks) * 100).toFixed(1) + "%" : "100%",
        },
        restarts: {
          this_hour: restartsThisHour,
          max_per_hour: MAX_RESTARTS,
          cooldown_remaining: Math.max(0, Math.round((COOLDOWN - (Date.now() - lastRestartTime)) / 1000)),
        },
        config: {
          check_interval_ms: CHECK_INTERVAL,
          active_rules: rules.filter((r) => r.enabled).length,
        },
      }));
    } else if (req.url === "/status") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        last_known_height: lastKnownHeight,
        last_height_change: new Date(lastHeightChangeTime).toISOString(),
        last_restart: lastRestartTime > 0 ? new Date(lastRestartTime).toISOString() : null,
      }));
    } else {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
    }
  });

  server.listen(HEALTH_PORT, () => {
    log("INFO", `Watchdog health endpoint: http://localhost:${HEALTH_PORT}/health`);
  });

  return server;
}

// ══════════════════════════════════════════════════════════
// Main loop
// ══════════════════════════════════════════════════════════

async function runChecks() {
  for (const rule of rules) {
    if (!rule.enabled) continue;

    totalChecks++;
    const checkFn = CHECK_MAP[rule.check];
    if (!checkFn) {
      log("WARN", `Unknown check type: ${rule.check}`);
      continue;
    }

    try {
      const result = await checkFn(rule);
      if (!result.ok) {
        failedChecks++;
        log("ALERT", `[${rule.id}] ${result.reason}`);
        performAction(rule.action);
      }
    } catch (err) {
      failedChecks++;
      log("ERROR", `[${rule.id}] Check threw: ${err.message}`);
    }
  }
}

// ── Start ───────────────────────────────────────────────────
log("INFO", "Watchdog started");
log("INFO", `   Check interval : ${CHECK_INTERVAL}ms`);
log("INFO", `   Restart cooldown: ${COOLDOWN}ms`);
log("INFO", `   Max restarts/hr : ${MAX_RESTARTS}`);
log("INFO", `   Active rules    : ${rules.filter((r) => r.enabled).length}`);

startHealthServer();
setInterval(runChecks, CHECK_INTERVAL);
runChecks();
