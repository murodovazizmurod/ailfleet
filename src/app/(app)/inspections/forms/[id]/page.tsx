import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, FieldRow } from "@/components/ui/Card";
import { DataTable, Td } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { INSPECTION_ITEM_TYPE } from "@/lib/enums";
import { dateTime, shortDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function InspectionFormDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const form = await db.inspectionForm.findUnique({
    where: { id },
    include: {
      items: { orderBy: { position: "asc" } },
      submissions: {
        include: { vehicle: true, submittedBy: true },
        orderBy: { startedAt: "desc" },
        take: 25,
      },
    },
  });
  if (!form) notFound();

  return (
    <div>
      <PageHeader
        title={form.title}
        subtitle={form.description ?? "Inspection form"}
        actions={<ButtonLink href={`/inspections/start?formId=${form.id}`}>Start Inspection</ButtonLink>}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title={`Items (${form.items.length})`}>
            {form.items.length === 0 ? (
              <p className="text-sm text-slate-400">This form has no items.</p>
            ) : (
              <ol className="divide-y divide-slate-100">
                {form.items.map((it, idx) =>
                  it.type === "section" ? (
                    <li key={it.id} className="bg-slate-50 px-2 py-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {it.label}
                      </p>
                    </li>
                  ) : (
                    <li key={it.id} className="flex items-center gap-3 px-2 py-2.5">
                      <span className="w-6 text-right text-xs text-slate-400">{idx + 1}.</span>
                      <span className="flex-1 text-sm text-slate-800">
                        {it.label}
                        {it.required ? <span className="text-red-500"> *</span> : null}
                        {it.options ? (
                          <span className="block text-xs text-slate-400">
                            Options:{" "}
                            {(() => {
                              try {
                                return (JSON.parse(it.options) as string[]).join(", ");
                              } catch {
                                return it.options;
                              }
                            })()}
                          </span>
                        ) : null}
                      </span>
                      <StatusBadge def={INSPECTION_ITEM_TYPE} value={it.type} />
                    </li>
                  )
                )}
              </ol>
            )}
          </Card>

          <Card title={`Recent Submissions (${form.submissions.length})`}>
            {form.submissions.length === 0 ? (
              <EmptyState
                title="No submissions for this form yet"
                action={
                  <ButtonLink href={`/inspections/start?formId=${form.id}`}>
                    Start Inspection
                  </ButtonLink>
                }
              />
            ) : (
              <DataTable headers={["Vehicle", "Submitted By", "Submitted At", "Failed"]}>
                {form.submissions.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <Td>
                      <Link
                        href={`/inspections/submissions/${s.id}`}
                        className="text-indigo-600 hover:underline"
                      >
                        {s.vehicle.name}
                      </Link>
                    </Td>
                    <Td>
                      {s.submittedBy
                        ? `${s.submittedBy.firstName} ${s.submittedBy.lastName}`
                        : "—"}
                    </Td>
                    <Td>{dateTime(s.submittedAt)}</Td>
                    <Td>
                      {s.failedCount > 0 ? (
                        <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
                          {s.failedCount} failed
                        </span>
                      ) : (
                        <span className="text-xs text-emerald-600">Pass</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </DataTable>
            )}
          </Card>
        </div>

        <div>
          <Card title="Details">
            <dl className="divide-y divide-slate-50">
              <FieldRow label="Items" value={form.items.length} />
              <FieldRow
                label="Required Items"
                value={form.items.filter((i) => i.required).length}
              />
              <FieldRow label="Submissions" value={form.submissions.length} />
              <FieldRow label="Created" value={shortDate(form.createdAt)} />
              <FieldRow label="Last Updated" value={shortDate(form.updatedAt)} />
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
