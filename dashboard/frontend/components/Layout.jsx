import Link from "next/link";
import { useRouter } from "next/router";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "⬡" },
  { href: "/explorer", label: "Explorer", icon: "🔍" },
  { href: "/transactions", label: "Transactions", icon: "↔" },
  { href: "/nodes", label: "Nodes", icon: "◎" },
  { href: "/security", label: "Security", icon: "🛡" },
];

export default function Layout({ children }) {
  const router = useRouter();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 flex h-full w-56 flex-col border-r border-slate-700 bg-slate-900 p-4">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-sky-400">⛓ LocalChain</h1>
          <p className="text-xs text-slate-500 mt-1">Dashboard</p>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = router.pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "bg-sky-500/10 text-sky-400 font-medium"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto pt-4 border-t border-slate-700">
          <a
            href="http://localhost:3001"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300"
          >
            📊 Grafana
          </a>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-56 flex-1 p-6">{children}</main>
    </div>
  );
}
