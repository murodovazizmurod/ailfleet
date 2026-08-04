import Link from "next/link";
import { notFound } from "next/navigation";
import type { Prisma, Vehicle } from "@prisma/client";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { Card, FieldRow } from "@/components/ui/Card";
import { DataTable, Td } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button, ButtonLink } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Field, TextInput, Select, EnumSelect } from "@/components/ui/FormField";
import {
  VEHICLE_STATUS,
  ASSET_TYPE,
  OWNERSHIP,
  FUEL_TYPE,
  ISSUE_STATUS,
  PRIORITY,
  REMINDER_STATUS,
  WORK_ORDER_STATUS,
  EXPENSE_TYPE,
  VEHICLE_RENEWAL_TYPE,
  RENEWAL_STATUS,
  enumLabel,
} from "@/lib/enums";
import { money, num, meter, shortDate, dateTime, vehicleTitle, daysUntil } from "@/lib/format";
import { deriveRenewalStatus } from "@/app/(app)/renewals/status";
import {
  addMeterEntry,
  assignOperator,
  addExpense,
  addVehicleRenewal,
} from "../actions";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "service", label: "Service History" },
  { key: "workorders", label: "Work Orders" },
  { key: "fuel", label: "Fuel & Energy" },
  { key: "meters", label: "Meters" },
  { key: "assignments", label: "Assignments" },
  { key: "expenses", label: "Expenses" },
  { key: "renewals", label: "Renewals" },
];

type VehicleWithAssignments = Prisma.VehicleGetPayload<{
  include: { group: true; assignments: { include: { contact: true } } };
}>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function VehicleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const tabParam = first(sp.tab) || "overview";
  const tab = TABS.some((t) => t.key === tabParam) ? tabParam : "overview";
  const error = first(sp.error);

  const vehicle = await db.vehicle.findUnique({
    where: { id },
    include: {
      group: true,
      assignments: { include: { contact: true }, orderBy: { startedAt: "desc" } },
    },
  });
  if (!vehicle) notFound();

  return (
    <div>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {vehicle.name}
            <StatusBadge def={VEHICLE_STATUS} value={vehicle.status} />
          </span>
        }
        subtitle={
          <>
            {vehicleTitle(vehicle)}
            {vehicle.vin ? <> • VIN {vehicle.vin}</> : null}
          </>
        }
        actions={
          <>
            <ButtonLink href={`/vehicles/${vehicle.id}/edit`} variant="secondary">
              Edit
            </ButtonLink>
            <ButtonLink href={`/issues/new?vehicleId=${vehicle.id}`} variant="secondary">
              + Add Issue
            </ButtonLink>
            <ButtonLink href={`/fuel/new?vehicleId=${vehicle.id}`}>+ Log Fuel</ButtonLink>
          </>
        }
      />

      <Tabs
        active={tab}
        tabs={TABS.map((t) => ({
          key: t.key,
          label: t.label,
          href: `/vehicles/${vehicle.id}?tab=${t.key}`,
        }))}
      />

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {tab === "overview" ? <OverviewTab vehicle={vehicle} /> : null}
      {tab === "service" ? <ServiceTab vehicle={vehicle} /> : null}
      {tab === "workorders" ? <WorkOrdersTab vehicle={vehicle} /> : null}
      {tab === "fuel" ? <FuelTab vehicle={vehicle} /> : null}
      {tab === "meters" ? <MetersTab vehicle={vehicle} /> : null}
      {tab === "assignments" ? <AssignmentsTab vehicle={vehicle} /> : null}
      {tab === "expenses" ? <ExpensesTab vehicle={vehicle} /> : null}
      {tab === "renewals" ? <RenewalsTab vehicle={vehicle} /> : null}
    </div>
  );
}

// ── Overview ─────────────────────────────────────────────────────

async function OverviewTab({ vehicle }: { vehicle: VehicleWithAssignments }) {
  const [openIssues, reminders, renewals, fuelAgg, chargeAgg, serviceAgg, expenseAgg] =
    await Promise.all([
      db.issue.findMany({
        where: { vehicleId: vehicle.id, status: { in: ["open", "overdue"] } },
        orderBy: { reportedAt: "desc" },
        take: 8,
      }),
      db.serviceReminder.findMany({
        where: { vehicleId: vehicle.id },
        include: { task: true },
        orderBy: { nextDueDate: "asc" },
      }),
      db.vehicleRenewal.findMany({
        where: { vehicleId: vehicle.id },
        orderBy: { dueDate: "asc" },
      }),
      db.fuelEntry.aggregate({ where: { vehicleId: vehicle.id }, _sum: { total: true } }),
      db.chargingEntry.aggregate({ where: { vehicleId: vehicle.id }, _sum: { cost: true } }),
      db.serviceEntry.aggregate({ where: { vehicleId: vehicle.id }, _sum: { total: true } }),
      db.expenseEntry.aggregate({ where: { vehicleId: vehicle.id }, _sum: { amount: true } }),
    ]);

  const fuelTotal = (fuelAgg._sum.total ?? 0) + (chargeAgg._sum.cost ?? 0);
  const serviceTotal = serviceAgg._sum.total ?? 0;
  const grandTotal = fuelTotal + serviceTotal + (expenseAgg._sum.amount ?? 0);
  const costPerMeter = vehicle.currentMeter > 0 ? grandTotal / vehicle.currentMeter : null;

  const current = vehicle.assignments.find((a) => a.current);

  const lastLocation = await db.locationEntry.findFirst({
    where: { vehicleId: vehicle.id },
    orderBy: { date: "desc" },
  });
  let telemetry: { engineState?: string | null; fuelPercent?: number | null } = {};
  try {
    telemetry = vehicle.customFields ? (JSON.parse(vehicle.customFields).telemetry ?? {}) : {};
  } catch {
    telemetry = {};
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card title="Details">
          <dl className="divide-y divide-slate-50">
            <FieldRow label="Type" value={enumLabel(ASSET_TYPE, vehicle.assetType)} />
            <FieldRow label="VIN" value={vehicle.vin ?? "—"} />
            <FieldRow label="License plate" value={vehicle.licensePlate ?? "—"} />
            <FieldRow label="Year / Make / Model" value={vehicleTitle(vehicle)} />
            <FieldRow label="Group" value={vehicle.group?.name ?? "—"} />
            <FieldRow label="Ownership" value={enumLabel(OWNERSHIP, vehicle.ownership)} />
            <FieldRow label="Fuel type" value={enumLabel(FUEL_TYPE, vehicle.fuelType)} />
            <FieldRow label="Current meter" value={meter(vehicle.currentMeter, vehicle.meterUnit)} />
            <FieldRow label="Purchase date" value={shortDate(vehicle.purchaseDate)} />
            <FieldRow label="Purchase price" value={money(vehicle.purchasePrice)} />
          </dl>
        </Card>

        <Card
          title="Open Issues"
          actions={
            <Link
              href={`/issues/new?vehicleId=${vehicle.id}`}
              className="text-sm font-medium text-indigo-600 hover:underline"
            >
              + Add
            </Link>
          }
        >
          {openIssues.length === 0 ? (
            <p className="text-sm text-slate-500">No open issues. Nice and healthy.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {openIssues.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-4 py-2">
                  <div className="min-w-0">
                    <Link href={`/issues/${i.id}`} className="text-sm font-medium text-indigo-600 hover:underline">
                      #{i.number} {i.summary}
                    </Link>
                    <p className="text-xs text-slate-400">Reported {shortDate(i.reportedAt)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge def={PRIORITY} value={i.priority} />
                    <StatusBadge def={ISSUE_STATUS} value={i.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Service Reminders">
          {reminders.length === 0 ? (
            <p className="text-sm text-slate-500">No service reminders configured.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {reminders.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-4 py-2">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{r.task.name}</p>
                    <p className="text-xs text-slate-400">
                      Due {r.nextDueDate ? shortDate(r.nextDueDate) : "—"}
                      {r.nextDueMeter != null ? ` • ${meter(r.nextDueMeter, vehicle.meterUnit)}` : ""}
                    </p>
                  </div>
                  <StatusBadge def={REMINDER_STATUS} value={r.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="space-y-4">
        {lastLocation ? (
          <Card title="Last Location">
            <p className="text-sm text-slate-700">{lastLocation.address ?? `${lastLocation.latitude.toFixed(4)}, ${lastLocation.longitude.toFixed(4)}`}</p>
            <dl className="mt-2 divide-y divide-slate-50">
              {lastLocation.speedMph != null ? (
                <FieldRow label="Speed" value={`${Math.round(lastLocation.speedMph)} mph`} />
              ) : null}
              {telemetry.engineState ? (
                <FieldRow label="Engine" value={telemetry.engineState} />
              ) : null}
              {telemetry.fuelPercent != null ? (
                <FieldRow label="Fuel level" value={`${telemetry.fuelPercent}%`} />
              ) : null}
              <FieldRow label="Updated" value={shortDate(lastLocation.date)} />
            </dl>
            <p className="mt-3 border-t border-slate-100 pt-3 text-xs">
              <Link href={`/map?focus=${vehicle.id}`} className="text-indigo-600 hover:underline">
                Show on live map →
              </Link>
            </p>
          </Card>
        ) : null}

        <Card title="Assignment">
          {current ? (
            <div>
              <Link
                href={`/contacts/${current.contact.id}`}
                className="text-sm font-medium text-indigo-600 hover:underline"
              >
                {current.contact.firstName} {current.contact.lastName}
              </Link>
              <p className="mt-1 text-xs text-slate-400">Since {shortDate(current.startedAt)}</p>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No current operator.</p>
          )}
          <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-400">
            {vehicle.assignments.length} assignment{vehicle.assignments.length === 1 ? "" : "s"} on
            record •{" "}
            <Link href={`/vehicles/${vehicle.id}?tab=assignments`} className="text-indigo-600 hover:underline">
              History
            </Link>
          </p>
        </Card>

        <Card title="Quick Stats">
          <dl className="divide-y divide-slate-50">
            <FieldRow label="Total fuel cost" value={money(fuelTotal)} />
            <FieldRow label="Total service cost" value={money(serviceTotal)} />
            <FieldRow
              label={`Cost per ${vehicle.meterUnit}`}
              value={costPerMeter != null ? money(costPerMeter) : "—"}
            />
          </dl>
        </Card>

        <Card title="Renewals">
          {renewals.length === 0 ? (
            <p className="text-sm text-slate-500">No renewals tracked.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {renewals.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {r.name ?? enumLabel(VEHICLE_RENEWAL_TYPE, r.type)}
                    </p>
                    <p className="text-xs text-slate-400">Due {shortDate(r.dueDate)}</p>
                  </div>
                  <StatusBadge def={RENEWAL_STATUS} value={deriveRenewalStatus(r)} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

// ── Service history ──────────────────────────────────────────────

async function ServiceTab({ vehicle }: { vehicle: Vehicle }) {
  const entries = await db.serviceEntry.findMany({
    where: { vehicleId: vehicle.id },
    include: { vendor: true, lines: { include: { task: true } } },
    orderBy: { date: "desc" },
  });

  if (entries.length === 0) {
    return <EmptyState title="No service history" hint="Service entries logged for this vehicle will appear here." />;
  }

  return (
    <DataTable headers={["Date", "Tasks", "Vendor", "Meter", "Total"]}>
      {entries.map((e) => (
        <tr key={e.id} className="hover:bg-slate-50/60">
          <Td className="whitespace-nowrap">{shortDate(e.date)}</Td>
          <Td>
            {e.lines.length > 0
              ? e.lines.map((l) => l.task?.name ?? l.description ?? "Line item").join(", ")
              : (e.notes ?? "—")}
          </Td>
          <Td>{e.vendor?.name ?? "—"}</Td>
          <Td>{meter(e.meter, vehicle.meterUnit)}</Td>
          <Td className="font-medium">{money(e.total)}</Td>
        </tr>
      ))}
    </DataTable>
  );
}

// ── Work orders ──────────────────────────────────────────────────

async function WorkOrdersTab({ vehicle }: { vehicle: Vehicle }) {
  const workOrders = await db.workOrder.findMany({
    where: { vehicleId: vehicle.id },
    orderBy: { issuedAt: "desc" },
  });

  if (workOrders.length === 0) {
    return <EmptyState title="No work orders" hint="Work orders for this vehicle will appear here." />;
  }

  return (
    <DataTable headers={["Number", "Status", "Priority", "Issued", "Total"]}>
      {workOrders.map((wo) => (
        <tr key={wo.id} className="hover:bg-slate-50/60">
          <Td>
            <Link href={`/work-orders/${wo.id}`} className="font-medium text-indigo-600 hover:underline">
              WO-{wo.number}
            </Link>
          </Td>
          <Td>
            <StatusBadge def={WORK_ORDER_STATUS} value={wo.status} />
          </Td>
          <Td>
            <StatusBadge def={PRIORITY} value={wo.priority} />
          </Td>
          <Td className="whitespace-nowrap">{shortDate(wo.issuedAt)}</Td>
          <Td className="font-medium">{money(wo.total)}</Td>
        </tr>
      ))}
    </DataTable>
  );
}

// ── Fuel & energy ────────────────────────────────────────────────

async function FuelTab({ vehicle }: { vehicle: Vehicle }) {
  const [fuelEntries, chargingEntries] = await Promise.all([
    db.fuelEntry.findMany({ where: { vehicleId: vehicle.id }, orderBy: { date: "desc" } }),
    db.chargingEntry.findMany({ where: { vehicleId: vehicle.id }, orderBy: { date: "desc" } }),
  ]);

  if (fuelEntries.length === 0 && chargingEntries.length === 0) {
    return (
      <EmptyState
        title="No fuel or charging entries"
        hint="Log fill-ups and charging sessions to track economy and cost."
        action={<ButtonLink href={`/fuel/new?vehicleId=${vehicle.id}`}>+ Log Fuel</ButtonLink>}
      />
    );
  }

  return (
    <div className="space-y-6">
      {fuelEntries.length > 0 ? (
        <DataTable headers={["Date", "Meter", "Volume", "Price / Unit", "Total", "Economy"]}>
          {fuelEntries.map((f) => (
            <tr key={f.id} className="hover:bg-slate-50/60">
              <Td className="whitespace-nowrap">{shortDate(f.date)}</Td>
              <Td>{meter(f.meter, vehicle.meterUnit)}</Td>
              <Td>{num(f.volume, 2)} gal</Td>
              <Td>{money(f.pricePerUnit)}</Td>
              <Td className="font-medium">{money(f.total)}</Td>
              <Td>{f.fuelEconomy != null ? `${num(f.fuelEconomy, 1)} mpg` : "—"}</Td>
            </tr>
          ))}
        </DataTable>
      ) : null}

      {chargingEntries.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Charging Sessions</h3>
          <DataTable headers={["Date", "Meter", "Energy", "Duration", "Cost", "Location"]}>
            {chargingEntries.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50/60">
                <Td className="whitespace-nowrap">{shortDate(c.date)}</Td>
                <Td>{meter(c.meter, vehicle.meterUnit)}</Td>
                <Td>{num(c.energyKwh, 1)} kWh</Td>
                <Td>{c.durationMin != null ? `${c.durationMin} min` : "—"}</Td>
                <Td className="font-medium">{money(c.cost)}</Td>
                <Td>{c.location ?? "—"}</Td>
              </tr>
            ))}
          </DataTable>
        </div>
      ) : null}
    </div>
  );
}

// ── Meters ───────────────────────────────────────────────────────

async function MetersTab({ vehicle }: { vehicle: Vehicle }) {
  const entries = await db.meterEntry.findMany({
    where: { vehicleId: vehicle.id },
    orderBy: { date: "desc" },
  });
  const action = addMeterEntry.bind(null, vehicle.id);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        {entries.length === 0 ? (
          <EmptyState title="No meter entries" hint="Add a reading to start the meter history." />
        ) : (
          <DataTable headers={["Date", "Value", "Source", ""]}>
            {entries.map((m) => (
              <tr key={m.id} className={m.void ? "opacity-60" : "hover:bg-slate-50/60"}>
                <Td className="whitespace-nowrap">{dateTime(m.date)}</Td>
                <Td className="font-medium">{meter(m.value, vehicle.meterUnit)}</Td>
                <Td className="capitalize">{m.source.replace(/_/g, " ")}</Td>
                <Td>
                  {m.void ? (
                    <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
                      Void
                    </span>
                  ) : null}
                </Td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>

      <Card title="Add Meter Entry">
        <form action={action} className="space-y-4">
          <Field label="Value" required hint={`Current: ${meter(vehicle.currentMeter, vehicle.meterUnit)} — new readings must not go backwards.`}>
            <TextInput name="value" type="number" step="any" min={0} required />
          </Field>
          <Field label="Date">
            <TextInput name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
          </Field>
          <Button type="submit">Add Entry</Button>
        </form>
      </Card>
    </div>
  );
}

// ── Assignments ──────────────────────────────────────────────────

async function AssignmentsTab({ vehicle }: { vehicle: VehicleWithAssignments }) {
  const operators = await db.contact.findMany({
    where: { isOperator: true, archived: false },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  const action = assignOperator.bind(null, vehicle.id);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        {vehicle.assignments.length === 0 ? (
          <EmptyState title="No assignment history" hint="Assign an operator to this vehicle to get started." />
        ) : (
          <DataTable headers={["Operator", "Started", "Ended", "Status"]}>
            {vehicle.assignments.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50/60">
                <Td>
                  <Link href={`/contacts/${a.contact.id}`} className="font-medium text-indigo-600 hover:underline">
                    {a.contact.firstName} {a.contact.lastName}
                  </Link>
                </Td>
                <Td className="whitespace-nowrap">{shortDate(a.startedAt)}</Td>
                <Td className="whitespace-nowrap">{a.endedAt ? shortDate(a.endedAt) : "—"}</Td>
                <Td>
                  {a.current ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                      Current
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">Ended</span>
                  )}
                </Td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>

      <Card title="Assign Operator">
        <form action={action} className="space-y-4">
          <Field label="Operator" required hint="Assigning ends the current assignment — one operator at a time.">
            <Select name="contactId" required defaultValue="">
              <option value="" disabled>
                Choose an operator…
              </option>
              {operators.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit">Assign (starts now)</Button>
        </form>
      </Card>
    </div>
  );
}

// ── Expenses ─────────────────────────────────────────────────────

async function ExpensesTab({ vehicle }: { vehicle: Vehicle }) {
  const [expenses, vendors] = await Promise.all([
    db.expenseEntry.findMany({
      where: { vehicleId: vehicle.id },
      include: { vendor: true },
      orderBy: { date: "desc" },
    }),
    db.vendor.findMany({ where: { archived: false }, orderBy: { name: "asc" } }),
  ]);
  const action = addExpense.bind(null, vehicle.id);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        {expenses.length === 0 ? (
          <EmptyState title="No expenses" hint="Track insurance, registration, tolls and other costs here." />
        ) : (
          <DataTable headers={["Date", "Type", "Vendor", "Notes", "Amount"]}>
            {expenses.map((e) => (
              <tr key={e.id} className="hover:bg-slate-50/60">
                <Td className="whitespace-nowrap">{shortDate(e.date)}</Td>
                <Td>
                  <StatusBadge def={EXPENSE_TYPE} value={e.type} />
                </Td>
                <Td>{e.vendor?.name ?? "—"}</Td>
                <Td className="max-w-xs truncate">{e.notes ?? "—"}</Td>
                <Td className="font-medium">{money(e.amount)}</Td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>

      <Card title="Add Expense">
        <form action={action} className="space-y-4">
          <Field label="Type" required>
            <EnumSelect name="type" def={EXPENSE_TYPE} defaultValue="other" />
          </Field>
          <Field label="Amount" required>
            <TextInput name="amount" type="number" step="any" min={0} required />
          </Field>
          <Field label="Date">
            <TextInput name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
          </Field>
          <Field label="Vendor">
            <Select name="vendorId" defaultValue="">
              <option value="">—</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Notes">
            <TextInput name="notes" placeholder="Optional" />
          </Field>
          <Button type="submit">Add Expense</Button>
        </form>
      </Card>
    </div>
  );
}

// ── Renewals ─────────────────────────────────────────────────────

async function RenewalsTab({ vehicle }: { vehicle: Vehicle }) {
  const renewals = await db.vehicleRenewal.findMany({
    where: { vehicleId: vehicle.id },
    orderBy: { dueDate: "asc" },
  });
  const action = addVehicleRenewal.bind(null, vehicle.id);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        {renewals.length === 0 ? (
          <EmptyState title="No renewals" hint="Track registration, insurance, and inspection due dates here." />
        ) : (
          <DataTable headers={["Type", "Name", "Due", "Days", "Status"]}>
            {renewals.map((r) => {
              const d = daysUntil(r.dueDate);
              return (
                <tr key={r.id} className="hover:bg-slate-50/60">
                  <Td>
                    <StatusBadge def={VEHICLE_RENEWAL_TYPE} value={r.type} />
                  </Td>
                  <Td>{r.name ?? "—"}</Td>
                  <Td className="whitespace-nowrap">{shortDate(r.dueDate)}</Td>
                  <Td className={d != null && d < 0 ? "text-red-600" : ""}>
                    {r.completedAt ? "—" : d != null ? (d < 0 ? `${-d} d overdue` : `in ${d} d`) : "—"}
                  </Td>
                  <Td>
                    <StatusBadge def={RENEWAL_STATUS} value={deriveRenewalStatus(r)} />
                  </Td>
                </tr>
              );
            })}
          </DataTable>
        )}
      </div>

      <Card title="Add Renewal">
        <form action={action} className="space-y-4">
          <Field label="Type" required>
            <EnumSelect name="type" def={VEHICLE_RENEWAL_TYPE} defaultValue="registration" />
          </Field>
          <Field label="Name">
            <TextInput name="name" placeholder="Optional label" />
          </Field>
          <Field label="Due date" required>
            <TextInput name="dueDate" type="date" required />
          </Field>
          <Field label="Due-soon threshold (days)">
            <TextInput name="dueSoonDays" type="number" min={0} defaultValue={30} />
          </Field>
          <Button type="submit">Add Renewal</Button>
        </form>
      </Card>
    </div>
  );
}
