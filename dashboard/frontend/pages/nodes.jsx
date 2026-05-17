import { useApi } from "../components/useApi";
import StatCard from "../components/StatCard";

export default function Nodes() {
  const { data: nodesData, loading } = useApi("/api/nodes", 8000);
  const { data: netInfo } = useApi("/api/net_info", 10000);
  const { data: system } = useApi("/api/system", 5000);

  const nodes = nodesData?.nodes || [];
  const online = nodes.filter((n) => n.status === "online").length;
  const offline = nodes.filter((n) => n.status === "offline").length;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Nodes</h2>
        <p className="text-sm text-slate-400">
          Network topology and node health
        </p>
      </div>

      {/* ── Summary stats ───────────────────────── */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Nodes"
          value={nodes.length || "—"}
          color="sky"
        />
        <StatCard
          title="Online"
          value={online}
          color="green"
        />
        <StatCard
          title="Offline"
          value={offline}
          color={offline > 0 ? "red" : "green"}
        />
        <StatCard
          title="Connected Peers"
          value={netInfo?.nPeers ?? "—"}
          color="purple"
        />
      </div>

      {/* ── Node list ───────────────────────────── */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <div className="card col-span-full py-12 text-center text-slate-500">
            Loading nodes...
          </div>
        ) : nodes.length === 0 ? (
          <div className="card col-span-full py-12 text-center text-slate-500">
            No nodes discovered. Set <code>KNOWN_NODES</code> in your
            environment or add Tailscale peers.
          </div>
        ) : (
          nodes.map((node, i) => (
            <div key={i} className="card-hover">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      node.status === "online"
                        ? "bg-emerald-400"
                        : "bg-red-500"
                    }`}
                  />
                  <span className="font-medium">
                    {node.moniker || node.host}
                  </span>
                </div>
                <span
                  className={
                    node.status === "online" ? "badge-green" : "badge-red"
                  }
                >
                  {node.status}
                </span>
              </div>

              <div className="space-y-1.5 text-sm">
                <Row label="Host" value={node.host} />
                {node.nodeId && (
                  <Row label="Node ID" value={node.nodeId} mono />
                )}
                {node.blockHeight && (
                  <Row
                    label="Height"
                    value={parseInt(node.blockHeight).toLocaleString()}
                  />
                )}
                {node.catching_up !== undefined && (
                  <Row
                    label="Sync"
                    value={node.catching_up ? "Catching up..." : "Synced"}
                  />
                )}
                <Row label="Latency" value={`${node.latency}ms`} />
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
            <Row
              label="Uptime"
              value={`${(system.uptime / 3600).toFixed(1)}h`}
            />
            <Row label="Memory" value={`${system.memUsedPercent}% used`} />
            <Row
              label="Load (1m)"
              value={system.loadAvg?.[0]?.toFixed(2)}
            />
            <Row
              label="Load (5m)"
              value={system.loadAvg?.[1]?.toFixed(2)}
            />
            <Row
              label="Load (15m)"
              value={system.loadAvg?.[2]?.toFixed(2)}
            />
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
