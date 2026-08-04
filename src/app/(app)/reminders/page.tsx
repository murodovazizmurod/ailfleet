import Link from "next/link";
import { differenceInDays } from "date-fns";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { REMINDER_STATUS } from "@/lib/enums";
import { meter, num, shortDate, vehicleTitle } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Tabs } from "@/components/ui/Tabs";
import { DataTable, Td } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { toggleSnooze } from "./actions";

export const dynamic = "force-dynamic";

type ReminderWithRels = Prisma.ServiceReminderGetPayload<{
  include: { vehicle: true; task: true };
}>;

// Live-derived display status — the stored status only matters for "snoozed".
function deriveStatus(r: ReminderWithRels, now: Date): string {
  if (r.status === "snoozed") return "snoozed";
  const meterNow = r.vehicle.currentMeter;

  const meterOverdue = r.nextDueMeter != null && meterNow >= r.nextDueMeter;
  const dateOverdue = r.nextDueDate != null && new Date(r.nextDueDate) < now;
  if (meterOverdue || dateOverdue) return "overdue";

  // Due-soon thresholds: 10% of the meter interval (fallback 250 units when
  // no interval is set), 14 days for dates.
  const meterThreshold = r.intervalMeter != null ? r.intervalMeter * 0.1 : 250;
  const meterSoon =
    r.nextDueMeter != null && meterNow >= r.nextDueMeter - meterThreshold;
  const dateSoon =
    r.nextDueDate != null && differenceInDays(new Date(r.nextDueDate), now) <= 14;
  if (meterSoon || dateSoon) return "due_soon";

  return "upcoming";
}

function intervalDescription(r: ReminderWithRels): string {
  const parts: string[] = [];
  if (r.intervalMeter != null) {
    parts.push(`${num(r.intervalMeter)} ${r.vehicle.meterUnit}`);
  }
  if (r.intervalDays != null) parts.push(`${num(r.intervalDays)} days`);
  return parts.length > 0 ? `every ${parts.join(" / ")}` : "—";
}

export default async function RemindersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const now = new Date();

  const [reminders, programs] = await Promise.all([
    db.serviceReminder.findMany({
      include: { vehicle: true, task: true },
      orderBy: [{ nextDueDate: "asc" }],
    }),
    db.serviceProgram.findMany({
      include: { _count: { select: { tasks: true, vehicles: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  const withDerived = reminders
    .map((r) => ({ r, derived: deriveStatus(r, now) }))
    .sort((a, b) => {
      const order: Record<string, number> = {
        overdue: 0,
        due_soon: 1,
        upcoming: 2,
        snoozed: 3,
      };
      return (order[a.derived] ?? 9) - (order[b.derived] ?? 9);
    });

  const countOf = (s: string) => withDerived.filter((x) => x.derived === s).length;

  const status =
    sp.status && REMINDER_STATUS[sp.status] ? sp.status : "all";
  const visible =
    status === "all" ? withDerived : withDerived.filter((x) => x.derived === status);

  const tabs = [
    { key: "all", label: "All", href: "/reminders", count: withDerived.length },
    { key: "overdue", label: "Overdue", href: "/reminders?status=overdue", count: countOf("overdue") },
    { key: "due_soon", label: "Due Soon", href: "/reminders?status=due_soon", count: countOf("due_soon") },
    { key: "upcoming", label: "OK", href: "/reminders?status=upcoming", count: countOf("upcoming") },
    { key: "snoozed", label: "Snoozed", href: "/reminders?status=snoozed", count: countOf("snoozed") },
  ];

  return (
    <div>
      <PageHeader
        title="Service Reminders"
        subtitle="Preventive maintenance schedule across the fleet"
        actions={<ButtonLink href="/reminders/new">+ New Reminder</ButtonLink>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Overdue"
          value={countOf("overdue")}
          accent="text-red-600"
          href="/reminders?status=overdue"
        />
        <StatCard
          label="Due Soon"
          value={countOf("due_soon")}
          accent="text-amber-600"
          href="/reminders?status=due_soon"
        />
        <StatCard
          label="OK"
          value={countOf("upcoming")}
          accent="text-emerald-600"
          href="/reminders?status=upcoming"
        />
        <StatCard
          label="Snoozed"
          value={countOf("snoozed")}
          href="/reminders?status=snoozed"
        />
      </div>

      <Tabs tabs={tabs} active={status} />

      {visible.length === 0 ? (
        <EmptyState
          title="No reminders here"
          hint="Create a reminder to start tracking preventive maintenance."
          action={<ButtonLink href="/reminders/new">+ New Reminder</ButtonLink>}
        />
      ) : (
        <DataTable
          headers={[
            "Vehicle",
            "Task",
            "Next Due",
            "Last Completed",
            "Interval",
            "Status",
            "",
          ]}
        >
          {visible.map(({ r, derived }) => (
            <tr key={r.id} className="hover:bg-slate-50">
              <Td>
                <Link
                  href={`/vehicles/${r.vehicleId}`}
                  className="text-indigo-600 hover:underline"
                >
                  {r.vehicle.name}
                </Link>
                <span className="ml-1.5 text-xs text-slate-400">
                  {vehicleTitle(r.vehicle)}
                </span>
              </Td>
              <Td className="font-medium text-slate-800">{r.task.name}</Td>
              <Td>
                {r.nextDueMeter != null ? (
                  <div>
                    {meter(r.nextDueMeter, r.vehicle.meterUnit)}
                    <span className="ml-1 text-xs text-slate-400">
                      (now {meter(r.vehicle.currentMeter, r.vehicle.meterUnit)})
                    </span>
                  </div>
                ) : null}
                {r.nextDueDate != null ? (
                  <div className="text-slate-500">{shortDate(r.nextDueDate)}</div>
                ) : null}
                {r.nextDueMeter == null && r.nextDueDate == null ? "—" : null}
              </Td>
              <Td>
                {r.lastCompletedAt ? (
                  <div>
                    {shortDate(r.lastCompletedAt)}
                    {r.lastCompletedMeter != null ? (
                      <span className="ml-1 text-xs text-slate-400">
                        @ {meter(r.lastCompletedMeter, r.vehicle.meterUnit)}
                      </span>
                    ) : null}
                  </div>
                ) : (
                  "—"
                )}
              </Td>
              <Td className="whitespace-nowrap">{intervalDescription(r)}</Td>
              <Td>
                <StatusBadge def={REMINDER_STATUS} value={derived} />
              </Td>
              <Td>
                <div className="flex items-center justify-end gap-2">
                  <Link
                    href={`/work-orders/new?vehicleId=${r.vehicleId}&taskId=${r.taskId}`}
                    className="text-xs font-medium text-indigo-600 hover:underline"
                  >
                    Create work order
                  </Link>
                  <form action={toggleSnooze}>
                    <input type="hidden" name="id" value={r.id} />
                    <input
                      type="hidden"
                      name="snooze"
                      value={derived === "snoozed" ? "false" : "true"}
                    />
                    <Button type="submit" variant="ghost">
                      {derived === "snoozed" ? "Unsnooze" : "Snooze"}
                    </Button>
                  </form>
                </div>
              </Td>
            </tr>
          ))}
        </DataTable>
      )}

      <div className="mt-6">
        <Card title="Service Programs">
          {programs.length === 0 ? (
            <p className="py-1 text-sm text-slate-400">No service programs defined.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {programs.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2.5">
                  <span className="text-sm font-medium text-slate-800">{p.name}</span>
                  <span className="text-sm text-slate-500">
                    {p._count.tasks} task{p._count.tasks === 1 ? "" : "s"} ·{" "}
                    {p._count.vehicles} vehicle{p._count.vehicles === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
