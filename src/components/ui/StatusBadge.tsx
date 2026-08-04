import type { BadgeColor, EnumDef } from "@/lib/enums";

const COLORS: Record<BadgeColor, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  yellow: "bg-amber-50 text-amber-700 ring-amber-600/20",
  orange: "bg-orange-50 text-orange-700 ring-orange-600/20",
  red: "bg-red-50 text-red-700 ring-red-600/20",
  blue: "bg-blue-50 text-blue-700 ring-blue-600/20",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  gray: "bg-slate-100 text-slate-600 ring-slate-500/20",
  purple: "bg-purple-50 text-purple-700 ring-purple-600/20",
};

export function StatusBadge({
  def,
  value,
}: {
  def: EnumDef;
  value: string | null | undefined;
}) {
  if (!value) return <span className="text-slate-400">—</span>;
  const entry = def[value];
  const color = entry?.color ?? "gray";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap ${COLORS[color]}`}
    >
      {entry?.label ?? value}
    </span>
  );
}
