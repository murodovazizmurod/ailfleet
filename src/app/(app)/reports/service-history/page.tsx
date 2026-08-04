import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { DataTable, Td } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { money, num, shortDate } from "@/lib/format";
import { FilterBar } from "../FilterBar";
import {
  filterQuery,
  getServiceHistory,
  getVehicleOptions,
  parseFilters,
  serviceEntryTasks,
  type SearchParams,
} from "../lib";

export const dynamic = "force-dynamic";

export default async function ServiceHistoryReport({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const f = parseFilters(sp);
  const [entries, vehicles] = await Promise.all([getServiceHistory(f), getVehicleOptions()]);
  const query = filterQuery({ from: f.from, to: f.to, vehicleId: f.vehicleId });

  const totalCost = entries.reduce((a, e) => a + e.total, 0);
  const laborTotal = entries.reduce((a, e) => a + e.laborTotal, 0);
  const partsTotal = entries.reduce((a, e) => a + e.partsTotal, 0);

  return (
    <>
      <PageHeader
        title="Service History"
        subtitle="All logged service entries with tasks, vendors and totals."
        actions={<ButtonLink href="/reports" variant="secondary">All reports</ButtonLink>}
      />

      <FilterBar
        action="/reports/service-history"
        from={f.from}
        to={f.to}
        vehicleId={f.vehicleId}
        vehicles={vehicles}
        csvHref={`/reports/service-history/csv${query}`}
      />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Service Entries" value={num(entries.length)} />
        <StatCard label="Labor" value={money(laborTotal)} />
        <StatCard label="Parts" value={money(partsTotal)} />
        <StatCard label="Total Cost" value={money(totalCost)} accent="text-indigo-600" />
      </div>

      {entries.length === 0 ? (
        <EmptyState
          title="No service entries in this range"
          hint="Try widening the date range or clearing filters."
        />
      ) : (
        <DataTable headers={["Date", "Vehicle", "Tasks", "Vendor", "Meter", "Labor", "Parts", "Total"]}>
          {entries.map((e) => (
            <tr key={e.id} className="hover:bg-slate-50/60">
              <Td className="whitespace-nowrap">{shortDate(e.date)}</Td>
              <Td>
                <Link href={`/vehicles/${e.vehicle.id}`} className="font-medium text-indigo-600 hover:underline">
                  {e.vehicle.name}
                </Link>
              </Td>
              <Td className="max-w-72">
                <span className="line-clamp-2">{serviceEntryTasks(e)}</span>
              </Td>
              <Td>{e.vendor?.name ?? "—"}</Td>
              <Td className="whitespace-nowrap">
                {e.meter != null ? `${num(e.meter)} ${e.vehicle.meterUnit}` : "—"}
              </Td>
              <Td>{money(e.laborTotal)}</Td>
              <Td>{money(e.partsTotal)}</Td>
              <Td className="font-medium text-slate-900">{money(e.total)}</Td>
            </tr>
          ))}
        </DataTable>
      )}
    </>
  );
}
