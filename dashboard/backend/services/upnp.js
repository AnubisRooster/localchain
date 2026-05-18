// ─────────────────────────────────────────────────────────────
// LocalChain – UPnP Auto-Config Service
// Discovers local network validators, maps ports via UPnP/NAT-PMP,
// and auto-registers nodes in the validator registry.
// ─────────────────────────────────────────────────────────────
const NatAPI = require("nat-api");
const os = require("os");
const http = require("http");
const { registerNode, getAllNodes } = require("./registry");

const DISCOVERY_INTERVAL_MS = parseInt(process.env.UPNP_DISCOVERY_INTERVAL_MS, 10) || 60_000;
const PORT_MAP_TTL = parseInt(process.env.UPNP_PORT_MAP_TTL, 10) || 86400;
const P2P_PORT = parseInt(process.env.P2P_PORT, 10) || 26656;
const RPC_PORT = parseInt(process.env.RPC_PORT, 10) || 26657;
const REST_PORT = parseInt(process.env.REST_PORT, 10) || 1317;
const API_PORT = parseInt(process.env.API_PORT, 10) || 4000;
const DASHBOARD_PORT = parseInt(process.env.FRONTEND_PORT, 10) || 3000;

let natClient = null;
let discoveryInterval = null;
let mappedPorts = [];
let externalIp = null;
let discoveryLog = [];
let isInitialized = false;

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "127.0.0.1";
}

function getLocalNetworks() {
  const networks = [];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        const parts = iface.address.split(".");
        networks.push(`${parts[0]}.${parts[1]}.${parts[2]}.0/24`);
      }
    }
  }
  return networks;
}

async function initGateway() {
  if (isInitialized) return { success: true, externalIp, gatewayType: natClient ? "UPnP" : "none" };

  try {
    natClient = new NatAPI();

    externalIp = await new Promise((resolve, reject) => {
      natClient.externalIp((err, ip) => {
        if (err) reject(err);
        else resolve(ip);
      });
    });

    isInitialized = true;
    return { success: true, externalIp, gatewayType: "UPnP/NAT-PMP" };
  } catch (err) {
    return { success: false, reason: err.message };
  }
}

function mapPort(internalPort, protocol = "tcp", description = "localchain") {
  return new Promise((resolve) => {
    if (!natClient) return resolve(null);

    natClient.map(
      {
        public: internalPort,
        private: internalPort,
        protocol,
        description,
        ttl: PORT_MAP_TTL,
      },
      (err) => {
        if (err) {
          console.warn(`[upnp] Failed to map port ${internalPort}/${protocol}: ${err.message}`);
          return resolve(null);
        }

        mappedPorts.push({ internalPort, externalPort: internalPort, protocol, description });
        resolve({ internalPort, externalPort: internalPort, protocol });
      }
    );
  });
}

async function mapAllPorts() {
  const results = {};
  results.p2p = await mapPort(P2P_PORT, "tcp", "localchain-p2p");
  results.p2pUdp = await mapPort(P2P_PORT, "udp", "localchain-p2p-udp");
  results.rpc = await mapPort(RPC_PORT, "tcp", "localchain-rpc");
  results.rest = await mapPort(REST_PORT, "tcp", "localchain-rest");
  results.api = await mapPort(API_PORT, "tcp", "localchain-api");

  if (process.env.UPNP_MAP_DASHBOARD === "1") {
    results.dashboard = await mapPort(DASHBOARD_PORT, "tcp", "localchain-dashboard");
  }

  return results;
}

function unmapAllPorts() {
  return new Promise((resolve) => {
    if (!natClient || mappedPorts.length === 0) return resolve();

    let remaining = mappedPorts.length;
    if (remaining === 0) return resolve();

    for (const port of mappedPorts) {
      natClient.unmap(
        { public: port.internalPort, protocol: port.protocol },
        () => {
          remaining--;
          if (remaining <= 0) {
            mappedPorts = [];
            resolve();
          }
        }
      );
    }
  });
}

async function scanLocalNetwork() {
  const localIp = getLocalIp();
  const parts = localIp.split(".");
  const subnet = `${parts[0]}.${parts[1]}.${parts[2]}`;
  const discovered = [];

  const scanPromises = [];
  for (let i = 1; i <= 20; i++) {
    const host = `${subnet}.${i}`;
    if (host === localIp) continue;

    scanPromises.push(
      probeHost(host, RPC_PORT).then((result) => {
        if (result.online) {
          discovered.push({
            host,
            rpcPort: RPC_PORT,
            restPort: REST_PORT,
            p2pPort: P2P_PORT,
            ...result,
          });
        }
      })
    );
  }

  await Promise.allSettled(scanPromises);
  return discovered;
}

function probeHost(host, port) {
  return new Promise((resolve) => {
    const req = http.get(`http://${host}:${port}/status`, { timeout: 2000 }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          const info = json.result;
          resolve({
            online: true,
            nodeId: info.node_info?.id || "unknown",
            moniker: info.node_info?.moniker || host,
            network: info.node_info?.network || "unknown",
            blockHeight: parseInt(info.sync_info?.latest_block_height || "0", 10),
            catchingUp: info.sync_info?.catching_up || false,
          });
        } catch {
          resolve({ online: false });
        }
      });
    });

    req.on("error", () => resolve({ online: false }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ online: false });
    });
  });
}

async function autoRegisterDiscovered(discovered) {
  const existing = getAllNodes();
  const existingHosts = new Set(existing.map((n) => n.public_endpoint));
  const registered = [];

  for (const node of discovered) {
    if (existingHosts.has(node.host)) continue;

    const nodeId = node.nodeId || `auto-${node.host.replace(/\./g, "-")}`;
    try {
      registerNode({
        node_id: nodeId,
        moniker: node.moniker,
        public_endpoint: node.host,
        rpc_port: node.rpcPort,
        rest_port: node.restPort,
        p2p_port: node.p2pPort,
        network: node.network,
      });

      registered.push({ node_id: nodeId, host: node.host, moniker: node.moniker });
      discoveryLog.push({
        time: new Date().toISOString(),
        action: "auto-register",
        node_id: nodeId,
        host: node.host,
      });
    } catch (err) {
      console.warn(`[upnp] Failed to register ${node.host}: ${err.message}`);
    }
  }

  return registered;
}

async function runDiscovery() {
  const discovered = await scanLocalNetwork();
  const registered = await autoRegisterDiscovered(discovered);

  if (registered.length > 0) {
    console.log(`[upnp] Auto-registered ${registered.length} nodes:`, registered.map((r) => r.moniker).join(", "));
  }

  return { discovered: discovered.length, registered: registered.length };
}

function startDiscoveryLoop() {
  if (discoveryInterval) return;

  console.log(`[upnp] Starting discovery loop (every ${DISCOVERY_INTERVAL_MS / 1000}s)`);

  setTimeout(() => {
    runDiscovery().catch((err) => console.error(`[upnp] Discovery error: ${err.message}`));
  }, 10000);

  discoveryInterval = setInterval(() => {
    runDiscovery().catch((err) => console.error(`[upnp] Discovery error: ${err.message}`));
  }, DISCOVERY_INTERVAL_MS);
}

function stopDiscoveryLoop() {
  if (discoveryInterval) {
    clearInterval(discoveryInterval);
    discoveryInterval = null;
  }
}

async function getStatus() {
  return {
    enabled: process.env.UPNP_ENABLED === "1" || process.env.UPNP_ENABLED === "true",
    initialized: isInitialized,
    externalIp,
    mappedPorts,
    localIp: getLocalIp(),
    localNetworks: getLocalNetworks(),
    discoveryLog: discoveryLog.slice(-20),
    discoveryIntervalMs: DISCOVERY_INTERVAL_MS,
  };
}

module.exports = {
  initGateway,
  mapPort,
  mapAllPorts,
  unmapAllPorts,
  scanLocalNetwork,
  autoRegisterDiscovered,
  runDiscovery,
  startDiscoveryLoop,
  stopDiscoveryLoop,
  getStatus,
  getLocalIp,
};
