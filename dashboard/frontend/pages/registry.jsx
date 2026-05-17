import { useState } from "react";
import { useApi, useApiMutation } from "../components/useApi";
import StatCard from "../components/StatCard";

export default function Registry() {
  const { data, loading, refetch } = useApi("/api/nodes", 10000);
  const { data: statsData } = useApi("/api/nodes/stats", 15000);
  const { data: selectData } = useApi("/api/nodes/select", 0);
  const { post, del, loading: mutating } = useApiMutation();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    node_id: "",
    moniker: "",
    public_endpoint: "",
    rpc_port: 26657,
    rest_port: 1317,
    p2p_port: 26656,
    version: "",
    network: "",
  });

  const nodes = data?.nodes || [];
  const stats = statsData || {};
  const online = nodes.filter((n) => n.status === "online").length;
  const offline = nodes.filter((n) => n.status === "offline").length;
  const unknown = nodes.filter((n) => n.status === "unknown").length;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await post("/api/nodes/register", form);
      setShowForm(false);
      setForm({ node_id: "", moniker: "", public_endpoint: "", rpc_port: 26657, rest_port: 1317, p2p_port: 26656, version: "", network: "" });
      refetch();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to register node");
    }
  };

  const handleDelete = async (nodeId) => {
    if (!confirm(`Remove ${nodeId} from registry?`)) return;
    try {
      await del(`/api/nodes/${nodeId}`);
      refetch();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to remove node");
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Validator Registry</h2>
          <p className="text-sm text-slate-400">
            Self-service node registration and fleet management
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600"
        >
          {showForm ? "Cancel" : "+ Register Node"}
        </button>
      </div>

      {/* ── Summary stats ───────────────────────── */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard title="Total" value={stats.total || nodes.length} color="sky" />
        <StatCard title="Online" value={online} color="green" />
        <StatCard title="Offline" value={offline} color={offline > 0 ? "red" : "green"} />
        <StatCard title="Unknown" value={unknown} color="amber" />
        <StatCard title="Max Height" value={stats.max_height ? stats.max_height.toLocaleString() : "—"} color="purple" />
      </div>

      {/* ── Node selector ───────────────────────── */}
      {selectData?.node && (
        <div className="card mb-6">
          <h3 className="mb-3 text-sm font-medium text-sky-400">Active Node (auto-selected)</h3>
          <div className="flex items-center gap-4 text-sm">
            <span className="font-medium">{selectData.node.moniker}</span>
            <span className="badge-green">{selectData.node.status}</span>
            <span className="text-slate-400">{selectData.node.public_endpoint}:{selectData.node.rpc_port}</span>
            <span className="text-slate-500">latency: {selectData.node.latency_ms}ms</span>
          </div>
        </div>
      )}

      {/* ── Registration form ───────────────────── */}
      {showForm && (
        <div className="card mb-6">
          <h3 className="mb-4 text-sm font-medium">Register New Validator</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Node ID *</label>
              <input
                type="text"
                required
                className="input-field w-full"
                value={form.node_id}
                onChange={(e) => setForm({ ...form, node_id: e.target.value })}
                placeholder="validator-1"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Moniker *</label>
              <input
                type="text"
                required
                className="input-field w-full"
                value={form.moniker}
                onChange={(e) => setForm({ ...form, moniker: e.target.value })}
                placeholder="My Validator"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Public Endpoint *</label>
              <input
                type="text"
                required
                className="input-field w-full"
                value={form.public_endpoint}
                onChange={(e) => setForm({ ...form, public_endpoint: e.target.value })}
                placeholder="10.0.0.1"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">RPC Port</label>
              <input
                type="number"
                className="input-field w-full"
                value={form.rpc_port}
                onChange={(e) => setForm({ ...form, rpc_port: parseInt(e.target.value) })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">REST Port</label>
              <input
                type="number"
                className="input-field w-full"
                value={form.rest_port}
                onChange={(e) => setForm({ ...form, rest_port: parseInt(e.target.value) })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">P2P Port</label>
              <input
                type="number"
                className="input-field w-full"
                value={form.p2p_port}
                onChange={(e) => setForm({ ...form, p2p_port: parseInt(e.target.value) })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Version</label>
              <input
                type="text"
                className="input-field w-full"
                value={form.version}
                onChange={(e) => setForm({ ...form, version: e.target.value })}
                placeholder="0.1.0"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Network</label>
              <input
                type="text"
                className="input-field w-full"
                value={form.network}
                onChange={(e) => setForm({ ...form, network: e.target.value })}
                placeholder="localchain"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={mutating}
                className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-50"
              >
                {mutating ? "Registering..." : "Register"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Node table ──────────────────────────── */}
      <div className="card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-left text-xs uppercase text-slate-500">
              <th className="pb-3">Moniker</th>
              <th className="pb-3">Node ID</th>
              <th className="pb-3">Endpoint</th>
              <th className="pb-3">Status</th>
              <th className="pb-3">Height</th>
              <th className="pb-3">Latency</th>
              <th className="pb-3">Last Seen</th>
              <th className="pb-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8" className="py-8 text-center text-slate-500">Loading...</td></tr>
            ) : nodes.length === 0 ? (
              <tr><td colSpan="8" className="py-8 text-center text-slate-500">No registered validators</td></tr>
            ) : (
              nodes.map((node) => (
                <tr key={node.node_id} className="border-b border-slate-700/50">
                  <td className="py-2.5 font-medium">{node.moniker}</td>
                  <td className="py-2.5 font-mono text-xs">{node.node_id}</td>
                  <td className="py-2.5 text-slate-400">{node.public_endpoint}:{node.rpc_port}</td>
                  <td className="py-2.5">
                    <span className={node.status === "online" ? "badge-green" : node.status === "offline" ? "badge-red" : "badge-yellow"}>
                      {node.status}
                    </span>
                  </td>
                  <td className="py-2.5">{node.block_height ? node.block_height.toLocaleString() : "—"}</td>
                  <td className="py-2.5">{node.latency_ms ? `${node.latency_ms}ms` : "—"}</td>
                  <td className="py-2.5 text-slate-400 text-xs">{node.last_seen || "never"}</td>
                  <td className="py-2.5">
                    <button
                      onClick={() => handleDelete(node.node_id)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
