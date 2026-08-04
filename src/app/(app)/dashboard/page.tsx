import Link from "next/link";
import { addDays, format, startOfMonth, subMonths } from "date-fns";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarClock,
  Package,
  Truck,
  Wrench,
} from "lucide-react";
import { db } from "@/lib/db";
import {
  ISSUE_STATUS,
  PRIORITY,
  REMINDER_STATUS,
  VEHICLE_STATUS,
  WORK_ORDER_STATUS,
  enumLabel,
} from "@/lib/enums";
import { meter, money, num, relative, shortDate } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CostsChart, type MonthCost } from "@/components/charts/CostsChart";

export const dynamic = "force-dynamic";

const STATUS_BAR_COLOR: Record<string, string> = {
  active: "bg-emerald-500",
  inactive: "bg-slate-300",
  in_shop: "bg-amber-400",
  out_of_service: "bg-red-500",
  sold: "bg-purple-400",
};

const COMMENT_ENTITY: Record<string, { label: string; href?: (id: string) => string }> = {
  vehicle: { label: "Vehicle", href: (id) => `/vehicles/${id}` },
  issue: { label: "Issue", href: (id) => `/issues/${id}` },
  work_order: { label: "Work Order", href: (id) => `/work-orders/${id}` },
  fuel_entry: { label: "Fuel Entry" },
  service_entry: { label: "Service Entry" },
  part: { label: "Part", href: (id) => `/parts/${id}` },
  purchase_order: { label: "Purchase Order", href: (id) => `/purchase-orders/${id}` },
  contact: { label: "Contact", href: (id) => `/contacts/${id}` },
};

async function getCostsByMonth(): Promise<MonthCost[]> {
  const now = new Date();
  const start = startOfMonth(subMonths(now, 5));
  const [fuel, charging, service, expenses] = await Promise.all([
    db.fuelEntry.findMany({ where: { date: { gte: start } }, select: { date: true, total: true } }),
    db.chargingEntry.findMany({ where: { date: { gte: start } }, select: { date: true, cost: true } }),
    db.serviceEntry.findMany({ where: { date: { gte: start } }, select: { date: true, total: true } }),
    db.expenseEntry.findMany({ where: { date: { gte: start } }, select: { date: true, amount: true } }),
  ]);

  const buckets = new Map<string, MonthCost>();
  for (let i = 5; i >= 0; i--) {
    const d = startOfMonth(subMonths(now, i));
    buckets.set(format(d, "yyyy-MM"), { month: format(d, "MMM"), fuel: 0, service: 0, other: 0 });
  }
  const add = (date: Date, key: "fuel" | "service" | "other", amount: number) => {
    const bucket = buckets.get(format(date, "yyyy-MM"));
    if (bucket) bucket[key] += amount;
  };
  fuel.forEach((e) => add(e.date, "fuel", e.total));
  charging.forEach((e) => add(e.date, "fuel", e.cost));
  service.forEach((e) => add(e.date, "service", e.total));
  expenses.forEach((e) => add(e.date, "other", e.amount));
  return [...buckets.values()];
}

export default async function DashboardPage() {
  const in30 = addDays(new Date(), 30);

  const [
    activeVehicles,
    openIssues,
    overdueIssues,
    overdueReminders,
    incompleteWorkOrders,
    stocks,
    vehicleRenewalsDue,
    contactRenewalsDue,
    statusCounts,
    costsByMonth,
    reminders,
    latestIssues,
    woByStatus,
    inspections,
    comments,
  ] = await Promise.all([
    db.vehicle.count({ where: { status: "active", archived: false } }),
    db.issue.count({ where: { status: { in: ["open", "overdue"] } } }),
    db.issue.count({ where: { status: "overdue" } }),
    db.serviceReminder.count({ where: { status: "overdue" } }),
    db.workOrder.count({ where: { status: { notIn: ["completed", "closed"] } } }),
    db.partStock.findMany({
      where: { reorderPoint: { not: null } },
      select: { partId: true, quantity: true, reorderPoint: true },
    }),
    db.vehicleRenewal.count({
      where: { status: { not: "completed" }, dueDate: { lte: in30 } },
    }),
    db.contactRenewal.count({
      where: { status: { not: "completed" }, dueDate: { lte: in30 } },
    }),
    db.vehicle.groupBy({ by: ["status"], _count: { _all: true }, where: { archived: false } }),
    getCostsByMonth(),
    db.serviceReminder.findMany({
      where: { status: { in: ["due_soon", "overdue"] } },
      include: {
        vehicle: { select: { id: true, name: true, meterUnit: true } },
        task: { select: { name: true } },
      },
      orderBy: { nextDueDate: "asc" },
      take: 7,
    }),
    db.issue.findMany({
      where: { status: { in: ["open", "overdue"] } },
      include: { vehicle: { select: { id: true, name: true } } },
      orderBy: { reportedAt: "desc" },
      take: 6,
    }),
    db.workOrder.groupBy({
      by: ["status"],
      _count: { _all: true },
      where: { status: { notIn: ["completed", "closed"] } },
    }),
    db.inspectionSubmission.findMany({
      include: {
        form: { select: { title: true } },
        vehicle: { select: { id: true, name: true } },
        _count: { select: { results: true } },
      },
      orderBy: { startedAt: "desc" },
      take: 6,
    }),
    db.comment.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
  ]);

  const lowStockParts = new Set(
    stocks
      .filter((s) => s.reorderPoint != null && s.reorderPoint > 0 && s.quantity <= s.reorderPoint)
      .map((s) => s.partId)
  ).size;
  const renewalsDue = vehicleRenewalsDue + contactRenewalsDue;

  const totalVehicles = statusCounts.reduce((acc, s) => acc + s._count._all, 0);
  const statusOrder = Object.keys(VEHICLE_STATUS);
  const sortedStatusCounts = [...statusCounts].sort(
    (a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status)
  );

  const woStatusOrder = Object.keys(WORK_ORDER_STATUS);
  const sortedWoCounts = [...woByStatus].sort(
    (a, b) => woStatusOrder.indexOf(a.status) - woStatusOrder.indexOf(b.status)
  );

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`Fleet overview · ${format(new Date(), "EEEE, MMM d, yyyy")}`}
      />

      {/* Stat row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Active Vehicles"
          value={num(activeVehicles)}
          hint={`${num(totalVehicles)} total in fleet`}
          href="/vehicles"
          icon={<Truck className="h-4 w-4 text-slate-400" />}
        />
        <StatCard
          label="Open Issues"
          value={num(openIssues)}
          hint={overdueIssues > 0 ? `${num(overdueIssues)} overdue` : "None overdue"}
          accent={overdueIssues > 0 ? "text-red-600" : "text-slate-900"}
          href="/issues"
          icon={<AlertTriangle className="h-4 w-4 text-slate-400" />}
        />
        <StatCard
          label="Overdue Reminders"
          value={num(overdueReminders)}
          hint="Service reminders past due"
          accent={overdueReminders > 0 ? "text-red-600" : "text-slate-900"}
          href="/reminders"
          icon={<CalendarClock className="h-4 w-4 text-slate-400" />}
        />
        <StatCard
          label="Incomplete Work Orders"
          value={num(incompleteWorkOrders)}
          hint="Not yet completed or closed"
          href="/work-orders"
          icon={<Wrench className="h-4 w-4 text-slate-400" />}
        />
        <StatCard
          label="Parts Below Reorder"
          value={num(lowStockParts)}
          hint="At or below reorder point"
          accent={lowStockParts > 0 ? "text-amber-600" : "text-slate-900"}
          href="/parts"
          icon={<Package className="h-4 w-4 text-slate-400" />}
        />
        <StatCard
          label="Renewals Due (30d)"
          value={num(renewalsDue)}
          hint={`${num(vehicleRenewalsDue)} vehicle · ${num(contactRenewalsDue)} contact`}
          accent={renewalsDue > 0 ? "text-amber-600" : "text-slate-900"}
          href="/renewals"
          icon={<BadgeCheck className="h-4 w-4 text-slate-400" />}
        />
      </div>

      {/* Costs + vehicle status */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card
          title="Costs — Last 6 Months"
          className="lg:col-span-2"
          actions={
            <Link href="/reports/operating-costs" className="text-xs font-medium text-indigo-600 hover:underline">
              Operating costs report →
            </Link>
          }
        >
          <CostsChart data={costsByMonth} />
        </Card>

        <Card title="Vehicle Status">
          {totalVehicles === 0 ? (
            <EmptyState title="No vehicles yet" hint="Add vehicles to see the status breakdown." />
          ) : (
            <>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
                {sortedStatusCounts.map((s) => (
                  <div
                    key={s.status}
                    className={STATUS_BAR_COLOR[s.status] ?? "bg-slate-400"}
                    style={{ width: `${(s._count._all / totalVehicles) * 100}%` }}
                    title={`${enumLabel(VEHICLE_STATUS, s.status)}: ${s._count._all}`}
                  />
                ))}
              </div>
              <ul className="mt-4 space-y-2.5">
                {sortedStatusCounts.map((s) => (
                  <li key={s.status} className="flex items-center justify-between">
                    <Link href={`/vehicles?status=${s.status}`}>
                      <StatusBadge def={VEHICLE_STATUS} value={s.status} />
                    </Link>
                    <span className="text-sm font-semibold text-slate-800">
                      {num(s._count._all)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400">
                {num(totalVehicles)} vehicles (excluding archived)
              </p>
            </>
          )}
        </Card>
      </div>

      {/* Reminders + issues */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card
          title="Service Reminders"
          actions={
            <Link href="/reminders" className="text-xs font-medium text-indigo-600 hover:underline">
              View all →
            </Link>
          }
        >
          {reminders.length === 0 ? (
            <EmptyState title="Nothing due" hint="No service reminders are due soon or overdue." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {reminders.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <Link
                      href={`/vehicles/${r.vehicle.id}`}
                      className="block truncate text-sm font-medium text-indigo-600 hover:underline"
                    >
                      {r.vehicle.name}
                    </Link>
                    <p className="truncate text-xs text-slate-500">{r.task.name}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-xs text-slate-500">
                      {r.nextDueDate
                        ? shortDate(r.nextDueDate)
                        : r.nextDueMeter != null
                          ? meter(r.nextDueMeter, r.vehicle.meterUnit)
                          : "—"}
                    </span>
                    <StatusBadge def={REMINDER_STATUS} value={r.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Open Issues"
          actions={
            <Link href="/issues" className="text-xs font-medium text-indigo-600 hover:underline">
              View all →
            </Link>
          }
        >
          {latestIssues.length === 0 ? (
            <EmptyState title="No open issues" hint="All reported issues are resolved." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {latestIssues.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <Link
                      href={`/issues/${i.id}`}
                      className="block truncate text-sm font-medium text-indigo-600 hover:underline"
                    >
                      #{i.number} {i.summary}
                    </Link>
                    <p className="truncate text-xs text-slate-500">
                      {i.vehicle.name} · {relative(i.reportedAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {i.priority !== "none" ? <StatusBadge def={PRIORITY} value={i.priority} /> : null}
                    <StatusBadge def={ISSUE_STATUS} value={i.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Work orders + inspections + comments */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card
          title="Incomplete Work Orders"
          actions={
            <Link href="/work-orders" className="text-xs font-medium text-indigo-600 hover:underline">
              View all →
            </Link>
          }
        >
          {sortedWoCounts.length === 0 ? (
            <EmptyState title="No incomplete work orders" />
          ) : (
            <ul className="space-y-2.5">
              {sortedWoCounts.map((s) => (
                <li key={s.status} className="flex items-center justify-between">
                  <Link href={`/work-orders?status=${s.status}`}>
                    <StatusBadge def={WORK_ORDER_STATUS} value={s.status} />
                  </Link>
                  <span className="text-sm font-semibold text-slate-800">{num(s._count._all)}</span>
                </li>
              ))}
              <li className="flex items-center justify-between border-t border-slate-100 pt-2.5">
                <span className="text-sm text-slate-500">Total</span>
                <span className="text-sm font-semibold text-slate-800">
                  {num(incompleteWorkOrders)}
                </span>
              </li>
            </ul>
          )}
        </Card>

        <Card
          title="Recent Inspections"
          actions={
            <Link href="/inspections" className="text-xs font-medium text-indigo-600 hover:underline">
              View all →
            </Link>
          }
        >
          {inspections.length === 0 ? (
            <EmptyState title="No inspections yet" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {inspections.map((s) => (
                <li key={s.id} className="py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/vehicles/${s.vehicle.id}`}
                      className="truncate text-sm font-medium text-indigo-600 hover:underline"
                    >
                      {s.vehicle.name}
                    </Link>
                    <span
                      className={`shrink-0 text-xs font-medium ${
                        s.failedCount > 0 ? "text-red-600" : "text-emerald-600"
                      }`}
                    >
                      {s.failedCount > 0
                        ? `${num(s.failedCount)} failed`
                        : s.submittedAt
                          ? "Passed"
                          : "In progress"}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {s.form.title} · {num(s._count.results)} items · {relative(s.submittedAt ?? s.startedAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Recent Comments">
          {comments.length === 0 ? (
            <EmptyState title="No comments yet" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {comments.map((c) => {
                const entity = COMMENT_ENTITY[c.entityType];
                const label = entity?.label ?? c.entityType;
                return (
                  <li key={c.id} className="py-2.5 first:pt-0 last:pb-0">
                    <p className="text-xs text-slate-500">
                      <span className="font-medium text-slate-700">{c.authorName}</span>
                      {" on "}
                      {entity?.href ? (
                        <Link href={entity.href(c.entityId)} className="text-indigo-600 hover:underline">
                          {label}
                        </Link>
                      ) : (
                        <span>{label}</span>
                      )}
                      {" · "}
                      {relative(c.createdAt)}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-sm text-slate-700">{c.body}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* Money hint row */}
      <p className="mt-6 text-center text-xs text-slate-400">
        Costs include fuel &amp; EV charging, service entries and other expenses ·{" "}
        {money(costsByMonth.reduce((acc, m) => acc + m.fuel + m.service + m.other, 0))} total over
        the last 6 months
      </p>
    </>
  );
}
