import { useState } from "react";
import { useApi, useApiMutation } from "../components/useApi";
import StatCard from "../components/StatCard";

export default function Settings() {
  const { data, loading, refetch } = useApi("/api/auth/keys", 15000);
  const { post, del, loading: mutating } = useApiMutation();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    label: "",
    expiresInDays: 30,
    rateLimit: 1000,
    rateWindow: 3600,
  });
  const [newKey, setNewKey] = useState(null);
  const [copied, setCopied] = useState(false);

  const keys = data?.keys || [];

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const result = await post("/api/auth/keys", form);
      setNewKey(result);
      setShowForm(false);
      setForm({ label: "", expiresInDays: 30, rateLimit: 1000, rateWindow: 3600 });
      refetch();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to create key");
    }
  };

  const handleRevoke = async (id) => {
    if (!confirm("Revoke this API key? This cannot be undone.")) return;
    try {
      await del(`/api/auth/keys/${id}`);
      refetch();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to revoke key");
    }
  };

  const copyKey = (key) => {
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Settings</h2>
          <p className="text-sm text-slate-400">
            API key management and authentication settings
          </p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setNewKey(null); }}
          className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600"
        >
          {showForm ? "Cancel" : "+ Generate Key"}
        </button>
      </div>

      {/* ── New key display ─────────────────────── */}
      {newKey && (
        <div className="card mb-6 border-l-4 border-l-amber-500">
          <h3 className="mb-2 text-sm font-medium text-amber-400">⚠ Save this key now — it will not be shown again</h3>
          <div className="flex items-center gap-3">
            <code className="flex-1 rounded bg-slate-900 px-3 py-2 font-mono text-sm text-sky-300">
              {newKey.raw}
            </code>
            <button
              onClick={() => copyKey(newKey.raw)}
              className="rounded bg-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-600"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Prefix: <code className="text-slate-400">{newKey.prefix}</code>
            {newKey.expires_at && ` · Expires: ${new Date(newKey.expires_at).toLocaleDateString()}`}
            · Rate limit: {newKey.rate_limit}/window
          </p>
        </div>
      )}

      {/* ── Create form ─────────────────────────── */}
      {showForm && (
        <div className="card mb-6">
          <h3 className="mb-4 text-sm font-medium">Generate API Key</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Label *</label>
              <input
                type="text"
                required
                className="input-field w-full"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="my-api-key"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Expires (days)</label>
              <input
                type="number"
                className="input-field w-full"
                value={form.expiresInDays}
                onChange={(e) => setForm({ ...form, expiresInDays: parseInt(e.target.value) })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Rate Limit</label>
              <input
                type="number"
                className="input-field w-full"
                value={form.rateLimit}
                onChange={(e) => setForm({ ...form, rateLimit: parseInt(e.target.value) })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Rate Window (seconds)</label>
              <input
                type="number"
                className="input-field w-full"
                value={form.rateWindow}
                onChange={(e) => setForm({ ...form, rateWindow: parseInt(e.target.value) })}
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={mutating}
                className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-50"
              >
                {mutating ? "Creating..." : "Generate"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Stats ───────────────────────────────── */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title="Total Keys" value={keys.length} color="sky" />
        <StatCard title="Active" value={keys.filter((k) => k.status === "active").length} color="green" />
        <StatCard title="Revoked" value={keys.filter((k) => k.status === "revoked").length} color="red" />
      </div>

      {/* ── Key list ────────────────────────────── */}
      <div className="card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-left text-xs uppercase text-slate-500">
              <th className="pb-3">ID</th>
              <th className="pb-3">Label</th>
              <th className="pb-3">Prefix</th>
              <th className="pb-3">Status</th>
              <th className="pb-3">Rate Limit</th>
              <th className="pb-3">Created</th>
              <th className="pb-3">Expires</th>
              <th className="pb-3">Last Used</th>
              <th className="pb-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="9" className="py-8 text-center text-slate-500">Loading...</td></tr>
            ) : keys.length === 0 ? (
              <tr><td colSpan="9" className="py-8 text-center text-slate-500">No API keys generated</td></tr>
            ) : (
              keys.map((key) => (
                <tr key={key.id} className="border-b border-slate-700/50">
                  <td className="py-2.5 font-mono text-xs">{key.id}</td>
                  <td className="py-2.5 font-medium">{key.label}</td>
                  <td className="py-2.5 font-mono text-xs text-slate-400">{key.key_prefix}...</td>
                  <td className="py-2.5">
                    <span className={key.status === "active" ? "badge-green" : "badge-red"}>
                      {key.status}
                    </span>
                  </td>
                  <td className="py-2.5 text-xs">{key.rate_limit}/{key.rate_window}s</td>
                  <td className="py-2.5 text-xs text-slate-400">{key.created_at?.split("T")[0]}</td>
                  <td className="py-2.5 text-xs text-slate-400">{key.expires_at ? new Date(key.expires_at).toLocaleDateString() : "never"}</td>
                  <td className="py-2.5 text-xs text-slate-400">{key.last_used_at || "never"}</td>
                  <td className="py-2.5">
                    {key.status === "active" && (
                      <button
                        onClick={() => handleRevoke(key.id)}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Revoke
                      </button>
                    )}
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
