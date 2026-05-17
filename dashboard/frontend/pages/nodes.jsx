import { useState } from "react";
import { useApi } from "../components/useApi";
import StatCard from "../components/StatCard";

export default function Nodes() {
  const { data: nodesData, loading, refetch } = useApi("/api/nodes", 8000);
  const { data: netInfo } = useApi("/api/net_info", 10000);
  const { data: system } = useApi("/api/system", 5000);
  const { data: selectData, refetch: refetchSelect } = useApi("/api/nodes/select", 15000);
  const { data: poolData } = useApi("/api/nodes/pool/stats", 0);

  const [selectedNode, setSelectedNode] = useState(null);

  const nodes = nodesData?.nodes || [];
  const online = nodes.filter((n) => n.status === "online").length;
  const offline = nodes.filter((n) => n.status === "offline").length;
  const unknown = nodes.filter((n) => n.status === "unknown").length;

  const handleSelectStrategy = async (strategy) => {
    try {
      const res = await fetch(`/api/nodes/select?strategy=${strategy}`);
      const data = await res.json();
      if (data.node) {
        setSelectedNode(data.node);
      }
      refetchSelect();
    } catch (err) {
      console.error("Failed to select node:", err);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Nodes</h2>
        <p className="text-sm text-slate-400">
          Network topology, node health, and fleet management
        </p>
      </div>

      {/* ── Summary stats ───────────────────────── */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard title="Total" value={nodes.length || "—"} color="sky" />
        <StatCard title="Online" value={online} color="green" />
        <StatCard title="Offline" value={offline} color={offline > 0 ? "red" : "green"} />
        <StatCard title="Unknown" value={unknown} color="amber" />
        <StatCard title="Peers" value={netInfo?.nPeers ?? "—"} color="purple" />
      </div>

      {/* ── Node selector ───────────────────────── */}
      <div className="card mb-6">
        <h3 className="mb-3 text-sm font-medium text-sky-400">Node Selector</h3>
        <div className="flex flex-wrap items-center gap-3">
          {["lowest-latency", "round-robin", "random"].map((strategy) => (
            <button
              key={strategy}
              onClick={() => handleSelectStrategy(strategy)}
              className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-sky-500 hover:text-sky-400"
            >
              {strategy}
            </button>
          ))}
          {selectedNode && (
            <span className="ml-4 text-sm">
              Selected: <span className="font-medium text-sky-400">{selectedNode.moniker}</span>
              <span className="badge-green ml-2">{selectedNode.status}</span>
            </span>
          )}
          {selectData?.node && !selectedNode && (
            <span className="ml-4 text-sm text-slate-400">
              Auto: <span className="font-medium">{selectData.node.moniker}</span>
              <span className="ml-2 text-xs">({selectData.strategy})</span>
            </span>
          )}
        </div>
        {poolData && (
          <p className="mt-2 text-xs text-slate-500">
            Connection pool: {poolData.size} active connections
          </p>
        )}
      </div>

      {/* ── Node fleet grid ─────────────────────── */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <div className="card col-span-full py-12 text-center text-slate-500">
            Loading nodes...
          </div>
        ) : nodes.length === 0 ? (
          <div className="card col-span-full py-12 text-center text-slate-500">
            No registered validators. Visit{" "}
            <a href="/registry" className="text-sky-400 hover:underline">Registry</a>{" "}
            to add nodes.
          </div>
        ) : (
          nodes.map((node) => (
            <div
              key={node.node_id}
              className={`card-hover cursor-pointer ${selectedNode?.node_id === node.node_id ? "ring-2 ring-sky-500" : ""}`}
              onClick={() => setSelectedNode(node)}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      node.status === "online"
                        ? "bg-emerald-400"
                        : node.status === "offline"
                        ? "bg-red-500"
                        : "bg-yellow-500"
                    }`}
                  />
                  <span className="font-medium">
                    {node.moniker || node.node_id}
                  </span>
                </div>
                <span
                  className={
                    node.status === "online"
                      ? "badge-green"
                      : node.status === "offline"
                      ? "badge-red"
                      : "badge-yellow"
                  }
                >
                  {node.status}
                </span>
              </div>

              <div className="space-y-1.5 text-sm">
                <Row label="Node ID" value={node.node_id} mono />
                <Row label="Endpoint" value={`${node.public_endpoint}:${node.rpc_port}`} />
                {node.block_height > 0 && (
                  <Row
                    label="Height"
                    value={node.block_height.toLocaleString()}
                  />
                )}
                {node.catching_up !== undefined && (
                  <Row
                    label="Sync"
                    value={node.catching_up ? "Catching up..." : "Synced"}
                  />
                )}
                {node.latency_ms > 0 && (
                  <Row label="Latency" value={`${node.latency_ms}ms`} />
                )}
                {node.version && <Row label="Version" value={node.version} />}
                {node.last_seen && <Row label="Last seen" value={node.last_seen} />}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── System info ─────────────────────────── */}
      {system && (
        <div className="card">
          <h3 className="mb-4 text-sm font-medium text-slate-400">
            Local System
          </h3>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm md:grid-cols-4">
            <Row label="Hostname" value={system.hostname} />
            <Row label="Platform" value={system.platform} />
            <Row label="CPUs" value={system.cpuCount} />
            <Row label="Uptime" value={`${(system.uptime / 3600).toFixed(1)}h`} />
            <Row label="Memory" value={`${system.memUsedPercent}% used`} />
            <Row label="Load (1m)" value={system.loadAvg?.[0]?.toFixed(2)} />
            <Row label="Load (5m)" value={system.loadAvg?.[1]?.toFixed(2)} />
            <Row label="Load (15m)" value={system.loadAvg?.[2]?.toFixed(2)} />
          </div>
        </div>
      )}

      {/* ── Peer details ────────────────────────── */}
      {netInfo?.peers?.length > 0 && (
        <div className="card mt-6">
          <h3 className="mb-4 text-sm font-medium text-slate-400">
            Connected Peers
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-500">
                <th className="pb-2">Moniker</th>
                <th className="pb-2">Node ID</th>
                <th className="pb-2">Remote IP</th>
              </tr>
            </thead>
            <tbody>
              {netInfo.peers.map((p, i) => (
                <tr key={i} className="border-t border-slate-700/50">
                  <td className="py-1.5">{p.moniker}</td>
                  <td className="py-1.5 font-mono text-xs">{p.nodeId}</td>
                  <td className="py-1.5 text-slate-400">{p.remoteIp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, mono = false }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-xs text-slate-500 shrink-0">{label}:</span>
      <span className={`truncate ${mono ? "font-mono text-xs" : ""}`}>
        {value ?? "—"}
      </span>
    </div>
  );
}
