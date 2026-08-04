import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Tabs } from "@/components/ui/Tabs";
import { DataTable, Td } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { dateTime, vehicleTitle } from "@/lib/format";

export const dynamic = "force-dynamic";

function formatDuration(sec: number | null): string {
  if (sec == null) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default async function InspectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const tab = sp.tab === "forms" ? "forms" : "submissions";

  const [submissions, forms] = await Promise.all([
    db.inspectionSubmission.findMany({
      include: {
        form: true,
        vehicle: true,
        submittedBy: true,
      },
      orderBy: { startedAt: "desc" },
    }),
    db.inspectionForm.findMany({
      where: { archived: false },
      include: { _count: { select: { items: true, submissions: true } } },
      orderBy: { title: "asc" },
    }),
  ]);

  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const last7 = submissions.filter((s) => s.submittedAt && s.submittedAt >= weekAgo).length;
  const withFailures = submissions.filter((s) => s.failedCount > 0).length;
  const failureRate =
    submissions.length > 0 ? Math.round((withFailures / submissions.length) * 100) : 0;
  const failedItemsTotal = submissions.reduce((sum, s) => sum + s.failedCount, 0);

  return (
    <div>
      <PageHeader
        title="Inspections"
        subtitle="Digital vehicle inspection forms and submissions"
        actions={
          <>
            <ButtonLink href="/inspections/forms/new" variant="secondary">
              + New Form
            </ButtonLink>
            <ButtonLink href="/inspections/start">Start Inspection</ButtonLink>
          </>
        }
      />

      <Tabs
        tabs={[
          {
            key: "submissions",
            label: "Submissions",
            href: "/inspections",
            count: submissions.length,
          },
          { key: "forms", label: "Forms", href: "/inspections?tab=forms", count: forms.length },
        ]}
        active={tab}
      />

      {tab === "submissions" ? (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <StatCard label="Submissions (Last 7 Days)" value={last7} />
            <StatCard
              label="Failure Rate"
              value={`${failureRate}%`}
              hint="Submissions with at least one failed item"
              accent={failureRate > 25 ? "text-red-600" : "text-slate-900"}
            />
            <StatCard
              label="Failed Items Total"
              value={failedItemsTotal}
              accent={failedItemsTotal > 0 ? "text-amber-600" : "text-slate-900"}
            />
          </div>

          {submissions.length === 0 ? (
            <EmptyState
              title="No inspection submissions yet"
              hint="Start an inspection to record vehicle condition and catch defects early."
              action={<ButtonLink href="/inspections/start">Start Inspection</ButtonLink>}
            />
          ) : (
            <DataTable
              headers={["Form", "Vehicle", "Submitted By", "Submitted At", "Duration", "Failed", ""]}
            >
              {submissions.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <Td>
                    <Link
                      href={`/inspections/submissions/${s.id}`}
                      className="font-medium text-indigo-600 hover:underline"
                    >
                      {s.form.title}
                    </Link>
                  </Td>
                  <Td>
                    <Link
                      href={`/vehicles/${s.vehicleId}`}
                      className="text-indigo-600 hover:underline"
                    >
                      {s.vehicle.name}
                    </Link>
                    <span className="block text-xs text-slate-400">
                      {vehicleTitle(s.vehicle)}
                    </span>
                  </Td>
                  <Td>
                    {s.submittedBy
                      ? `${s.submittedBy.firstName} ${s.submittedBy.lastName}`
                      : "—"}
                  </Td>
                  <Td>{dateTime(s.submittedAt)}</Td>
                  <Td className="tabular-nums">{formatDuration(s.durationSec)}</Td>
                  <Td>
                    {s.failedCount > 0 ? (
                      <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
                        {s.failedCount} failed
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                        Pass
                      </span>
                    )}
                  </Td>
                  <Td>
                    <Link
                      href={`/inspections/submissions/${s.id}`}
                      className="text-indigo-600 hover:underline"
                    >
                      View
                    </Link>
                  </Td>
                </tr>
              ))}
            </DataTable>
          )}
        </>
      ) : (
        <>
          {forms.length === 0 ? (
            <EmptyState
              title="No inspection forms"
              hint="Build a form once, then submit it against any vehicle."
              action={<ButtonLink href="/inspections/forms/new">+ New Form</ButtonLink>}
            />
          ) : (
            <DataTable headers={["Form", "Items", "Submissions", ""]}>
              {forms.map((f) => (
                <tr key={f.id} className="hover:bg-slate-50">
                  <Td>
                    <Link
                      href={`/inspections/forms/${f.id}`}
                      className="font-medium text-indigo-600 hover:underline"
                    >
                      {f.title}
                    </Link>
                    {f.description ? (
                      <span className="block text-xs text-slate-400">{f.description}</span>
                    ) : null}
                  </Td>
                  <Td>{f._count.items}</Td>
                  <Td>{f._count.submissions}</Td>
                  <Td>
                    <Link
                      href={`/inspections/start?formId=${f.id}`}
                      className="text-indigo-600 hover:underline"
                    >
                      Start
                    </Link>
                  </Td>
                </tr>
              ))}
            </DataTable>
          )}
        </>
      )}
    </div>
  );
}
