import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, FieldRow } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { INSPECTION_ITEM_TYPE } from "@/lib/enums";
import { dateTime, vehicleTitle } from "@/lib/format";

export const dynamic = "force-dynamic";

function formatDuration(sec: number | null): string {
  if (sec == null) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default async function SubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const submission = await db.inspectionSubmission.findUnique({
    where: { id },
    include: {
      form: { include: { items: { orderBy: { position: "asc" } } } },
      vehicle: true,
      submittedBy: true,
      results: { include: { issue: true } },
    },
  });
  if (!submission) notFound();

  const resultsByItemId = new Map(submission.results.map((r) => [r.itemId, r]));

  return (
    <div>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {submission.form.title}
            {submission.failedCount > 0 ? (
              <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-sm font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
                {submission.failedCount} failed
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-sm font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                All passed
              </span>
            )}
          </span>
        }
        subtitle={`${submission.vehicle.name} · Submitted ${dateTime(submission.submittedAt)}`}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title="Results">
            <div className="divide-y divide-slate-100">
              {submission.form.items.map((it) => {
                if (it.type === "section") {
                  return (
                    <div key={it.id} className="bg-slate-50 px-2 py-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {it.label}
                      </p>
                    </div>
                  );
                }
                const r = resultsByItemId.get(it.id);
                const failed = r?.issueId != null || r?.passed === false;
                return (
                  <div key={it.id} className="px-2 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-800">{it.label}</span>
                        <StatusBadge def={INSPECTION_ITEM_TYPE} value={it.type} />
                      </div>
                      {it.type === "pass_fail" || failed ? (
                        r?.passed === true ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                            Pass
                          </span>
                        ) : failed ? (
                          <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
                            Fail
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Not answered</span>
                        )
                      ) : null}
                    </div>
                    {r?.value ? (
                      <p className="mt-1 text-sm text-slate-600">
                        Value: <span className="font-medium">{r.value}</span>
                      </p>
                    ) : null}
                    {r?.comment ? (
                      <p className="mt-1 rounded-lg bg-slate-50 p-2 text-sm text-slate-600">
                        “{r.comment}”
                      </p>
                    ) : null}
                    {r?.issue ? (
                      <p className="mt-1 text-sm">
                        <Link
                          href={`/issues/${r.issue.id}`}
                          className="text-indigo-600 hover:underline"
                        >
                          Issue #{r.issue.number}: {r.issue.summary}
                        </Link>{" "}
                        <span className="text-xs text-slate-400">(auto-created)</span>
                      </p>
                    ) : null}
                    {!r ? (
                      <p className="mt-1 text-xs text-slate-400">No response recorded.</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Submission Details">
            <dl className="divide-y divide-slate-50">
              <FieldRow
                label="Form"
                value={
                  <Link
                    href={`/inspections/forms/${submission.formId}`}
                    className="text-indigo-600 hover:underline"
                  >
                    {submission.form.title}
                  </Link>
                }
              />
              <FieldRow
                label="Vehicle"
                value={
                  <Link
                    href={`/vehicles/${submission.vehicleId}`}
                    className="text-indigo-600 hover:underline"
                  >
                    {submission.vehicle.name}
                  </Link>
                }
              />
              <FieldRow label="Type" value={vehicleTitle(submission.vehicle)} />
              <FieldRow
                label="Submitted By"
                value={
                  submission.submittedBy
                    ? `${submission.submittedBy.firstName} ${submission.submittedBy.lastName}`
                    : "—"
                }
              />
              <FieldRow label="Started At" value={dateTime(submission.startedAt)} />
              <FieldRow label="Submitted At" value={dateTime(submission.submittedAt)} />
              <FieldRow label="Duration" value={formatDuration(submission.durationSec)} />
              <FieldRow
                label="Failed Items"
                value={
                  submission.failedCount > 0 ? (
                    <span className="font-semibold text-red-600">{submission.failedCount}</span>
                  ) : (
                    "0"
                  )
                }
              />
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
