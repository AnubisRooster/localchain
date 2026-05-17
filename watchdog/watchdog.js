// ─────────────────────────────────────────────────────────────
// LocalChain – Watchdog
// Monitors the blockchain node and auto-recovers failures.
// Run via PM2: pm2 start watchdog/watchdog.js
// ─────────────────────────────────────────────────────────────
const { exec, execSync } = require("child_process");
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

let lastRestartTime = 0;
let restartsThisHour = 0;
let lastKnownHeight = 0;
let lastHeightChangeTime = Date.now();

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

function checkProcessAlive(rule) {
  try {
    const processName = rule.processName || "localchaind";
    // Cross-platform process check
    const cmd =
      os.platform() === "win32"
        ? `tasklist /FI "IMAGENAME eq ${processName}.exe" /NH`
        : `pgrep -f ${processName}`;

    const result = execSync(cmd, { encoding: "utf8", timeout: 3000 });

    if (os.platform() === "win32") {
      return { ok: result.includes(processName), pid: "win32" };
    }
    const pids = result.trim().split("\n").filter(Boolean);
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

  // Reset hourly counter
  if (now - lastRestartTime > 3600000) {
    restartsThisHour = 0;
  }

  // Cooldown check
  if (now - lastRestartTime < COOLDOWN) {
    log("WARN", `Restart cooldown active (${((COOLDOWN - (now - lastRestartTime)) / 1000).toFixed(0)}s remaining)`);
    return false;
  }

  // Max restarts check
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
    exec("pm2 restart localchaind", (err, stdout) => {
      if (err) {
        log("ERROR", `PM2 restart failed: ${err.message}`);
        // Fallback: kill and let PM2 autorestart
        log("ACTION", "Fallback: killing localchaind...");
        exec("pkill -f localchaind");
      } else {
        log("ACTION", `PM2 restart output: ${stdout.trim()}`);
      }
    });
  } else if (action === "start") {
    log("ACTION", "Starting localchaind via PM2...");
    exec("pm2 start localchaind", (err, stdout) => {
      if (err) {
        log("ERROR", `PM2 start failed: ${err.message}`);
      } else {
        log("ACTION", `PM2 start output: ${stdout.trim()}`);
      }
    });
  }
}

// ══════════════════════════════════════════════════════════
// Main loop
// ══════════════════════════════════════════════════════════

async function runChecks() {
  for (const rule of rules) {
    if (!rule.enabled) continue;

    const checkFn = CHECK_MAP[rule.check];
    if (!checkFn) {
      log("WARN", `Unknown check type: ${rule.check}`);
      continue;
    }

    try {
      const result = await checkFn(rule);
      if (!result.ok) {
        log("ALERT", `[${rule.id}] ${result.reason}`);
        performAction(rule.action);
      }
    } catch (err) {
      log("ERROR", `[${rule.id}] Check threw: ${err.message}`);
    }
  }
}

// ── Start ───────────────────────────────────────────────────
log("INFO", "🐺 Watchdog started");
log("INFO", `   Check interval : ${CHECK_INTERVAL}ms`);
log("INFO", `   Restart cooldown: ${COOLDOWN}ms`);
log("INFO", `   Max restarts/hr : ${MAX_RESTARTS}`);
log("INFO", `   Active rules    : ${rules.filter((r) => r.enabled).length}`);

setInterval(runChecks, CHECK_INTERVAL);
// Run once immediately
runChecks();
