import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Tabs } from "@/components/ui/Tabs";
import { Card } from "@/components/ui/Card";
import { DataTable, Td } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Field, TextInput, Select, EnumSelect } from "@/components/ui/FormField";
import { VEHICLE_RENEWAL_TYPE, CONTACT_RENEWAL_TYPE, RENEWAL_STATUS } from "@/lib/enums";
import { shortDate, daysUntil } from "@/lib/format";
import { deriveRenewalStatus, type DerivedRenewalStatus } from "./status";
import {
  createVehicleRenewal,
  createContactRenewal,
  completeVehicleRenewal,
  completeContactRenewal,
} from "./actions";

export const dynamic = "force-dynamic";

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

const STATUS_ORDER: Record<DerivedRenewalStatus, number> = {
  overdue: 0,
  due_soon: 1,
  upcoming: 2,
  completed: 3,
};

function daysCell(due: Date, completed: boolean) {
  if (completed) return <span className="text-slate-400">—</span>;
  const d = daysUntil(due);
  if (d == null) return <span className="text-slate-400">—</span>;
  if (d < 0) return <span className="font-medium text-red-600">{-d} d overdue</span>;
  if (d === 0) return <span className="font-medium text-amber-600">due today</span>;
  return <span>in {d} d</span>;
}

export default async function RenewalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const tab = first(sp.tab) === "contacts" ? "contacts" : "vehicles";
  const error = first(sp.error);

  const [vehicleRenewals, contactRenewals, vehicles, contacts] = await Promise.all([
    db.vehicleRenewal.findMany({ include: { vehicle: true }, orderBy: { dueDate: "asc" } }),
    db.contactRenewal.findMany({ include: { contact: true }, orderBy: { dueDate: "asc" } }),
    db.vehicle.findMany({ where: { archived: false }, orderBy: { name: "asc" } }),
    db.contact.findMany({
      where: { archived: false },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
  ]);

  const vRows = vehicleRenewals
    .map((r) => ({ ...r, derived: deriveRenewalStatus(r) }))
    .sort((a, b) => STATUS_ORDER[a.derived] - STATUS_ORDER[b.derived]);
  const cRows = contactRenewals
    .map((r) => ({ ...r, derived: deriveRenewalStatus(r) }))
    .sort((a, b) => STATUS_ORDER[a.derived] - STATUS_ORDER[b.derived]);

  const all = [...vRows, ...cRows];
  const overdue = all.filter((r) => r.derived === "overdue").length;
  const dueSoon = all.filter((r) => r.derived === "due_soon").length;

  return (
    <div>
      <PageHeader
        title="Renewals"
        subtitle="Registrations, insurance, licenses, and certifications across the fleet"
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total tracked" value={all.length} />
        <StatCard label="Due soon" value={dueSoon} accent="text-amber-600" />
        <StatCard label="Overdue" value={overdue} accent="text-red-600" />
      </div>

      <Tabs
        active={tab}
        tabs={[
          {
            key: "vehicles",
            label: "Vehicle Renewals",
            href: "/renewals?tab=vehicles",
            count: vRows.length,
          },
          {
            key: "contacts",
            label: "Contact Renewals",
            href: "/renewals?tab=contacts",
            count: cRows.length,
          },
        ]}
      />

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {tab === "vehicles" ? (
        <div className="space-y-6">
          {vRows.length === 0 ? (
            <EmptyState
              title="No vehicle renewals"
              hint="Track registration, insurance, emission tests, and DOT inspections below."
            />
          ) : (
            <DataTable headers={["Type", "Name", "Vehicle", "Due Date", "Days", "Status", ""]}>
              {vRows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/60">
                  <Td>
                    <StatusBadge def={VEHICLE_RENEWAL_TYPE} value={r.type} />
                  </Td>
                  <Td>{r.name ?? "—"}</Td>
                  <Td>
                    <Link
                      href={`/vehicles/${r.vehicle.id}`}
                      className="font-medium text-indigo-600 hover:underline"
                    >
                      {r.vehicle.name}
                    </Link>
                  </Td>
                  <Td className="whitespace-nowrap">{shortDate(r.dueDate)}</Td>
                  <Td>{daysCell(r.dueDate, r.derived === "completed")}</Td>
                  <Td>
                    <StatusBadge def={RENEWAL_STATUS} value={r.derived} />
                  </Td>
                  <Td>
                    {r.derived !== "completed" ? (
                      <form action={completeVehicleRenewal.bind(null, r.id)}>
                        <Button type="submit" variant="secondary">
                          Mark complete
                        </Button>
                      </form>
                    ) : (
                      <span className="text-xs text-slate-400">
                        Completed {shortDate(r.completedAt)}
                      </span>
                    )}
                  </Td>
                </tr>
              ))}
            </DataTable>
          )}

          <Card title="+ New Vehicle Renewal">
            <form action={createVehicleRenewal} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Field label="Vehicle" required>
                <Select name="vehicleId" required defaultValue="">
                  <option value="" disabled>
                    Choose a vehicle…
                  </option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Type" required>
                <EnumSelect name="type" def={VEHICLE_RENEWAL_TYPE} defaultValue="registration" />
              </Field>
              <Field label="Name">
                <TextInput name="name" placeholder="Optional label" />
              </Field>
              <Field label="Due date" required>
                <TextInput name="dueDate" type="date" required />
              </Field>
              <Field label="Due-soon (days)">
                <TextInput name="dueSoonDays" type="number" min={0} defaultValue={30} />
              </Field>
              <div className="sm:col-span-2 lg:col-span-5">
                <Button type="submit">Add Vehicle Renewal</Button>
              </div>
            </form>
          </Card>
        </div>
      ) : (
        <div className="space-y-6">
          {cRows.length === 0 ? (
            <EmptyState
              title="No contact renewals"
              hint="Track licenses, certifications, medical exams, and training below."
            />
          ) : (
            <DataTable headers={["Type", "Name", "Contact", "Due Date", "Days", "Status", ""]}>
              {cRows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/60">
                  <Td>
                    <StatusBadge def={CONTACT_RENEWAL_TYPE} value={r.type} />
                  </Td>
                  <Td>{r.name ?? "—"}</Td>
                  <Td>
                    <Link
                      href={`/contacts/${r.contact.id}`}
                      className="font-medium text-indigo-600 hover:underline"
                    >
                      {r.contact.firstName} {r.contact.lastName}
                    </Link>
                  </Td>
                  <Td className="whitespace-nowrap">{shortDate(r.dueDate)}</Td>
                  <Td>{daysCell(r.dueDate, r.derived === "completed")}</Td>
                  <Td>
                    <StatusBadge def={RENEWAL_STATUS} value={r.derived} />
                  </Td>
                  <Td>
                    {r.derived !== "completed" ? (
                      <form action={completeContactRenewal.bind(null, r.id)}>
                        <Button type="submit" variant="secondary">
                          Mark complete
                        </Button>
                      </form>
                    ) : (
                      <span className="text-xs text-slate-400">
                        Completed {shortDate(r.completedAt)}
                      </span>
                    )}
                  </Td>
                </tr>
              ))}
            </DataTable>
          )}

          <Card title="+ New Contact Renewal">
            <form action={createContactRenewal} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Field label="Contact" required>
                <Select name="contactId" required defaultValue="">
                  <option value="" disabled>
                    Choose a contact…
                  </option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.firstName} {c.lastName}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Type" required>
                <EnumSelect name="type" def={CONTACT_RENEWAL_TYPE} defaultValue="license" />
              </Field>
              <Field label="Name">
                <TextInput name="name" placeholder="Optional label" />
              </Field>
              <Field label="Due date" required>
                <TextInput name="dueDate" type="date" required />
              </Field>
              <Field label="Due-soon (days)">
                <TextInput name="dueSoonDays" type="number" min={0} defaultValue={30} />
              </Field>
              <div className="sm:col-span-2 lg:col-span-5">
                <Button type="submit">Add Contact Renewal</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
