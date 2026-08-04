import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { DataTable, Td } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button, ButtonLink } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/FormField";
import { deriveRenewalStatus } from "@/app/(app)/renewals/status";

export const dynamic = "force-dynamic";

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const tab = first(sp.tab) || "all";
  const q = first(sp.q)?.trim() || "";

  const where: Prisma.ContactWhereInput = { archived: false };
  if (tab === "operators") where.isOperator = true;
  if (tab === "technicians") where.isTechnician = true;
  if (q) {
    where.OR = [
      { firstName: { contains: q } },
      { lastName: { contains: q } },
      { email: { contains: q } },
    ];
  }

  const contacts = await db.contact.findMany({
    where,
    include: {
      assignments: { where: { current: true }, include: { vehicle: true } },
      renewals: true,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const tabHref = (t: string) => `/contacts?tab=${t}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <div>
      <PageHeader
        title="Contacts"
        subtitle="Operators, technicians, and other fleet personnel"
        actions={<ButtonLink href="/contacts/new">+ New Contact</ButtonLink>}
      />

      <Tabs
        active={tab}
        tabs={[
          { key: "all", label: "All", href: tabHref("all") },
          { key: "operators", label: "Operators", href: tabHref("operators") },
          { key: "technicians", label: "Technicians", href: tabHref("technicians") },
        ]}
      />

      <form method="GET" action="/contacts" className="mb-4 flex items-end gap-3">
        <input type="hidden" name="tab" value={tab} />
        <div className="w-72">
          <TextInput name="q" placeholder="Search name or email…" defaultValue={q} />
        </div>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {contacts.length === 0 ? (
        <EmptyState
          title="No contacts found"
          hint="Try a different search, or add a new contact."
          action={<ButtonLink href="/contacts/new">+ New Contact</ButtonLink>}
        />
      ) : (
        <DataTable
          headers={["Name", "Email", "Phone", "Job Title", "Classifications", "Assigned Vehicle(s)", "Renewals Due"]}
        >
          {contacts.map((c) => {
            const renewalsDue = c.renewals.filter((r) => {
              const s = deriveRenewalStatus(r);
              return s === "due_soon" || s === "overdue";
            }).length;
            return (
              <tr key={c.id} className="hover:bg-slate-50/60">
                <Td>
                  <Link href={`/contacts/${c.id}`} className="font-medium text-indigo-600 hover:underline">
                    {c.firstName} {c.lastName}
                  </Link>
                </Td>
                <Td>{c.email ?? "—"}</Td>
                <Td className="whitespace-nowrap">{c.phone ?? "—"}</Td>
                <Td>{c.jobTitle ?? "—"}</Td>
                <Td>
                  <span className="flex flex-wrap gap-1">
                    {c.isOperator ? (
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">
                        Operator
                      </span>
                    ) : null}
                    {c.isTechnician ? (
                      <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-600/20">
                        Technician
                      </span>
                    ) : null}
                    {!c.isOperator && !c.isTechnician ? <span className="text-slate-400">—</span> : null}
                  </span>
                </Td>
                <Td>
                  {c.assignments.length > 0 ? (
                    <span className="flex flex-wrap gap-x-2">
                      {c.assignments.map((a) => (
                        <Link
                          key={a.id}
                          href={`/vehicles/${a.vehicle.id}`}
                          className="text-indigo-600 hover:underline"
                        >
                          {a.vehicle.name}
                        </Link>
                      ))}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </Td>
                <Td>
                  {renewalsDue > 0 ? (
                    <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                      {renewalsDue}
                    </span>
                  ) : (
                    <span className="text-slate-400">0</span>
                  )}
                </Td>
              </tr>
            );
          })}
        </DataTable>
      )}
    </div>
  );
}
