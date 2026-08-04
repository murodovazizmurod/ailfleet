import { ReactNode } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import type { VehicleOption } from "./lib";
import { vehicleLabel } from "./lib";

export const filterInputCls =
  "rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none";

export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}

/**
 * Simple GET filter form + CSV download link shared by all report pages.
 * Extra report-specific selects go in `children`.
 */
export function FilterBar({
  action,
  from,
  to,
  vehicleId,
  vehicles,
  showDates = true,
  csvHref,
  children,
}: {
  action: string;
  from?: string | null;
  to?: string | null;
  vehicleId?: string | null;
  vehicles?: VehicleOption[];
  showDates?: boolean;
  csvHref: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <form method="get" action={action} className="flex flex-wrap items-end gap-3">
        {showDates ? (
          <>
            <FilterField label="From">
              <input type="date" name="from" defaultValue={from ?? ""} className={filterInputCls} />
            </FilterField>
            <FilterField label="To">
              <input type="date" name="to" defaultValue={to ?? ""} className={filterInputCls} />
            </FilterField>
          </>
        ) : null}
        {vehicles ? (
          <FilterField label="Vehicle">
            <select
              name="vehicleId"
              defaultValue={vehicleId ?? ""}
              className={`${filterInputCls} max-w-56`}
            >
              <option value="">All vehicles</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {vehicleLabel(v)}
                </option>
              ))}
            </select>
          </FilterField>
        ) : null}
        {children}
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-500"
        >
          Apply
        </button>
        <Link href={action} className="py-1.5 text-sm text-slate-500 hover:text-slate-700">
          Reset
        </Link>
      </form>
      <a
        href={csvHref}
        className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-300 transition-colors hover:bg-slate-50"
      >
        <Download className="h-4 w-4 text-slate-400" />
        Download CSV
      </a>
    </div>
  );
}
