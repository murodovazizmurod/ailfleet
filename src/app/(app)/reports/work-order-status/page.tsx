import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, Td } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { REPAIR_CLASS, WORK_ORDER_STATUS, enumKeys } from "@/lib/enums";
import { money, num, shortDate } from "@/lib/format";
import { FilterBar, FilterField, filterInputCls } from "../FilterBar";
import {
  filterQuery,
  getVehicleOptions,
  getWorkOrderStatus,
  parseWorkOrderFilters,
  type SearchParams,
} from "../lib";

export const dynamic = "force-dynamic";

export default async function WorkOrderStatusReport({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const f = parseWorkOrderFilters(sp);
  const [{ countMap, rows }, vehicles] = await Promise.all([
    getWorkOrderStatus(f),
    getVehicleOptions(),
  ]);
  const query = filterQuery({
    from: f.from,
    to: f.to,
    vehicleId: f.vehicleId,
    status: f.status,
  });
  const baseQuery = filterQuery({ from: f.from, to: f.to, vehicleId: f.vehicleId });
  const totalCount = [...countMap.values()].reduce((a, c) => a + c, 0);
  const totalCost = rows.reduce((a, r) => a + r.total, 0);

  return (
    <>
      <PageHeader
        title="Work Order Status Summary"
        subtitle="Work order counts by status for the selected range, with the underlying list."
        actions={<ButtonLink href="/reports" variant="secondary">All reports</ButtonLink>}
      />

      <FilterBar
        action="/reports/work-order-status"
        from={f.from}
        to={f.to}
        vehicleId={f.vehicleId}
        vehicles={vehicles}
        csvHref={`/reports/work-order-status/csv${query}`}
      >
        <FilterField label="Status">
          <select name="status" defaultValue={f.status ?? ""} className={filterInputCls}>
            <option value="">All statuses</option>
            {enumKeys(WORK_ORDER_STATUS).map((k) => (
              <option key={k} value={k}>
                {WORK_ORDER_STATUS[k].label}
              </option>
            ))}
          </select>
        </FilterField>
      </FilterBar>

      {/* Counts by status */}
      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
        <Link
          href={`/reports/work-order-status${baseQuery}`}
          className={`rounded-xl border bg-white p-4 transition-shadow hover:shadow-sm ${
            !f.status ? "border-indigo-300 ring-1 ring-indigo-200" : "border-slate-200"
          }`}
        >
          <p className="text-xs font-medium text-slate-500">All</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{num(totalCount)}</p>
        </Link>
        {enumKeys(WORK_ORDER_STATUS).map((status) => {
          const href = `/reports/work-order-status${filterQuery({
            from: f.from,
            to: f.to,
            vehicleId: f.vehicleId,
            status,
          })}`;
          return (
            <Link
              key={status}
              href={href}
              className={`rounded-xl border bg-white p-4 transition-shadow hover:shadow-sm ${
                f.status === status ? "border-indigo-300 ring-1 ring-indigo-200" : "border-slate-200"
              }`}
            >
              <p className="text-xs font-medium text-slate-500">
                {WORK_ORDER_STATUS[status].label}
              </p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {num(countMap.get(status) ?? 0)}
              </p>
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No work orders match these filters" hint="Try clearing some filters." />
      ) : (
        <DataTable
          headers={["#", "Vehicle", "Status", "Repair Class", "Issued", "Completed", "Assigned To", "Vendor", "Total"]}
          footer={
            <tfoot className="border-t border-slate-200 bg-slate-50">
              <tr>
                <Td className="font-semibold text-slate-900">
                  {num(rows.length)} work orders
                </Td>
                <Td>{""}</Td>
                <Td>{""}</Td>
                <Td>{""}</Td>
                <Td>{""}</Td>
                <Td>{""}</Td>
                <Td>{""}</Td>
                <Td>{""}</Td>
                <Td className="font-semibold text-slate-900">{money(totalCost)}</Td>
              </tr>
            </tfoot>
          }
        >
          {rows.map((w) => (
            <tr key={w.id} className="hover:bg-slate-50/60">
              <Td>
                <Link href={`/work-orders/${w.id}`} className="font-medium text-indigo-600 hover:underline">
                  #{w.number}
                </Link>
              </Td>
              <Td>
                <Link href={`/vehicles/${w.vehicle.id}`} className="text-indigo-600 hover:underline">
                  {w.vehicle.name}
                </Link>
              </Td>
              <Td>
                <StatusBadge def={WORK_ORDER_STATUS} value={w.status} />
              </Td>
              <Td>
                <StatusBadge def={REPAIR_CLASS} value={w.repairClass} />
              </Td>
              <Td className="whitespace-nowrap">{shortDate(w.issuedAt)}</Td>
              <Td className="whitespace-nowrap">{shortDate(w.completedAt)}</Td>
              <Td>
                {w.assignedTo ? `${w.assignedTo.firstName} ${w.assignedTo.lastName}` : "—"}
              </Td>
              <Td>{w.vendor?.name ?? "—"}</Td>
              <Td className="font-medium text-slate-900">{money(w.total)}</Td>
            </tr>
          ))}
        </DataTable>
      )}
    </>
  );
}
