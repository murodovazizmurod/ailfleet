import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { DataTable, Td } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { FUEL_TYPE } from "@/lib/enums";
import { money, num } from "@/lib/format";
import { FilterBar } from "../FilterBar";
import {
  filterQuery,
  getFuelSummary,
  getVehicleOptions,
  parseFilters,
  type SearchParams,
} from "../lib";

export const dynamic = "force-dynamic";

export default async function FuelSummaryReport({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const f = parseFilters(sp);
  const [rows, vehicles] = await Promise.all([getFuelSummary(f), getVehicleOptions()]);
  const query = filterQuery({ from: f.from, to: f.to, vehicleId: f.vehicleId });

  const totalEntries = rows.reduce((a, r) => a + r.entries, 0);
  const totalVolume = rows.reduce((a, r) => a + r.volume, 0);
  const totalCost = rows.reduce((a, r) => a + r.cost, 0);
  const economies = rows.filter((r) => r.avgEconomy != null);
  const fleetAvgEconomy =
    economies.length > 0
      ? economies.reduce((a, r) => a + (r.avgEconomy ?? 0), 0) / economies.length
      : null;

  return (
    <>
      <PageHeader
        title="Fuel Summary"
        subtitle="Per-vehicle fuel entries, volume, spend, average economy and price per unit."
        actions={<ButtonLink href="/reports" variant="secondary">All reports</ButtonLink>}
      />

      <FilterBar
        action="/reports/fuel-summary"
        from={f.from}
        to={f.to}
        vehicleId={f.vehicleId}
        vehicles={vehicles}
        csvHref={`/reports/fuel-summary/csv${query}`}
      />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Fuel Entries" value={num(totalEntries)} />
        <StatCard label="Total Volume" value={`${num(totalVolume, 1)} gal`} />
        <StatCard label="Total Spend" value={money(totalCost)} accent="text-indigo-600" />
        <StatCard
          label="Avg Fuel Economy"
          value={fleetAvgEconomy != null ? num(fleetAvgEconomy, 1) : "—"}
          hint="Mean of per-vehicle averages"
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No fuel entries in this range"
          hint="Try widening the date range or clearing filters."
        />
      ) : (
        <DataTable
          headers={[
            "Vehicle",
            "Fuel Type",
            "Entries",
            "Total Volume",
            "Total Cost",
            "Avg Economy",
            "Avg Price / Unit",
          ]}
        >
          {rows.map((r) => (
            <tr key={r.vehicleId} className="hover:bg-slate-50/60">
              <Td>
                <Link href={`/vehicles/${r.vehicleId}`} className="font-medium text-indigo-600 hover:underline">
                  {r.name}
                </Link>
                {r.title !== "—" ? <span className="ml-2 text-xs text-slate-400">{r.title}</span> : null}
              </Td>
              <Td>
                <StatusBadge def={FUEL_TYPE} value={r.fuelType} />
              </Td>
              <Td>{num(r.entries)}</Td>
              <Td>{num(r.volume, 1)} gal</Td>
              <Td className="font-medium text-slate-900">{money(r.cost)}</Td>
              <Td>{r.avgEconomy != null ? num(r.avgEconomy, 1) : "—"}</Td>
              <Td>{r.avgPrice != null ? money(r.avgPrice) : "—"}</Td>
            </tr>
          ))}
        </DataTable>
      )}
    </>
  );
}
