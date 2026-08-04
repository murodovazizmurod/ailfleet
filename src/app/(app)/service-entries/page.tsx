import Link from "next/link";
import { db } from "@/lib/db";
import { meter, money, shortDate, vehicleTitle } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, Td } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

export default async function ServiceEntriesPage() {
  const entries = await db.serviceEntry.findMany({
    include: {
      vehicle: true,
      vendor: true,
      workOrder: { select: { id: true, number: true } },
      lines: { include: { task: true } },
    },
    orderBy: { date: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="Service History"
        subtitle="Completed maintenance across the fleet"
        actions={<ButtonLink href="/service-entries/new">+ New Service Entry</ButtonLink>}
      />

      {entries.length === 0 ? (
        <EmptyState
          title="No service entries yet"
          hint="Log outsourced work directly, or complete a work order to auto-generate history."
          action={<ButtonLink href="/service-entries/new">+ New Service Entry</ButtonLink>}
        />
      ) : (
        <DataTable headers={["Date", "Vehicle", "Tasks / Description", "Vendor", "Meter", "Total"]}>
          {entries.map((e) => {
            const taskNames = e.lines
              .map((l) => l.task?.name ?? l.description)
              .filter(Boolean) as string[];
            return (
              <tr key={e.id} className="hover:bg-slate-50">
                <Td className="whitespace-nowrap">{shortDate(e.date)}</Td>
                <Td>
                  <Link
                    href={`/vehicles/${e.vehicleId}`}
                    className="text-indigo-600 hover:underline"
                  >
                    {e.vehicle.name}
                  </Link>
                  <span className="ml-1.5 text-xs text-slate-400">
                    {vehicleTitle(e.vehicle)}
                  </span>
                </Td>
                <Td>
                  {taskNames.length > 0 ? (
                    <span>{taskNames.join(", ")}</span>
                  ) : (
                    <span className="text-slate-400">{e.notes ?? "—"}</span>
                  )}
                  {e.workOrder ? (
                    <Link
                      href={`/work-orders/${e.workOrder.id}`}
                      className="ml-2 text-xs text-indigo-600 hover:underline"
                    >
                      WO #{e.workOrder.number}
                    </Link>
                  ) : null}
                </Td>
                <Td>{e.vendor?.name ?? "—"}</Td>
                <Td>{meter(e.meter, e.vehicle.meterUnit)}</Td>
                <Td className="font-medium text-slate-900">{money(e.total)}</Td>
              </tr>
            );
          })}
        </DataTable>
      )}
    </div>
  );
}
