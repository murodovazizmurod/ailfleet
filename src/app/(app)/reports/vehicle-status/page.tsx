import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, Td } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ASSET_TYPE, OWNERSHIP, VEHICLE_STATUS, enumKeys } from "@/lib/enums";
import { meter, num, vehicleTitle } from "@/lib/format";
import { FilterBar, FilterField, filterInputCls } from "../FilterBar";
import {
  filterQuery,
  getVehicleStatusReport,
  parseVehicleStatusFilters,
  type SearchParams,
} from "../lib";

export const dynamic = "force-dynamic";

export default async function VehicleStatusReport({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const f = parseVehicleStatusFilters(sp);
  const { countMap, rows } = await getVehicleStatusReport(f);
  const query = filterQuery({ status: f.status });
  const totalCount = [...countMap.values()].reduce((a, c) => a + c, 0);

  return (
    <>
      <PageHeader
        title="Vehicle Status Summary"
        subtitle="Fleet counts by status with the full vehicle list (archived excluded)."
        actions={<ButtonLink href="/reports" variant="secondary">All reports</ButtonLink>}
      />

      <FilterBar
        action="/reports/vehicle-status"
        showDates={false}
        csvHref={`/reports/vehicle-status/csv${query}`}
      >
        <FilterField label="Status">
          <select name="status" defaultValue={f.status ?? ""} className={filterInputCls}>
            <option value="">All statuses</option>
            {enumKeys(VEHICLE_STATUS).map((k) => (
              <option key={k} value={k}>
                {VEHICLE_STATUS[k].label}
              </option>
            ))}
          </select>
        </FilterField>
      </FilterBar>

      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Link
          href="/reports/vehicle-status"
          className={`rounded-xl border bg-white p-4 transition-shadow hover:shadow-sm ${
            !f.status ? "border-indigo-300 ring-1 ring-indigo-200" : "border-slate-200"
          }`}
        >
          <p className="text-xs font-medium text-slate-500">All Vehicles</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{num(totalCount)}</p>
        </Link>
        {enumKeys(VEHICLE_STATUS).map((status) => (
          <Link
            key={status}
            href={`/reports/vehicle-status?status=${status}`}
            className={`rounded-xl border bg-white p-4 transition-shadow hover:shadow-sm ${
              f.status === status ? "border-indigo-300 ring-1 ring-indigo-200" : "border-slate-200"
            }`}
          >
            <p className="text-xs font-medium text-slate-500">{VEHICLE_STATUS[status].label}</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">
              {num(countMap.get(status) ?? 0)}
            </p>
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No vehicles match this filter" hint="Try clearing the status filter." />
      ) : (
        <DataTable headers={["Vehicle", "Details", "Type", "Group", "Status", "Ownership", "Current Meter"]}>
          {rows.map((v) => (
            <tr key={v.id} className="hover:bg-slate-50/60">
              <Td>
                <Link href={`/vehicles/${v.id}`} className="font-medium text-indigo-600 hover:underline">
                  {v.name}
                </Link>
              </Td>
              <Td className="text-slate-500">{vehicleTitle(v)}</Td>
              <Td>
                <StatusBadge def={ASSET_TYPE} value={v.assetType} />
              </Td>
              <Td>{v.group?.name ?? "—"}</Td>
              <Td>
                <StatusBadge def={VEHICLE_STATUS} value={v.status} />
              </Td>
              <Td>
                <StatusBadge def={OWNERSHIP} value={v.ownership} />
              </Td>
              <Td className="whitespace-nowrap">{meter(v.currentMeter, v.meterUnit)}</Td>
            </tr>
          ))}
        </DataTable>
      )}
    </>
  );
}
