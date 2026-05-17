import { useState } from "react";
import { useApi, api } from "../components/useApi";

export default function Explorer() {
  const { data: blocks, loading } = useApi("/api/blocks/latest", 5000);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [blockDetail, setBlockDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function loadBlock(height) {
    setSelectedBlock(height);
    setDetailLoading(true);
    try {
      const res = await api.get(`/api/block/${height}`);
      setBlockDetail(res.data);
    } catch (err) {
      setBlockDetail({ error: err.message });
    }
    setDetailLoading(false);
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Explorer</h2>
        <p className="text-sm text-slate-400">Browse blocks and transactions</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Block list */}
        <div className="lg:col-span-1">
          <div className="card">
            <h3 className="mb-4 text-sm font-medium text-slate-400">Blocks</h3>
            {loading ? (
              <p className="text-slate-500 text-sm">Loading...</p>
            ) : (
              <div className="flex flex-col gap-1">
                {(blocks?.recent || []).map((b) => (
                  <button
                    key={b.height}
                    onClick={() => loadBlock(b.height)}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      selectedBlock === b.height
                        ? "bg-sky-500/10 text-sky-400"
                        : "hover:bg-slate-700/50 text-slate-300"
                    }`}
                  >
                    <span className="font-mono">#{b.height}</span>
                    <span className="flex items-center gap-2 text-xs text-slate-500">
                      <span>{b.txCount || 0} txs</span>
                      <span>{new Date(b.time).toLocaleTimeString()}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Block detail */}
        <div className="lg:col-span-2">
          {selectedBlock ? (
            <div className="card">
              <h3 className="mb-4 text-sm font-medium text-slate-400">
                Block #{selectedBlock}
              </h3>
              {detailLoading ? (
                <p className="text-slate-500 text-sm">Loading...</p>
              ) : blockDetail?.error ? (
                <p className="text-red-400 text-sm">{blockDetail.error}</p>
              ) : blockDetail ? (
                <div className="space-y-3">
                  <DetailRow label="Height" value={blockDetail.height} />
                  <DetailRow label="Chain ID" value={blockDetail.chainId} />
                  <DetailRow
                    label="Time"
                    value={new Date(blockDetail.time).toLocaleString()}
                  />
                  <DetailRow label="Proposer" value={blockDetail.proposer} mono />
                  <DetailRow label="Transactions" value={blockDetail.txCount} />
                  <DetailRow
                    label="Last Block Hash"
                    value={blockDetail.lastBlockHash || "—"}
                    mono
                  />

                  {blockDetail.txs?.length > 0 && (
                    <div className="mt-4">
                      <h4 className="mb-2 text-xs font-medium text-slate-400 uppercase">
                        Transactions
                      </h4>
                      <div className="space-y-1">
                        {blockDetail.txs.map((tx, i) => (
                          <div
                            key={i}
                            className="rounded bg-slate-900 px-3 py-2 font-mono text-xs text-slate-300 break-all"
                          >
                            {tx}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="card flex items-center justify-center py-20 text-slate-500">
              Select a block to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono = false }) {
  return (
    <div className="flex items-start gap-4 border-b border-slate-700/50 pb-2">
      <span className="w-36 shrink-0 text-xs font-medium uppercase text-slate-500">
        {label}
      </span>
      <span
        className={`text-sm break-all ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
