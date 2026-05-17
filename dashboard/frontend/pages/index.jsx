import { useState, useEffect } from "react";
import { useApi } from "../components/useApi";
import StatCard from "../components/StatCard";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, AreaChart, Area,
} from "recharts";

export default function Dashboard() {
  const { data: health } = useApi("/health", 3000);
  const { data: blocks } = useApi("/api/blocks/latest", 5000);
  const { data: validators } = useApi("/api/validators", 10000);
  const { data: system } = useApi("/api/system", 5000);

  const [blockHistory, setBlockHistory] = useState([]);

  // Track block height over time for the chart
  useEffect(() => {
    if (health?.blockHeight) {
      setBlockHistory((prev) => {
        const next = [
          ...prev,
          { time: new Date().toLocaleTimeString(), height: health.blockHeight },
        ];
        return next.slice(-30); // keep last 30 data points
      });
    }
  }, [health?.blockHeight]);

  const isOnline = health?.status === "ok";

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Dashboard</h2>
          <p className="text-sm text-slate-400">
            Real-time overview of your LocalChain network
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              isOnline ? "bg-emerald-400 animate-pulse" : "bg-red-500"
            }`}
          />
          <span className="text-sm text-slate-400">
            {isOnline ? "Online" : "Offline"}
          </span>
        </div>
      </div>

      {/* ── Stat cards ──────────────────────────── */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Block Height"
          value={health?.blockHeight?.toLocaleString()}
          subtitle={health?.catching_up ? "Syncing..." : "Synced"}
          color="sky"
        />
        <StatCard
          title="Validators"
          value={validators?.validators?.length}
          subtitle={`Height ${validators?.blockHeight || "—"}`}
          color="purple"
        />
        <StatCard
          title="Latency"
          value={health?.latency ? `${health.latency}ms` : "—"}
          subtitle="RPC round-trip"
          color="green"
        />
        <StatCard
          title="Memory Usage"
          value={system?.memUsedPercent ? `${system.memUsedPercent}%` : "—"}
          subtitle={`Load avg: ${system?.loadAvg?.[0]?.toFixed(2) || "—"}`}
          color={parseFloat(system?.memUsedPercent) > 80 ? "red" : "amber"}
        />
      </div>

      {/* ── Charts ──────────────────────────────── */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Block height over time */}
        <div className="card">
          <h3 className="mb-4 text-sm font-medium text-slate-400">
            Block Height (live)
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={blockHistory}>
              <defs>
                <linearGradient id="colorHeight" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time" tick={{ fill: "#94a3b8", fontSize: 10 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} domain={["dataMin", "dataMax"]} />
              <Tooltip
                contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155" }}
              />
              <Area
                type="monotone"
                dataKey="height"
                stroke="#0ea5e9"
                fill="url(#colorHeight)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Recent blocks table */}
        <div className="card">
          <h3 className="mb-4 text-sm font-medium text-slate-400">
            Recent Blocks
          </h3>
          <div className="max-h-[220px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="pb-2">Height</th>
                  <th className="pb-2">Txs</th>
                  <th className="pb-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {(blocks?.recent || []).map((b) => (
                  <tr key={b.height} className="border-t border-slate-700/50">
                    <td className="py-1.5 font-mono text-sky-400">{b.height}</td>
                    <td className="py-1.5">{b.txCount || 0}</td>
                    <td className="py-1.5 text-slate-400">
                      {new Date(b.time).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Validators ──────────────────────────── */}
      <div className="card">
        <h3 className="mb-4 text-sm font-medium text-slate-400">
          Active Validators
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th className="pb-2">Address</th>
                <th className="pb-2">Voting Power</th>
              </tr>
            </thead>
            <tbody>
              {(validators?.validators || []).map((v, i) => (
                <tr key={i} className="border-t border-slate-700/50">
                  <td className="py-1.5 font-mono text-xs">{v.address}</td>
                  <td className="py-1.5">{parseInt(v.votingPower).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
