import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, FieldRow } from "@/components/ui/Card";
import { DataTable, Td } from "@/components/ui/DataTable";
import { Button, ButtonLink } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Field, TextInput, EnumSelect } from "@/components/ui/FormField";
import { CONTACT_RENEWAL_TYPE, RENEWAL_STATUS } from "@/lib/enums";
import { shortDate, daysUntil, vehicleTitle } from "@/lib/format";
import { deriveRenewalStatus } from "@/app/(app)/renewals/status";
import { addContactRenewal } from "../actions";

export const dynamic = "force-dynamic";

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function ContactDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const error = first(sp.error);

  const contact = await db.contact.findUnique({
    where: { id },
    include: {
      assignments: {
        include: { vehicle: true },
        orderBy: { startedAt: "desc" },
      },
      renewals: { orderBy: { dueDate: "asc" } },
    },
  });
  if (!contact) notFound();

  const currentAssignments = contact.assignments.filter((a) => a.current);
  const renewalAction = addContactRenewal.bind(null, contact.id);

  return (
    <div>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {contact.firstName} {contact.lastName}
            <span className="flex gap-1">
              {contact.isOperator ? (
                <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">
                  Operator
                </span>
              ) : null}
              {contact.isTechnician ? (
                <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-600/20">
                  Technician
                </span>
              ) : null}
            </span>
          </span>
        }
        subtitle={contact.jobTitle ?? undefined}
        actions={
          <ButtonLink href={`/contacts/${contact.id}/edit`} variant="secondary">
            Edit
          </ButtonLink>
        }
      />

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Current Assignments">
            {currentAssignments.length === 0 ? (
              <p className="text-sm text-slate-500">Not currently assigned to a vehicle.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {currentAssignments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-4 py-2">
                    <div>
                      <Link
                        href={`/vehicles/${a.vehicle.id}`}
                        className="text-sm font-medium text-indigo-600 hover:underline"
                      >
                        {a.vehicle.name}
                      </Link>
                      <p className="text-xs text-slate-400">{vehicleTitle(a.vehicle)}</p>
                    </div>
                    <span className="text-xs text-slate-400">Since {shortDate(a.startedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
            {contact.assignments.length > currentAssignments.length ? (
              <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-400">
                {contact.assignments.length - currentAssignments.length} past assignment(s) on record
              </p>
            ) : null}
          </Card>

          <Card title="Renewals">
            {contact.renewals.length === 0 ? (
              <p className="text-sm text-slate-500">No renewals tracked for this contact.</p>
            ) : (
              <div className="-m-4">
                <DataTable headers={["Type", "Name", "Due", "Days", "Status"]}>
                  {contact.renewals.map((r) => {
                    const d = daysUntil(r.dueDate);
                    return (
                      <tr key={r.id} className="hover:bg-slate-50/60">
                        <Td>
                          <StatusBadge def={CONTACT_RENEWAL_TYPE} value={r.type} />
                        </Td>
                        <Td>{r.name ?? "—"}</Td>
                        <Td className="whitespace-nowrap">{shortDate(r.dueDate)}</Td>
                        <Td className={d != null && d < 0 && !r.completedAt ? "text-red-600" : ""}>
                          {r.completedAt
                            ? "—"
                            : d != null
                              ? d < 0
                                ? `${-d} d overdue`
                                : `in ${d} d`
                              : "—"}
                        </Td>
                        <Td>
                          <StatusBadge def={RENEWAL_STATUS} value={deriveRenewalStatus(r)} />
                        </Td>
                      </tr>
                    );
                  })}
                </DataTable>
              </div>
            )}
          </Card>

          <Card title="Add Renewal">
            <form action={renewalAction} className="grid gap-4 sm:grid-cols-2">
              <Field label="Type" required>
                <EnumSelect name="type" def={CONTACT_RENEWAL_TYPE} defaultValue="license" />
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
              <div className="sm:col-span-2">
                <Button type="submit">Add Renewal</Button>
              </div>
            </form>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Details">
            <dl className="divide-y divide-slate-50">
              <FieldRow label="Email" value={contact.email ?? "—"} />
              <FieldRow label="Phone" value={contact.phone ?? "—"} />
              <FieldRow label="Job title" value={contact.jobTitle ?? "—"} />
              <FieldRow label="Employee #" value={contact.employeeNumber ?? "—"} />
              <FieldRow label="Hire date" value={shortDate(contact.hireDate)} />
              <FieldRow label="Address" value={contact.address ?? "—"} />
            </dl>
          </Card>

          <Card title="License">
            <dl className="divide-y divide-slate-50">
              <FieldRow label="Number" value={contact.licenseNumber ?? "—"} />
              <FieldRow label="Class" value={contact.licenseClass ?? "—"} />
              <FieldRow label="State" value={contact.licenseState ?? "—"} />
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
