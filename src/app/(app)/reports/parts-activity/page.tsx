import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { DataTable, Td } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ADJUSTMENT_REASON, enumKeys } from "@/lib/enums";
import { dateTime, num } from "@/lib/format";
import { FilterBar, FilterField, filterInputCls } from "../FilterBar";
import {
  filterQuery,
  getPartsActivity,
  parsePartsActivityFilters,
  type SearchParams,
} from "../lib";

export const dynamic = "force-dynamic";

export default async function PartsActivityReport({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const f = parsePartsActivityFilters(sp);
  const adjustments = await getPartsActivity(f);
  const query = filterQuery({ from: f.from, to: f.to, reason: f.reason });

  const received = adjustments
    .filter((a) => a.delta > 0)
    .reduce((acc, a) => acc + a.delta, 0);
  const consumed = adjustments
    .filter((a) => a.delta < 0)
    .reduce((acc, a) => acc + Math.abs(a.delta), 0);
  const netChange = adjustments.reduce((acc, a) => acc + a.delta, 0);

  return (
    <>
      <PageHeader
        title="Parts Activity"
        subtitle="Inventory adjustment log — receipts, usage, corrections and losses."
        actions={<ButtonLink href="/reports" variant="secondary">All reports</ButtonLink>}
      />

      <FilterBar
        action="/reports/parts-activity"
        from={f.from}
        to={f.to}
        csvHref={`/reports/parts-activity/csv${query}`}
      >
        <FilterField label="Reason">
          <select name="reason" defaultValue={f.reason ?? ""} className={filterInputCls}>
            <option value="">All reasons</option>
            {enumKeys(ADJUSTMENT_REASON).map((k) => (
              <option key={k} value={k}>
                {ADJUSTMENT_REASON[k].label}
              </option>
            ))}
          </select>
        </FilterField>
      </FilterBar>

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Adjustments" value={num(adjustments.length)} />
        <StatCard label="Qty In" value={`+${num(received, 1)}`} accent="text-emerald-600" />
        <StatCard label="Qty Out" value={`−${num(consumed, 1)}`} accent="text-red-600" />
        <StatCard
          label="Net Change"
          value={`${netChange >= 0 ? "+" : "−"}${num(Math.abs(netChange), 1)}`}
          accent={netChange >= 0 ? "text-emerald-600" : "text-red-600"}
        />
      </div>

      {adjustments.length === 0 ? (
        <EmptyState
          title="No part adjustments in this range"
          hint="Try widening the date range or clearing filters."
        />
      ) : (
        <DataTable headers={["Date", "Part", "Description", "Reason", "Qty Change", "Note"]}>
          {adjustments.map((a) => (
            <tr key={a.id} className="hover:bg-slate-50/60">
              <Td className="whitespace-nowrap">{dateTime(a.createdAt)}</Td>
              <Td>
                <Link href={`/parts/${a.part.id}`} className="font-medium text-indigo-600 hover:underline">
                  {a.part.number}
                </Link>
              </Td>
              <Td className="max-w-64">
                <span className="line-clamp-1">{a.part.description ?? "—"}</span>
              </Td>
              <Td>
                <StatusBadge def={ADJUSTMENT_REASON} value={a.reason} />
              </Td>
              <Td
                className={`font-medium ${a.delta >= 0 ? "text-emerald-600" : "text-red-600"}`}
              >
                {a.delta >= 0 ? `+${num(a.delta, 1)}` : `−${num(Math.abs(a.delta), 1)}`}
              </Td>
              <Td className="max-w-64 text-slate-500">
                <span className="line-clamp-1">{a.note ?? "—"}</span>
              </Td>
            </tr>
          ))}
        </DataTable>
      )}
    </>
  );
}
