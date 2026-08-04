import Link from "next/link";
import { startOfMonth } from "date-fns";
import { db } from "@/lib/db";
import { PRIORITY, REPAIR_CLASS, WORK_ORDER_STATUS, enumLabel } from "@/lib/enums";
import { money, shortDate, vehicleTitle } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Tabs } from "@/components/ui/Tabs";
import { DataTable, Td } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EnumSelect, Select } from "@/components/ui/FormField";

export const dynamic = "force-dynamic";

const OPEN_STATUSES = ["open", "pending", "in_progress", "waiting_on_parts"];

export default async function WorkOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    vehicleId?: string;
    assignedToId?: string;
    priority?: string;
  }>;
}) {
  const sp = await searchParams;
  const status = sp.status && WORK_ORDER_STATUS[sp.status] ? sp.status : "all";

  const where = {
    ...(status !== "all" ? { status } : {}),
    ...(sp.vehicleId ? { vehicleId: sp.vehicleId } : {}),
    ...(sp.assignedToId ? { assignedToId: sp.assignedToId } : {}),
    ...(sp.priority ? { priority: sp.priority } : {}),
  };

  const [workOrders, statusCounts, completedThisMonth, openValue, vehicles, techs] =
    await Promise.all([
      db.workOrder.findMany({
        where,
        include: {
          vehicle: true,
          assignedTo: true,
          _count: { select: { lines: true } },
        },
        orderBy: { number: "desc" },
      }),
      db.workOrder.groupBy({ by: ["status"], _count: { _all: true } }),
      db.workOrder.count({
        where: { status: "completed", completedAt: { gte: startOfMonth(new Date()) } },
      }),
      db.workOrder.aggregate({
        where: { status: { in: OPEN_STATUSES } },
        _sum: { total: true },
      }),
      db.vehicle.findMany({ where: { archived: false }, orderBy: { name: "asc" } }),
      db.contact.findMany({
        where: { isTechnician: true, archived: false },
        orderBy: { lastName: "asc" },
      }),
    ]);

  const countOf = (s: string) =>
    statusCounts.find((c) => c.status === s)?._count._all ?? 0;
  const totalCount = statusCounts.reduce((sum, c) => sum + c._count._all, 0);

  const filterQs = (s: string) => {
    const p = new URLSearchParams();
    if (s !== "all") p.set("status", s);
    if (sp.vehicleId) p.set("vehicleId", sp.vehicleId);
    if (sp.assignedToId) p.set("assignedToId", sp.assignedToId);
    if (sp.priority) p.set("priority", sp.priority);
    const q = p.toString();
    return q ? `/work-orders?${q}` : "/work-orders";
  };

  const tabs = [
    { key: "all", label: "All", href: filterQs("all"), count: totalCount },
    ...Object.entries(WORK_ORDER_STATUS).map(([k, v]) => ({
      key: k,
      label: v.label,
      href: filterQs(k),
      count: countOf(k),
    })),
  ];

  return (
    <div>
      <PageHeader
        title="Work Orders"
        subtitle="In-house maintenance and repair jobs"
        actions={<ButtonLink href="/work-orders/new">+ New Work Order</ButtonLink>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Open" value={countOf("open")} href={filterQs("open")} />
        <StatCard
          label="In Progress"
          value={countOf("in_progress")}
          accent="text-amber-600"
          href={filterQs("in_progress")}
        />
        <StatCard
          label="Waiting on Parts"
          value={countOf("waiting_on_parts")}
          accent="text-orange-600"
          href={filterQs("waiting_on_parts")}
        />
        <StatCard
          label="Completed This Month"
          value={completedThisMonth}
          accent="text-emerald-600"
        />
        <StatCard
          label="Total Open Value"
          value={money(openValue._sum.total ?? 0)}
          hint="All non-completed work orders"
        />
      </div>

      <Tabs tabs={tabs} active={status} />

      <form
        method="get"
        className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3"
      >
        {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
        <div className="w-52">
          <Select name="vehicleId" defaultValue={sp.vehicleId ?? ""}>
            <option value="">All vehicles</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-52">
          <Select name="assignedToId" defaultValue={sp.assignedToId ?? ""}>
            <option value="">All technicians</option>
            {techs.map((t) => (
              <option key={t.id} value={t.id}>
                {t.firstName} {t.lastName}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-44">
          <EnumSelect
            def={PRIORITY}
            name="priority"
            allowEmpty
            emptyLabel="All priorities"
            defaultValue={sp.priority ?? ""}
          />
        </div>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>

      {workOrders.length === 0 ? (
        <EmptyState
          title="No work orders found"
          hint="Try clearing filters, or create a new work order to get started."
          action={<ButtonLink href="/work-orders/new">+ New Work Order</ButtonLink>}
        />
      ) : (
        <DataTable
          headers={[
            "#",
            "Vehicle",
            "Status",
            "Priority",
            "Repair Class",
            "Assigned To",
            "Issued",
            "Lines",
            "Total",
          ]}
        >
          {workOrders.map((wo) => (
            <tr key={wo.id} className="hover:bg-slate-50">
              <Td>
                <Link
                  href={`/work-orders/${wo.id}`}
                  className="font-medium text-indigo-600 hover:underline"
                >
                  #{wo.number}
                </Link>
              </Td>
              <Td>
                <Link
                  href={`/vehicles/${wo.vehicleId}`}
                  className="text-indigo-600 hover:underline"
                >
                  {wo.vehicle.name}
                </Link>
                <span className="ml-1.5 text-xs text-slate-400">
                  {vehicleTitle(wo.vehicle)}
                </span>
              </Td>
              <Td>
                <StatusBadge def={WORK_ORDER_STATUS} value={wo.status} />
              </Td>
              <Td>
                <StatusBadge def={PRIORITY} value={wo.priority} />
              </Td>
              <Td>{enumLabel(REPAIR_CLASS, wo.repairClass)}</Td>
              <Td>
                {wo.assignedTo
                  ? `${wo.assignedTo.firstName} ${wo.assignedTo.lastName}`
                  : "—"}
              </Td>
              <Td>{shortDate(wo.issuedAt)}</Td>
              <Td>{wo._count.lines}</Td>
              <Td className="font-medium text-slate-900">{money(wo.total)}</Td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}
