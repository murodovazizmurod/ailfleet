import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { DataTable, Td } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { money, num } from "@/lib/format";
import { FilterBar } from "../FilterBar";
import {
  filterQuery,
  getOperatingCosts,
  getVehicleOptions,
  parseFilters,
  type SearchParams,
} from "../lib";

export const dynamic = "force-dynamic";

export default async function OperatingCostsReport({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const f = parseFilters(sp);
  const [{ rows, totals }, vehicles] = await Promise.all([
    getOperatingCosts(f),
    getVehicleOptions(),
  ]);
  const query = filterQuery({ from: f.from, to: f.to, vehicleId: f.vehicleId });
  const activeRows = rows.filter((r) => r.total > 0 || r.meterDelta != null);
  const shownRows = f.vehicleId ? rows : activeRows.length > 0 ? activeRows : rows;

  return (
    <>
      <PageHeader
        title="Operating Costs Summary"
        subtitle="Fuel (incl. EV charging), service and other expenses per vehicle, with cost per meter over the selected range."
        actions={<ButtonLink href="/reports" variant="secondary">All reports</ButtonLink>}
      />

      <FilterBar
        action="/reports/operating-costs"
        from={f.from}
        to={f.to}
        vehicleId={f.vehicleId}
        vehicles={vehicles}
        csvHref={`/reports/operating-costs/csv${query}`}
      />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Fuel Costs" value={money(totals.fuelCost)} />
        <StatCard label="Service Costs" value={money(totals.serviceCost)} />
        <StatCard label="Other Expenses" value={money(totals.otherCost)} />
        <StatCard label="Total Costs" value={money(totals.total)} accent="text-indigo-600" />
      </div>

      {shownRows.length === 0 ? (
        <EmptyState
          title="No cost data in this range"
          hint="Try widening the date range or clearing filters."
        />
      ) : (
        <DataTable
          headers={["Vehicle", "Fuel", "Service", "Other", "Total", "Meter Δ", "Cost / Meter"]}
          footer={
            <tfoot className="border-t border-slate-200 bg-slate-50">
              <tr>
                <Td className="font-semibold text-slate-900">Fleet total</Td>
                <Td className="font-semibold">{money(totals.fuelCost)}</Td>
                <Td className="font-semibold">{money(totals.serviceCost)}</Td>
                <Td className="font-semibold">{money(totals.otherCost)}</Td>
                <Td className="font-semibold text-slate-900">{money(totals.total)}</Td>
                <Td>{""}</Td>
                <Td>{""}</Td>
              </tr>
            </tfoot>
          }
        >
          {shownRows.map((r) => (
            <tr key={r.vehicleId} className="hover:bg-slate-50/60">
              <Td>
                <Link href={`/vehicles/${r.vehicleId}`} className="font-medium text-indigo-600 hover:underline">
                  {r.name}
                </Link>
                {r.title !== "—" ? <span className="ml-2 text-xs text-slate-400">{r.title}</span> : null}
              </Td>
              <Td>{money(r.fuelCost)}</Td>
              <Td>{money(r.serviceCost)}</Td>
              <Td>{money(r.otherCost)}</Td>
              <Td className="font-medium text-slate-900">{money(r.total)}</Td>
              <Td>{r.meterDelta != null ? `${num(r.meterDelta)} ${r.meterUnit}` : "—"}</Td>
              <Td>
                {r.costPerMeter != null
                  ? `$${r.costPerMeter.toFixed(2)}/${r.meterUnit}`
                  : "—"}
              </Td>
            </tr>
          ))}
        </DataTable>
      )}
    </>
  );
}
