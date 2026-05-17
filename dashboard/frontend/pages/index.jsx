import { useState, useEffect } from "react";
import { useApi } from "../components/useApi";
import StatCard from "../components/StatCard";
import { LoadingState, ErrorState, ErrorBanner } from "../components/LoadingState";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, AreaChart, Area,
} from "recharts";

export default function Dashboard() {
  const { data: health, error: healthError, loading: healthLoading, refetch: refetchHealth } = useApi("/health", 3000);
  const { data: blocks, error: blocksError, loading: blocksLoading } = useApi("/api/blocks/latest", 5000);
  const { data: validators, error: validatorsError, loading: validatorsLoading } = useApi("/api/validators", 10000);
  const { data: system, error: systemError, loading: systemLoading } = useApi("/api/system", 5000);
  const { data: nodesData, error: nodesError } = useApi("/api/nodes", 15000);
  const { data: selectData } = useApi("/api/nodes/select", 0);
  const { data: registryStats } = useApi("/api/nodes/stats", 0);

  const [blockHistory, setBlockHistory] = useState([]);
  const [dismissedError, setDismissedError] = useState(null);

  useEffect(() => {
    if (health?.blockHeight) {
      setBlockHistory((prev) => {
        const next = [
          ...prev,
          { time: new Date().toLocaleTimeString(), height: health.blockHeight },
        ];
        return next.slice(-30);
      });
    }
  }, [health?.blockHeight]);

  const isOnline = health?.status === "ok";
  const nodes = nodesData?.nodes || [];
  const onlineNodes = nodes.filter((n) => n.status === "online").length;

  const hasCriticalError = healthError && !dismissedError;

  if (healthLoading && !health) {
    return (
      <div>
        <div className="mb-6">
          <h2 className="text-2xl font-bold">Dashboard</h2>
          <p className="text-sm text-slate-400">Connecting to LocalChain network...</p>
        </div>
        <LoadingState message="Connecting to chain..." size="lg" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Dashboard</h2>
          <p className="text-sm text-slate-400">
            Real-time overview of your LocalChain network
          </p>
        </div>
        <div className="flex items-center gap-4">
          {selectData?.node && (
            <span className="text-xs text-slate-400">
              Node: <span className="font-medium text-sky-400">{selectData.node.moniker}</span>
            </span>
          )}
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
      </div>

      {hasCriticalError && (
        <ErrorBanner
          title="API Connection Error"
          message={`Unable to reach the LocalChain API: ${healthError}`}
          onDismiss={() => setDismissedError(healthError)}
        />
      )}

      {/* ── Stat cards ──────────────────────────── */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {healthLoading ? (
          <StatCard title="Block Height" value="..." subtitle="Loading..." color="sky" />
        ) : healthError ? (
          <StatCard title="Block Height" value="—" subtitle="Error" color="red" />
        ) : (
          <StatCard
            title="Block Height"
            value={health?.blockHeight?.toLocaleString()}
            subtitle={health?.catching_up ? "Syncing..." : "Synced"}
            color="sky"
          />
        )}

        {validatorsLoading ? (
          <StatCard title="Validators" value="..." subtitle="Loading..." color="purple" />
        ) : validatorsError ? (
          <StatCard title="Validators" value="—" subtitle="Error" color="red" />
        ) : (
          <StatCard
            title="Validators"
            value={validators?.validators?.length}
            subtitle={`Height ${validators?.blockHeight || "—"}`}
            color="purple"
          />
        )}

        {healthLoading ? (
          <StatCard title="Latency" value="..." subtitle="Loading..." color="green" />
        ) : (
          <StatCard
            title="Latency"
            value={health?.latency ? `${health.latency}ms` : "—"}
            subtitle="RPC round-trip"
            color="green"
          />
        )}

        {nodesError ? (
          <StatCard title="Nodes" value="—" subtitle="Error" color="red" />
        ) : (
          <StatCard
            title="Nodes"
            value={onlineNodes}
            subtitle={`of ${nodes.length} registered`}
            color="amber"
          />
        )}

        {systemLoading ? (
          <StatCard title="Memory" value="..." subtitle="Loading..." color="amber" />
        ) : systemError ? (
          <StatCard title="Memory" value="—" subtitle="Error" color="red" />
        ) : (
          <StatCard
            title="Memory"
            value={system?.memUsedPercent ? `${system.memUsedPercent}%` : "—"}
            subtitle={`Load: ${system?.loadAvg?.[0]?.toFixed(2) || "—"}`}
            color={parseFloat(system?.memUsedPercent) > 80 ? "red" : "amber"}
          />
        )}
      </div>

      {/* ── Charts ──────────────────────────────── */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Block height over time */}
        <div className="card">
          <h3 className="mb-4 text-sm font-medium text-slate-400">
            Block Height (live)
          </h3>
          {blockHistory.length === 0 ? (
            <LoadingState message="Collecting block data..." size="sm" />
          ) : (
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
          )}
        </div>

        {/* Recent blocks table */}
        <div className="card">
          <h3 className="mb-4 text-sm font-medium text-slate-400">
            Recent Blocks
          </h3>
          {blocksLoading ? (
            <LoadingState message="Loading blocks..." size="sm" />
          ) : blocksError ? (
            <ErrorState message="Failed to load blocks" error={blocksError} onRetry={refetchHealth} />
          ) : (
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
                  {(blocks?.recent || []).length === 0 && (
                    <tr>
                      <td colSpan="3" className="py-8 text-center text-slate-500">No blocks found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Validators ──────────────────────────── */}
      <div className="card">
        <h3 className="mb-4 text-sm font-medium text-slate-400">
          Active Validators
        </h3>
        {validatorsLoading ? (
          <LoadingState message="Loading validators..." size="sm" />
        ) : validatorsError ? (
          <ErrorState message="Failed to load validators" error={validatorsError} />
        ) : (
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
                {(validators?.validators || []).length === 0 && (
                  <tr>
                    <td colSpan="2" className="py-8 text-center text-slate-500">No validators found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
