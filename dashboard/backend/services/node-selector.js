// ─────────────────────────────────────────────────────────────
// LocalChain – Node Selector & Connection Pool
// Routes API requests to specific registered validators via ?node= param.
// Maintains a pool of axios clients for online nodes.
// ─────────────────────────────────────────────────────────────
const axios = require("axios");
const { getAllNodes, getOnlineEndpoints } = require("./registry");

const pool = new Map();
let roundRobinIndex = 0;

function createClient(baseUrl, timeout = 8000) {
  return axios.create({ baseURL: baseUrl, timeout });
}

function getOrCreateClient(key, baseUrl) {
  if (!pool.has(key)) {
    pool.set(key, createClient(baseUrl));
  }
  return pool.get(key);
}

function buildNodeUrl(node) {
  return `http://${node.public_endpoint || node.host}:${node.rpc_port || 26657}`;
}

function buildRestUrl(node) {
  return `http://${node.public_endpoint || node.host}:${node.rest_port || 1317}`;
}

function selectNode(strategy = "lowest-latency") {
  const nodes = getAllNodes().filter((n) => n.status === "online");

  if (nodes.length === 0) return null;

  switch (strategy) {
    case "round-robin": {
      const node = nodes[roundRobinIndex % nodes.length];
      roundRobinIndex++;
      return node;
    }
    case "random": {
      return nodes[Math.floor(Math.random() * nodes.length)];
    }
    case "lowest-latency":
    default: {
      return nodes.reduce((best, n) =>
        (!best || n.latency_ms < best.latency_ms) ? n : best
      );
    }
  }
}

function getNodeById(nodeId) {
  const nodes = getAllNodes();
  return nodes.find((n) => n.node_id === nodeId) || null;
}

function getTendermintClient(node) {
  const url = buildNodeUrl(node);
  return getOrCreateClient(`tm:${url}`, url);
}

function getRestClient(node) {
  const url = buildRestUrl(node);
  return getOrCreateClient(`rest:${url}`, url);
}

async function routeRequest(req, res, endpoint, type = "tendermint") {
  const nodeId = req.query.node;

  let node;
  if (nodeId) {
    node = getNodeById(nodeId);
    if (!node) {
      return res.status(404).json({ error: `Node '${nodeId}' not found in registry` });
    }
    if (node.status !== "online") {
      return res.status(503).json({ error: `Node '${nodeId}' is ${node.status}`, node });
    }
  } else {
    node = selectNode();
    if (!node) {
      return null;
    }
  }

  const client = type === "tendermint" ? getTendermintClient(node) : getRestClient(node);

  try {
    const response = await client.get(endpoint, {
      params: req.query,
    });
    return { data: response.data, node };
  } catch (err) {
    return { error: err.message, node };
  }
}

function clearPool() {
  pool.clear();
  roundRobinIndex = 0;
}

function getPoolStats() {
  return {
    size: pool.size,
    keys: Array.from(pool.keys()),
  };
}

module.exports = {
  selectNode,
  getNodeById,
  getTendermintClient,
  getRestClient,
  routeRequest,
  clearPool,
  getPoolStats,
  pool,
};
