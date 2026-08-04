import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, FieldRow } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select, TextArea, TextInput } from "@/components/ui/FormField";
import {
  ISSUE_STATUS,
  PRIORITY,
  ISSUE_SOURCE,
  FAULT_STATUS,
  WORK_ORDER_STATUS,
  enumLabel,
} from "@/lib/enums";
import { shortDate, dateTime, relative, meter, vehicleTitle } from "@/lib/format";
import {
  resolveIssue,
  closeIssue,
  reopenIssue,
  addIssueToWorkOrder,
  addIssueComment,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function IssueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const issue = await db.issue.findUnique({
    where: { id },
    include: {
      vehicle: true,
      reportedBy: true,
      assignedTo: true,
      workOrder: true,
      faultCode: true,
      inspectionItemResult: {
        include: {
          item: true,
          submission: { include: { form: true, submittedBy: true } },
        },
      },
    },
  });
  if (!issue) notFound();

  const [comments, openWorkOrders] = await Promise.all([
    db.comment.findMany({
      where: { entityType: "issue", entityId: issue.id },
      orderBy: { createdAt: "asc" },
    }),
    db.workOrder.findMany({
      where: {
        vehicleId: issue.vehicleId,
        status: { in: ["open", "pending", "in_progress", "waiting_on_parts"] },
      },
      orderBy: { number: "desc" },
    }),
  ]);

  const now = new Date();
  const displayStatus =
    issue.status === "open" && issue.dueDate && issue.dueDate < now ? "overdue" : issue.status;
  const iir = issue.inspectionItemResult;

  let photos: string[] = [];
  try {
    photos = JSON.parse(issue.photos ?? "[]");
  } catch {
    photos = [];
  }

  return (
    <div>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <span className="text-slate-400">#{issue.number}</span> {issue.summary}
            <StatusBadge def={ISSUE_STATUS} value={displayStatus} />
          </span>
        }
        subtitle={`Reported ${relative(issue.reportedAt)}`}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Description">
            {issue.description ? (
              <p className="whitespace-pre-wrap text-sm text-slate-700">{issue.description}</p>
            ) : (
              <p className="text-sm text-slate-400">No description provided.</p>
            )}
          </Card>

          {iir ? (
            <Card title="Linked Inspection Item">
              <div className="space-y-1 text-sm text-slate-700">
                <p>
                  Item <span className="font-medium">“{iir.item.label}”</span> failed during{" "}
                  <Link
                    href={`/inspections/submissions/${iir.submissionId}`}
                    className="text-indigo-600 hover:underline"
                  >
                    {iir.submission.form.title}
                  </Link>{" "}
                  submitted {dateTime(iir.submission.submittedAt)}
                  {iir.submission.submittedBy
                    ? ` by ${iir.submission.submittedBy.firstName} ${iir.submission.submittedBy.lastName}`
                    : ""}
                  .
                </p>
                {iir.value ? (
                  <p>
                    Recorded value: <span className="font-medium">{iir.value}</span>
                  </p>
                ) : null}
                {iir.comment ? (
                  <p className="rounded-lg bg-slate-50 p-2 text-slate-600">
                    Operator comment: “{iir.comment}”
                  </p>
                ) : null}
              </div>
            </Card>
          ) : null}

          {issue.faultCode ? (
            <Card title="Linked Fault Code">
              <div className="flex items-start justify-between gap-4">
                <div className="text-sm text-slate-700">
                  <p className="font-mono text-base font-semibold text-slate-900">
                    {issue.faultCode.code}
                  </p>
                  <p className="mt-1">{issue.faultCode.description ?? "No description"}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Occurred {dateTime(issue.faultCode.occurredAt)} · Severity:{" "}
                    {issue.faultCode.severity}
                  </p>
                </div>
                <StatusBadge def={FAULT_STATUS} value={issue.faultCode.status} />
              </div>
            </Card>
          ) : null}

          <Card title={`Comments (${comments.length})`}>
            <div className="space-y-3">
              {comments.length === 0 ? (
                <p className="text-sm text-slate-400">No comments yet.</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="rounded-lg bg-slate-50 p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-800">{c.authorName}</span>
                      <span className="text-xs text-slate-400">{relative(c.createdAt)}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-slate-700">{c.body}</p>
                  </div>
                ))
              )}
              <form action={addIssueComment} className="space-y-2 border-t border-slate-100 pt-3">
                <input type="hidden" name="issueId" value={issue.id} />
                <TextInput name="authorName" placeholder="Your name (optional)" />
                <TextArea name="body" required placeholder="Add a comment…" />
                <div className="flex justify-end">
                  <Button type="submit" variant="secondary">
                    Add Comment
                  </Button>
                </div>
              </form>
            </div>
          </Card>

          <Card title="Photos">
            {photos.length === 0 ? (
              <EmptyState
                title="No photos attached"
                hint="Photos from mobile issue reports and inspections will appear here."
              />
            ) : (
              <ul className="space-y-1 text-sm">
                {photos.map((url, idx) => (
                  <li key={idx}>
                    <a
                      href={url}
                      className="text-indigo-600 hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Details">
            <dl className="divide-y divide-slate-50">
              <FieldRow
                label="Vehicle"
                value={
                  <Link
                    href={`/vehicles/${issue.vehicleId}`}
                    className="text-indigo-600 hover:underline"
                  >
                    {issue.vehicle.name}
                  </Link>
                }
              />
              <FieldRow label="Type" value={vehicleTitle(issue.vehicle)} />
              <FieldRow label="Priority" value={<StatusBadge def={PRIORITY} value={issue.priority} />} />
              <FieldRow label="Source" value={<StatusBadge def={ISSUE_SOURCE} value={issue.source} />} />
              <FieldRow
                label="Reported By"
                value={
                  issue.reportedBy
                    ? `${issue.reportedBy.firstName} ${issue.reportedBy.lastName}`
                    : "—"
                }
              />
              <FieldRow label="Reported At" value={dateTime(issue.reportedAt)} />
              <FieldRow
                label="Assigned To"
                value={
                  issue.assignedTo
                    ? `${issue.assignedTo.firstName} ${issue.assignedTo.lastName}`
                    : "Unassigned"
                }
              />
              <FieldRow label="Due Date" value={shortDate(issue.dueDate)} />
              <FieldRow
                label="Due Meter"
                value={issue.dueMeter != null ? meter(issue.dueMeter, issue.vehicle.meterUnit) : "—"}
              />
              {issue.workOrder ? (
                <FieldRow
                  label="Work Order"
                  value={
                    <span className="inline-flex items-center gap-2">
                      <Link
                        href={`/work-orders/${issue.workOrderId}`}
                        className="text-indigo-600 hover:underline"
                      >
                        WO #{issue.workOrder.number}
                      </Link>
                      <StatusBadge def={WORK_ORDER_STATUS} value={issue.workOrder.status} />
                    </span>
                  }
                />
              ) : null}
              {issue.resolvedAt ? (
                <>
                  <FieldRow label="Resolved At" value={dateTime(issue.resolvedAt)} />
                  <FieldRow label="Resolution Note" value={issue.resolvedNote ?? "—"} />
                </>
              ) : null}
            </dl>
          </Card>

          <Card title="Actions">
            <div className="space-y-4">
              {issue.status === "open" ? (
                <>
                  <form action={resolveIssue} className="space-y-2">
                    <input type="hidden" name="issueId" value={issue.id} />
                    <TextArea name="resolvedNote" placeholder="Resolution note…" rows={2} />
                    <Button type="submit">Resolve with Note</Button>
                  </form>
                  <form action={closeIssue} className="border-t border-slate-100 pt-3">
                    <input type="hidden" name="issueId" value={issue.id} />
                    <Button type="submit" variant="secondary">
                      Close (no work done)
                    </Button>
                  </form>
                  <form action={addIssueToWorkOrder} className="space-y-2 border-t border-slate-100 pt-3">
                    <input type="hidden" name="issueId" value={issue.id} />
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Add to Work Order
                    </p>
                    {openWorkOrders.length === 0 ? (
                      <p className="text-sm text-slate-400">
                        No open work orders for {issue.vehicle.name}.
                      </p>
                    ) : (
                      <>
                        <Select name="workOrderId" required defaultValue="">
                          <option value="" disabled>
                            Select a work order…
                          </option>
                          {openWorkOrders.map((wo) => (
                            <option key={wo.id} value={wo.id}>
                              WO #{wo.number} — {enumLabel(WORK_ORDER_STATUS, wo.status)}
                            </option>
                          ))}
                        </Select>
                        <Button type="submit" variant="secondary">
                          Add to Work Order
                        </Button>
                      </>
                    )}
                  </form>
                </>
              ) : (
                <form action={reopenIssue}>
                  <input type="hidden" name="issueId" value={issue.id} />
                  <p className="mb-2 text-sm text-slate-500">
                    This issue is {enumLabel(ISSUE_STATUS, issue.status).toLowerCase()}.
                  </p>
                  <Button type="submit" variant="secondary">
                    Reopen Issue
                  </Button>
                </form>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
