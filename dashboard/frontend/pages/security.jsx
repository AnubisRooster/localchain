import { useState, useEffect, useCallback } from "react";

const THREAT_COLORS = {
  critical: "bg-red-500/20 text-red-400 border-red-500/30",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  low: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

const STATUS_COLORS = {
  pending: "bg-yellow-500/20 text-yellow-400",
  reviewed: "bg-green-500/20 text-green-400",
  dismissed: "bg-slate-500/20 text-slate-400",
  false_positive: "bg-purple-500/20 text-purple-400",
};

function ThreatBadge({ level }) {
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium uppercase ${THREAT_COLORS[level] || THREAT_COLORS.medium}`}>
      {level}
    </span>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[status] || STATUS_COLORS.pending}`}>
      {status.replace("_", " ")}
    </span>
  );
}

function StatCard({ label, value, color = "text-sky-400" }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function EntryDetail({ entry, onReview, onClose }) {
  const [status, setStatus] = useState("reviewed");
  const [notes, setNotes] = useState("");
  const [reviewedBy, setReviewedBy] = useState("admin");

  if (!entry) return null;

  const handleReview = async () => {
    await onReview(entry.id, status, reviewedBy, notes);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="mx-4 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Threat Detail — ID #{entry.id}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <ThreatBadge level={entry.threat_level} />
          <StatusBadge status={entry.status} />
          <span className="text-xs text-slate-500">Risk Score: {entry.risk_score}</span>
          <span className="text-xs text-slate-500">{new Date(entry.timestamp).toLocaleString()}</span>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-slate-500">Source IP</p>
            <p className="text-slate-200">{entry.source_ip || "N/A"}</p>
          </div>
          <div>
            <p className="text-slate-500">Endpoint</p>
            <p className="text-slate-200">{entry.endpoint || "N/A"}</p>
          </div>
          <div>
            <p className="text-slate-500">Content Summary</p>
            <p className="text-slate-200">{entry.content_summary || "N/A"}</p>
          </div>
          <div>
            <p className="text-slate-500">Content Hash</p>
            <p className="font-mono text-xs text-slate-200">{entry.content_hash || "N/A"}</p>
          </div>
        </div>

        <div className="mb-4">
          <p className="mb-1 text-sm text-slate-500">Findings</p>
          <div className="space-y-1">
            {entry.findings.map((f, i) => (
              <div key={i} className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm">
                <span className="font-medium text-red-400">{f.type}</span>
                {" — "}
                <span className="text-slate-300">{f.pattern || f.indicator || "unknown"}</span>
                {" in "}
                <span className="text-slate-300">{f.field || "unknown"}</span>
                {" ("}
                <ThreatBadge level={f.severity} />
                {")"}
              </div>
            ))}
          </div>
        </div>

        {entry.raw_content && (
          <div className="mb-4">
            <p className="mb-1 text-sm text-slate-500">Raw Content (truncated)</p>
            <pre className="max-h-40 overflow-auto rounded border border-slate-700 bg-slate-800 p-3 text-xs text-slate-300">
              {entry.raw_content}
            </pre>
          </div>
        )}

        {entry.status === "pending" && (
          <div className="rounded border border-slate-700 bg-slate-800/50 p-4">
            <p className="mb-3 text-sm font-medium text-white">Review Action</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={reviewedBy}
                onChange={(e) => setReviewedBy(e.target.value)}
                placeholder="Reviewed by"
                className="input-field w-full sm:w-40"
              />
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="input-field w-full sm:w-44"
              >
                <option value="reviewed">Reviewed</option>
                <option value="dismissed">Dismissed</option>
                <option value="false_positive">False Positive</option>
              </select>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Review notes (optional)"
              className="input-field mt-3 w-full"
              rows={2}
            />
            <button
              onClick={handleReview}
              className="mt-3 rounded bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600"
            >
              Submit Review
            </button>
          </div>
        )}

        {entry.review_notes && (
          <div className="mb-2 text-sm">
            <p className="text-slate-500">Review Notes</p>
            <p className="text-slate-300">{entry.review_notes}</p>
            <p className="text-xs text-slate-500">
              by {entry.reviewed_by} at {new Date(entry.reviewed_at).toLocaleString()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Security() {
  const [entries, setEntries] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [filters, setFilters] = useState({
    threatLevel: "",
    status: "",
    minRiskScore: "",
    pattern: "",
    limit: 50,
  });
  const [total, setTotal] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.threatLevel) params.set("threatLevel", filters.threatLevel);
      if (filters.status) params.set("status", filters.status);
      if (filters.minRiskScore) params.set("minRiskScore", filters.minRiskScore);
      if (filters.pattern) params.set("pattern", filters.pattern);
      params.set("limit", filters.limit);

      const [entriesRes, statsRes] = await Promise.all([
        fetch(`/api/quarantine?${params}`),
        fetch("/api/quarantine/stats"),
      ]);

      const entriesData = await entriesRes.json();
      const statsData = await statsRes.json();

      setEntries(entriesData.entries || []);
      setTotal(entriesData.total || 0);
      setStats(statsData);
    } catch (err) {
      console.error("Failed to fetch security data:", err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleReview = async (id, status, reviewedBy, notes) => {
    try {
      const res = await fetch(`/api/quarantine/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reviewedBy, notes }),
      });
      if (res.ok) {
        setSelectedEntry(null);
        fetchData();
      }
    } catch (err) {
      console.error("Failed to review entry:", err);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this quarantine entry?")) return;
    try {
      const res = await fetch(`/api/quarantine/${id}`, { method: "DELETE" });
      if (res.ok) {
        setSelectedEntry(null);
        fetchData();
      }
    } catch (err) {
      console.error("Failed to delete entry:", err);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Security Monitor</h1>
        <p className="text-sm text-slate-400">Review blocked transactions and security threats</p>
      </div>

      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Total Blocked" value={stats.totalEntries} color="text-red-400" />
          <StatCard label="Pending Review" value={stats.pendingCount} color="text-yellow-400" />
          <StatCard label="Reviewed" value={stats.reviewedCount} color="text-green-400" />
          <StatCard label="Dismissed" value={stats.dismissedCount} color="text-slate-400" />
          <StatCard label="Last 24h" value={stats.last24Hours} color="text-orange-400" />
          <StatCard label="Critical" value={stats.byThreatLevel.find((t) => t.threat_level === "critical")?.count || 0} color="text-red-400" />
        </div>
      )}

      {stats && stats.topPatterns.length > 0 && (
        <div className="mb-6 rounded-lg border border-slate-700 bg-slate-800/50 p-4">
          <h3 className="mb-3 text-sm font-medium text-slate-300">Top Threat Patterns</h3>
          <div className="flex flex-wrap gap-2">
            {stats.topPatterns.map((p, i) => (
              <button
                key={i}
                onClick={() => setFilters((f) => ({ ...f, pattern: p.pattern }))}
                className="flex items-center gap-2 rounded border border-slate-600 bg-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-sky-500 hover:text-sky-400"
              >
                <span className="font-medium">{p.pattern}</span>
                <span className="text-slate-500">({p.count})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {stats && stats.topSourceIps.length > 0 && (
        <div className="mb-6 rounded-lg border border-slate-700 bg-slate-800/50 p-4">
          <h3 className="mb-3 text-sm font-medium text-slate-300">Top Source IPs</h3>
          <div className="flex flex-wrap gap-2">
            {stats.topSourceIps.map((ip, i) => (
              <button
                key={i}
                onClick={() => setFilters((f) => ({ ...f, sourceIp: ip.source_ip }))}
                className="flex items-center gap-2 rounded border border-slate-600 bg-slate-700 px-3 py-1.5 text-xs font-mono text-slate-300 hover:border-sky-500 hover:text-sky-400"
              >
                {ip.source_ip}
                <span className="text-slate-500">({ip.count})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={filters.threatLevel}
          onChange={(e) => setFilters((f) => ({ ...f, threatLevel: e.target.value }))}
          className="input-field w-36"
        >
          <option value="">All Threats</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <select
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          className="input-field w-36"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="reviewed">Reviewed</option>
          <option value="dismissed">Dismissed</option>
          <option value="false_positive">False Positive</option>
        </select>

        <input
          type="number"
          placeholder="Min risk score"
          value={filters.minRiskScore}
          onChange={(e) => setFilters((f) => ({ ...f, minRiskScore: e.target.value }))}
          className="input-field w-32"
        />

        <button
          onClick={() => setFilters({ threatLevel: "", status: "", minRiskScore: "", pattern: "", limit: 50 })}
          className="rounded border border-slate-600 px-3 py-2 text-sm text-slate-400 hover:border-slate-400 hover:text-white"
        >
          Clear Filters
        </button>

        <span className="flex items-center text-sm text-slate-500">
          {total} entries
        </span>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500">Loading...</div>
      ) : entries.length === 0 ? (
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 py-12 text-center text-slate-500">
          No threats found. All clear!
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-700">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-700 bg-slate-800/80">
              <tr>
                <th className="px-4 py-3 text-xs font-medium uppercase text-slate-400">ID</th>
                <th className="px-4 py-3 text-xs font-medium uppercase text-slate-400">Time</th>
                <th className="px-4 py-3 text-xs font-medium uppercase text-slate-400">Threat</th>
                <th className="px-4 py-3 text-xs font-medium uppercase text-slate-400">Score</th>
                <th className="px-4 py-3 text-xs font-medium uppercase text-slate-400">IP</th>
                <th className="px-4 py-3 text-xs font-medium uppercase text-slate-400">Summary</th>
                <th className="px-4 py-3 text-xs font-medium uppercase text-slate-400">Status</th>
                <th className="px-4 py-3 text-xs font-medium uppercase text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-800/30">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">#{entry.id}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {new Date(entry.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <ThreatBadge level={entry.threat_level} />
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-mono text-xs ${entry.risk_score >= 10 ? "text-red-400" : entry.risk_score >= 5 ? "text-orange-400" : "text-slate-400"}`}>
                      {entry.risk_score}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">
                    {entry.source_ip || "—"}
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-xs text-slate-300">
                    {entry.content_summary || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={entry.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedEntry(entry)}
                        className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-sky-500 hover:text-white"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-red-500 hover:text-white"
                      >
                        Del
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedEntry && (
        <EntryDetail
          entry={selectedEntry}
          onReview={handleReview}
          onClose={() => setSelectedEntry(null)}
        />
      )}
    </div>
  );
}
