// ─────────────────────────────────────────────────────────────
// LocalChain – Network Detection Service
// Unified address detection for Tailscale, UPnP/public IP, and LAN.
// Used by Bootstrap API, join token generation, and UPnP service.
// ─────────────────────────────────────────────────────────────
const { execFile } = require("child_process");
const os = require("os");

/**
 * Gets the Tailscale IPv4 address, or null if not available.
 * Runs `tailscale ip -4` with a 2-second timeout.
 */
async function getTailscaleIp() {
  return new Promise((resolve) => {
    execFile("tailscale", ["ip", "-4"], { timeout: 2000 }, (err, stdout) => {
      if (err) return resolve(null);
      const ip = stdout.trim().split("\n")[0];
      if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
        return resolve(ip);
      }
      resolve(null);
    });
  });
}

/**
 * Gets the LAN IPv4 address (first non-internal interface).
 */
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

/**
 * Detects all addresses this node is reachable at.
 * Returns an array of { type, ip } objects.
 *
 * Detection order:
 *   1. Tailscale IP (if tailscale CLI available)
 *   2. UPnP external IP (if provided)
 *   3. LAN IP (always available)
 */
async function detectAddresses(externalIp = null) {
  const addresses = [];

  const tailscaleIp = await getTailscaleIp();
  if (tailscaleIp) {
    addresses.push({ type: "tailscale", ip: tailscaleIp });
  }

  if (externalIp) {
    addresses.push({ type: "public", ip: externalIp });
  }

  const lanIp = getLocalIp();
  addresses.push({ type: "lan", ip: lanIp });

  return addresses;
}

/**
 * Builds a list of addresses with ports for a specific service.
 * Example: buildEndpoints([{ type: "tailscale", ip: "100.64.0.1" }], 26656) →
 *   [{ type: "tailscale", address: "100.64.0.1:26656" }, ...]
 */
function buildEndpoints(addresses, port) {
  return addresses.map((a) => ({
    type: a.type,
    address: `${a.ip}:${port}`,
  }));
}

/**
 * Builds full API URLs from detected addresses.
 * Example: buildApiUrls([{ type: "tailscale", ip: "100.64.0.1" }], 4000) →
 *   [{ type: "tailscale", url: "http://100.64.0.1:4000" }, ...]
 */
function buildApiUrls(addresses, port) {
  return addresses.map((a) => ({
    type: a.type,
    url: `http://${a.ip}:${port}`,
  }));
}

module.exports = {
  getTailscaleIp,
  getLocalIp,
  detectAddresses,
  buildEndpoints,
  buildApiUrls,
};
