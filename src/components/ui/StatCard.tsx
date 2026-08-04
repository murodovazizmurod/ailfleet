import { ReactNode } from "react";
import Link from "next/link";

export function StatCard({
  label,
  value,
  hint,
  href,
  accent = "text-slate-900",
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  href?: string;
  accent?: string;
  icon?: ReactNode;
}) {
  const body = (
    <div className="rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {icon}
      </div>
      <p className={`mt-2 text-2xl font-semibold ${accent}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
