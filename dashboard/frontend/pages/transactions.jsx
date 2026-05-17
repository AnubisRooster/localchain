import { useState, useCallback, useRef } from "react";
import { useApi, api } from "../components/useApi";

const MAX_FILE_SIZE = 500 * 1024; // 500 KB

function truncate(str, len = 80) {
  if (!str || str.length <= len) return str;
  return str.slice(0, len) + "...";
}

function TagInput({ tags, onChange }) {
  const [input, setInput] = useState("");

  const add = () => {
    const val = input.trim();
    if (val && !tags.includes(val)) {
      onChange([...tags, val]);
    }
    setInput("");
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.map((tag) => (
          <span key={tag} className="badge-blue flex items-center gap-1">
            {tag}
            <button
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              className="ml-0.5 text-sky-300 hover:text-white"
            >
              x
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Type a tag and press Enter"
          className="input-field flex-1"
        />
        <button
          type="button"
          onClick={add}
          className="rounded-lg bg-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-600"
        >
          Add
        </button>
      </div>
    </div>
  );
}

function LabelInput({ labels, onChange }) {
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");

  const add = () => {
    const k = key.trim();
    const v = value.trim();
    if (k && v) {
      onChange({ ...labels, [k]: v });
      setKey("");
      setValue("");
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {Object.entries(labels).map(([k, v]) => (
          <span key={k} className="badge-green flex items-center gap-1">
            {k}={v}
            <button
              onClick={() => {
                const next = { ...labels };
                delete next[k];
                onChange(next);
              }}
              className="ml-0.5 text-emerald-300 hover:text-white"
            >
              x
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Key"
          className="input-field w-32"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Value"
          className="input-field flex-1"
        />
        <button
          type="button"
          onClick={add}
          className="rounded-lg bg-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-600"
        >
          Add
        </button>
      </div>
    </div>
  );
}

function CreateForm({ onSuccess }) {
  const [summary, setSummary] = useState("");
  const [contentType, setContentType] = useState("text");
  const [textContent, setTextContent] = useState("");
  const [file, setFile] = useState(null);
  const [tags, setTags] = useState([]);
  const [labels, setLabels] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  const readFileAsBase64 = (f) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(f);
    });

  const handleFile = (f) => {
    if (f.size > MAX_FILE_SIZE) {
      setError(`File exceeds ${MAX_FILE_SIZE / 1024}KB limit.`);
      return;
    }
    setError(null);
    setFile(f);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const submit = async () => {
    setError(null);
    if (!summary.trim()) return setError("Summary is required.");

    let content;
    let fileName = null;

    if (contentType === "file") {
      if (!file) return setError("Please select a file.");
      content = await readFileAsBase64(file);
      fileName = file.name;
    } else {
      if (!textContent.trim()) return setError("Content is required.");
      content = textContent.trim();
    }

    setSubmitting(true);
    try {
      const res = await api.post("/api/records", {
        summary: summary.trim(),
        content,
        contentType,
        fileName,
        tags,
        labels,
      });
      if (res.data.success) {
        setSummary("");
        setTextContent("");
        setFile(null);
        setTags([]);
        setLabels({});
        onSuccess(res.data);
      } else {
        setError(res.data.error || "Unknown error");
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
    setSubmitting(false);
  };

  return (
    <div className="card mb-6">
      <h3 className="mb-4 text-lg font-semibold">New Transaction</h3>

      <div className="mb-4">
        <label className="mb-1 block text-xs font-medium text-slate-400">
          Summary
        </label>
        <input
          type="text"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Brief description of this transaction"
          className="input-field w-full"
        />
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-xs font-medium text-slate-400">
          Tags
        </label>
        <TagInput tags={tags} onChange={setTags} />
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-xs font-medium text-slate-400">
          Labels
        </label>
        <LabelInput labels={labels} onChange={setLabels} />
      </div>

      <div className="mb-4">
        <label className="mb-2 block text-xs font-medium text-slate-400">
          Content Type
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => setContentType("text")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              contentType === "text"
                ? "bg-sky-600 text-white"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
          >
            Text
          </button>
          <button
            onClick={() => setContentType("file")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              contentType === "file"
                ? "bg-sky-600 text-white"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
          >
            File
          </button>
        </div>
      </div>

      {contentType === "text" ? (
        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-slate-400">
            Content
          </label>
          <textarea
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            placeholder="Transaction data content..."
            rows={5}
            className="input-field w-full resize-y"
          />
        </div>
      ) : (
        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-slate-400">
            File (max {MAX_FILE_SIZE / 1024}KB)
          </label>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
              dragOver
                ? "border-sky-400 bg-sky-500/10"
                : "border-slate-600 bg-slate-900 hover:border-slate-500"
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files[0];
                if (f) handleFile(f);
              }}
            />
            {file ? (
              <div>
                <p className="text-sm font-medium text-sky-400">{file.name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-slate-400">
                  Drop a file here or click to browse
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Any file type up to {MAX_FILE_SIZE / 1024}KB
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <p className="mb-4 rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      <button
        onClick={submit}
        disabled={submitting}
        className="rounded-lg bg-sky-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sky-500 disabled:opacity-50"
      >
        {submitting ? "Broadcasting..." : "Submit Transaction"}
      </button>
    </div>
  );
}

function ExpandedContent({ record }) {
  if (record.contentType === "file" && record.fileName) {
    return (
      <div className="rounded-lg bg-slate-900 p-4">
        <p className="mb-2 text-xs text-slate-400">
          File: <span className="text-sky-400">{record.fileName}</span>
        </p>
        <p className="text-xs text-slate-500">
          Base64-encoded content ({(record.content?.length || 0).toLocaleString()}{" "}
          characters)
        </p>
        <pre className="mt-2 max-h-32 overflow-auto rounded bg-slate-950 p-3 text-xs text-slate-400">
          {truncate(record.content, 500)}
        </pre>
      </div>
    );
  }

  return (
    <pre className="whitespace-pre-wrap rounded-lg bg-slate-900 p-4 text-sm text-slate-300">
      {record.content}
    </pre>
  );
}

export default function Transactions() {
  const { data: records, loading, refetch } = useApi("/api/records", 15000);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [labelFilter, setLabelFilter] = useState({ key: "", value: "" });
  const [activeTag, setActiveTag] = useState("");
  const [activeLabel, setActiveLabel] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [toast, setToast] = useState(null);

  const handleSuccess = useCallback(
    (result) => {
      setShowForm(false);
      setToast({
        message: "Transaction broadcast successfully",
        txHash: result.txHash,
      });
      setTimeout(() => setToast(null), 8000);
      setTimeout(() => refetch(), 2000);
    },
    [refetch]
  );

  const allTags = [
    ...new Set((records?.records || []).flatMap((r) => r.tags || [])),
  ].sort();

  const filteredRecords = (records?.records || []).filter((r) => {
    if (search.trim()) {
      const s = search.toLowerCase();
      const match =
        r.summary?.toLowerCase().includes(s) ||
        r.txHash?.toLowerCase().includes(s) ||
        r.content?.toLowerCase().includes(s) ||
        (r.tags || []).some((t) => t.toLowerCase().includes(s)) ||
        Object.entries(r.labels || {}).some(
          ([k, v]) => k.toLowerCase().includes(s) || v.toLowerCase().includes(s)
        );
      if (!match) return false;
    }
    if (activeTag) {
      if (!(r.tags || []).some((t) => t.toLowerCase() === activeTag.toLowerCase()))
        return false;
    }
    if (activeLabel) {
      if (!r.labels || r.labels[activeLabel.key] !== activeLabel.value)
        return false;
    }
    return true;
  });

  const hasFilters = search || activeTag || activeLabel;

  const clearFilters = () => {
    setSearch("");
    setActiveTag("");
    setActiveLabel(null);
    setTagFilter("");
    setLabelFilter({ key: "", value: "" });
  };

  const clickTag = (tag) => {
    setActiveTag(activeTag === tag ? "" : tag);
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Transactions</h2>
          <p className="text-sm text-slate-400">
            Submit and browse on-chain record transactions
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-colors ${
            showForm
              ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
              : "bg-sky-600 text-white hover:bg-sky-500"
          }`}
        >
          {showForm ? "Cancel" : "+ New Transaction"}
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-emerald-400">
              {toast.message}
            </p>
            {toast.txHash && (
              <p className="mt-0.5 font-mono text-xs text-emerald-500/80">
                TX: {toast.txHash}
              </p>
            )}
          </div>
          <button
            onClick={() => setToast(null)}
            className="text-xs text-slate-500 hover:text-slate-300"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Create form */}
      {showForm && <CreateForm onSuccess={handleSuccess} />}

      {/* Search & filters */}
      <div className="card mb-6 space-y-4">
        <div className="flex items-center gap-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by summary, TX hash, content, tag, or label..."
            className="input-field flex-1"
          />
          <span className="whitespace-nowrap text-xs text-slate-500">
            {filteredRecords.length} record
            {filteredRecords.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Tag & label filter row */}
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-xs text-slate-500">
              Filter by tag
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && tagFilter.trim()) {
                    setActiveTag(tagFilter.trim());
                  }
                }}
                placeholder="e.g. finance"
                className="input-field w-36"
              />
              <button
                onClick={() => {
                  if (tagFilter.trim()) setActiveTag(tagFilter.trim());
                }}
                className="rounded-lg bg-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-600"
              >
                Apply
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">
              Filter by label
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={labelFilter.key}
                onChange={(e) =>
                  setLabelFilter({ ...labelFilter, key: e.target.value })
                }
                placeholder="Key"
                className="input-field w-28"
              />
              <input
                type="text"
                value={labelFilter.value}
                onChange={(e) =>
                  setLabelFilter({ ...labelFilter, value: e.target.value })
                }
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    labelFilter.key.trim() &&
                    labelFilter.value.trim()
                  ) {
                    setActiveLabel({
                      key: labelFilter.key.trim(),
                      value: labelFilter.value.trim(),
                    });
                  }
                }}
                placeholder="Value"
                className="input-field w-28"
              />
              <button
                onClick={() => {
                  if (labelFilter.key.trim() && labelFilter.value.trim()) {
                    setActiveLabel({
                      key: labelFilter.key.trim(),
                      value: labelFilter.value.trim(),
                    });
                  }
                }}
                className="rounded-lg bg-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-600"
              >
                Apply
              </button>
            </div>
          </div>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="rounded-lg border border-slate-600 px-4 py-2 text-xs text-slate-400 hover:text-white"
            >
              Clear all filters
            </button>
          )}
        </div>

        {/* Active filter pills */}
        {(activeTag || activeLabel) && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">Active filters:</span>
            {activeTag && (
              <span className="badge-blue flex items-center gap-1">
                tag: {activeTag}
                <button onClick={() => setActiveTag("")} className="ml-0.5 text-sky-300 hover:text-white">
                  x
                </button>
              </span>
            )}
            {activeLabel && (
              <span className="badge-green flex items-center gap-1">
                {activeLabel.key}={activeLabel.value}
                <button onClick={() => setActiveLabel(null)} className="ml-0.5 text-emerald-300 hover:text-white">
                  x
                </button>
              </span>
            )}
          </div>
        )}

        {/* Quick-access tag cloud */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-500 mr-1">Tags:</span>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => clickTag(tag)}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                  activeTag === tag
                    ? "bg-sky-500 text-white"
                    : "bg-sky-500/20 text-sky-400 hover:bg-sky-500/30"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results */}
      <div className="card">
        {loading && !records ? (
          <p className="py-8 text-center text-slate-500">
            Loading transactions...
          </p>
        ) : filteredRecords.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-slate-500">No transactions found.</p>
            {records?.note && (
              <p className="mt-2 text-xs text-slate-600">{records.note}</p>
            )}
            {hasFilters ? (
              <button
                onClick={clearFilters}
                className="mt-4 text-sm text-sky-400 hover:text-sky-300"
              >
                Clear filters
              </button>
            ) : (
              <button
                onClick={() => setShowForm(true)}
                className="mt-4 text-sm text-sky-400 hover:text-sky-300"
              >
                Submit your first transaction
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-500">
                  <th className="pb-3 pr-4">Summary</th>
                  <th className="pb-3 pr-4">TX Hash</th>
                  <th className="pb-3 pr-4">Tags</th>
                  <th className="pb-3 pr-4">Type</th>
                  <th className="pb-3">Time</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((r) => (
                  <tr key={r.txHash} className="group">
                    <td colSpan={5} className="p-0">
                      <div
                        onClick={() =>
                          setExpanded(
                            expanded === r.txHash ? null : r.txHash
                          )
                        }
                        className="cursor-pointer border-t border-slate-700/50 transition-colors hover:bg-slate-700/20"
                      >
                        <div className="flex items-center py-3">
                          <div className="min-w-0 flex-1 pr-4">
                            <span className="font-medium">
                              {r.summary || "Untitled"}
                            </span>
                            {r.code !== 0 && r.code != null && (
                              <span className="badge-red ml-2">failed</span>
                            )}
                          </div>
                          <div className="w-40 shrink-0 pr-4 font-mono text-xs text-sky-400">
                            {r.txHash ? truncate(r.txHash, 16) : "—"}
                          </div>
                          <div className="w-44 shrink-0 pr-4">
                            <div className="flex flex-wrap gap-1">
                              {(r.tags || []).slice(0, 3).map((t) => (
                                <button
                                  key={t}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    clickTag(t);
                                  }}
                                  className="badge-blue hover:bg-sky-500/30"
                                >
                                  {t}
                                </button>
                              ))}
                              {(r.tags || []).length > 3 && (
                                <span className="text-xs text-slate-500">
                                  +{r.tags.length - 3}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="w-20 shrink-0 pr-4">
                            <span
                              className={
                                r.contentType === "file"
                                  ? "badge-yellow"
                                  : "badge-blue"
                              }
                            >
                              {r.contentType === "file" ? "File" : "Text"}
                            </span>
                          </div>
                          <div className="w-40 shrink-0 text-xs text-slate-500">
                            {r.time
                              ? new Date(r.time).toLocaleString()
                              : "—"}
                          </div>
                        </div>

                        {expanded === r.txHash && (
                          <div className="border-t border-slate-700/30 px-0 py-4">
                            <div className="mb-3 grid grid-cols-2 gap-4 text-xs">
                              <div>
                                <span className="text-slate-500">
                                  TX Hash:{" "}
                                </span>
                                <span className="font-mono text-sky-400">
                                  {r.txHash}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-500">
                                  Block Height:{" "}
                                </span>
                                <span className="text-slate-300">
                                  {r.height || "—"}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-500">
                                  Creator:{" "}
                                </span>
                                <span className="font-mono text-slate-300">
                                  {r.creator || "—"}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-500">
                                  Content Type:{" "}
                                </span>
                                <span className="text-slate-300">
                                  {r.contentType}
                                  {r.fileName ? ` (${r.fileName})` : ""}
                                </span>
                              </div>
                            </div>

                            {/* Tags */}
                            {(r.tags || []).length > 0 && (
                              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                                <span className="text-xs text-slate-500">Tags:</span>
                                {r.tags.map((t) => (
                                  <button
                                    key={t}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      clickTag(t);
                                    }}
                                    className="badge-blue hover:bg-sky-500/30"
                                  >
                                    {t}
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Labels */}
                            {Object.keys(r.labels || {}).length > 0 && (
                              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                                <span className="text-xs text-slate-500">Labels:</span>
                                {Object.entries(r.labels).map(([k, v]) => (
                                  <button
                                    key={k}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveLabel({ key: k, value: v });
                                    }}
                                    className="badge-green hover:bg-emerald-500/30"
                                  >
                                    {k}={v}
                                  </button>
                                ))}
                              </div>
                            )}

                            <ExpandedContent record={r} />
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
