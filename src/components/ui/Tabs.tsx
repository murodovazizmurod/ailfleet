import Link from "next/link";

export function Tabs({
  tabs,
  active,
}: {
  tabs: { key: string; label: string; href: string; count?: number }[];
  active: string;
}) {
  return (
    <div className="mb-4 border-b border-slate-200">
      <nav className="-mb-px flex flex-wrap gap-x-6">
        {tabs.map((t) => {
          const isActive = t.key === active;
          return (
            <Link
              key={t.key}
              href={t.href}
              className={`flex items-center gap-2 border-b-2 px-1 py-2.5 text-sm font-medium whitespace-nowrap ${
                isActive
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
              }`}
            >
              {t.label}
              {t.count != null ? (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    isActive ? "bg-indigo-50 text-indigo-600" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {t.count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
