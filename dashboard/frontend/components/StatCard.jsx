export default function StatCard({ title, value, subtitle, color = "sky" }) {
  const colorMap = {
    sky: "text-sky-400",
    green: "text-emerald-400",
    amber: "text-amber-400",
    red: "text-red-400",
    purple: "text-purple-400",
  };

  return (
    <div className="card">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
        {title}
      </p>
      <p className={`mt-2 text-3xl font-bold ${colorMap[color] || colorMap.sky}`}>
        {value ?? "—"}
      </p>
      {subtitle && (
        <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
      )}
    </div>
  );
}
