import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  ISSUE_STATUS,
  PRIORITY,
  REPAIR_CLASS,
  WORK_ORDER_STATUS,
  enumLabel,
} from "@/lib/enums";
import { meter, money, num, shortDate, vehicleTitle } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, FieldRow } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Select, TextInput } from "@/components/ui/FormField";
import {
  addLaborEntry,
  addPartEntry,
  addWorkOrderLine,
  attachIssue,
  setWorkOrderStatus,
} from "../actions";

export const dynamic = "force-dynamic";

// status → available transition buttons
const TRANSITIONS: Record<string, { status: string; label: string; danger?: boolean }[]> = {
  open: [
    { status: "in_progress", label: "Start Work" },
    { status: "waiting_on_parts", label: "Waiting on Parts" },
    { status: "completed", label: "Mark Completed" },
  ],
  pending: [
    { status: "open", label: "Mark Open" },
    { status: "in_progress", label: "Start Work" },
  ],
  in_progress: [
    { status: "waiting_on_parts", label: "Waiting on Parts" },
    { status: "completed", label: "Mark Completed" },
  ],
  waiting_on_parts: [
    { status: "in_progress", label: "Resume Work" },
    { status: "completed", label: "Mark Completed" },
  ],
  completed: [
    { status: "closed", label: "Close" },
    { status: "reopen", label: "Reopen", danger: true },
  ],
  closed: [{ status: "reopen", label: "Reopen", danger: true }],
};

export default async function WorkOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const wo = await db.workOrder.findUnique({
    where: { id },
    include: {
      vehicle: true,
      assignedTo: true,
      vendor: true,
      issues: { orderBy: { number: "asc" } },
      lines: {
        include: {
          task: true,
          laborLines: { include: { technician: true } },
          partLines: { include: { part: true } },
        },
      },
    },
  });
  if (!wo) notFound();

  const editable = wo.status !== "completed" && wo.status !== "closed";

  const [tasks, techs, parts, openIssues] = await Promise.all([
    db.serviceTask.findMany({ orderBy: { name: "asc" } }),
    db.contact.findMany({
      where: { isTechnician: true, archived: false },
      orderBy: { lastName: "asc" },
    }),
    db.part.findMany({
      where: { archived: false },
      include: { stocks: true },
      orderBy: { number: "asc" },
    }),
    editable
      ? db.issue.findMany({
          where: {
            vehicleId: wo.vehicleId,
            workOrderId: null,
            status: { in: ["open", "overdue"] },
          },
          orderBy: { number: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const transitions = TRANSITIONS[wo.status] ?? [];
  const unit = wo.vehicle.meterUnit;

  return (
    <div>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            WO #{wo.number}
            <StatusBadge def={WORK_ORDER_STATUS} value={wo.status} />
          </span>
        }
        subtitle={
          <>
            {wo.vehicle.name} · {vehicleTitle(wo.vehicle)}
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {transitions.map((t) => (
              <form key={t.status} action={setWorkOrderStatus}>
                <input type="hidden" name="id" value={wo.id} />
                <input type="hidden" name="status" value={t.status} />
                <Button
                  type="submit"
                  variant={
                    t.danger ? "danger" : t.status === "completed" ? "primary" : "secondary"
                  }
                >
                  {t.label}
                </Button>
              </form>
            ))}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Description">
            <p className="whitespace-pre-wrap text-sm text-slate-700">
              {wo.description || <span className="text-slate-400">No description.</span>}
            </p>
          </Card>

          <Card title={`Line Items (${wo.lines.length})`}>
            {wo.lines.length === 0 ? (
              <p className="py-2 text-sm text-slate-400">
                No line items yet. Add a service task below.
              </p>
            ) : (
              <div className="space-y-4">
                {wo.lines.map((line) => (
                  <div
                    key={line.id}
                    className="rounded-lg border border-slate-200"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2">
                      <div>
                        <span className="text-sm font-semibold text-slate-800">
                          {line.task?.name ?? "Standalone item"}
                        </span>
                        {line.description ? (
                          <span className="ml-2 text-xs text-slate-500">
                            {line.description}
                          </span>
                        ) : null}
                      </div>
                      <span className="text-sm font-semibold text-slate-900">
                        {money(line.subtotal)}
                      </span>
                    </div>

                    <div className="px-3 py-2">
                      {/* Labor entries */}
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Labor — {money(line.laborCost)}
                      </p>
                      {line.laborLines.length > 0 ? (
                        <table className="mb-2 w-full text-sm">
                          <tbody className="divide-y divide-slate-100">
                            {line.laborLines.map((l) => (
                              <tr key={l.id}>
                                <td className="py-1 text-slate-700">
                                  {l.technician
                                    ? `${l.technician.firstName} ${l.technician.lastName}`
                                    : "—"}
                                </td>
                                <td className="py-1 text-right text-slate-500">
                                  {num(l.hours, 2)} hr × {money(l.rate)}
                                </td>
                                <td className="w-24 py-1 text-right font-medium text-slate-800">
                                  {money(l.cost)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="mb-2 text-xs text-slate-400">No labor recorded.</p>
                      )}
                      {editable ? (
                        <form
                          action={addLaborEntry}
                          className="mb-3 flex flex-wrap items-center gap-2"
                        >
                          <input type="hidden" name="workOrderId" value={wo.id} />
                          <input type="hidden" name="lineId" value={line.id} />
                          <div className="w-44">
                            <Select name="technicianId" defaultValue="">
                              <option value="">Technician…</option>
                              {techs.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.firstName} {t.lastName}
                                </option>
                              ))}
                            </Select>
                          </div>
                          <div className="w-24">
                            <TextInput
                              type="number"
                              step="any"
                              min="0"
                              name="hours"
                              placeholder="Hours"
                              required
                            />
                          </div>
                          <div className="w-28">
                            <TextInput
                              type="number"
                              step="any"
                              min="0"
                              name="rate"
                              placeholder="Rate $/hr"
                              required
                            />
                          </div>
                          <Button type="submit" variant="secondary">
                            + Labor
                          </Button>
                        </form>
                      ) : null}

                      {/* Part entries */}
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Parts — {money(line.partsCost)}
                      </p>
                      {line.partLines.length > 0 ? (
                        <table className="mb-2 w-full text-sm">
                          <tbody className="divide-y divide-slate-100">
                            {line.partLines.map((p) => (
                              <tr key={p.id}>
                                <td className="py-1 text-slate-700">
                                  {p.part.number}
                                  {p.part.description ? (
                                    <span className="ml-1.5 text-xs text-slate-400">
                                      {p.part.description}
                                    </span>
                                  ) : null}
                                </td>
                                <td className="py-1 text-right text-slate-500">
                                  {num(p.quantity, 2)} × {money(p.unitCost)}
                                </td>
                                <td className="w-24 py-1 text-right font-medium text-slate-800">
                                  {money(p.cost)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="mb-2 text-xs text-slate-400">No parts recorded.</p>
                      )}
                      {editable ? (
                        <form
                          action={addPartEntry}
                          className="flex flex-wrap items-center gap-2"
                        >
                          <input type="hidden" name="workOrderId" value={wo.id} />
                          <input type="hidden" name="lineId" value={line.id} />
                          <div className="w-64">
                            <Select name="partId" required defaultValue="">
                              <option value="">Part…</option>
                              {parts.map((p) => {
                                const stock = p.stocks.reduce(
                                  (s, st) => s + st.quantity,
                                  0
                                );
                                return (
                                  <option key={p.id} value={p.id}>
                                    {p.number}
                                    {p.description ? ` — ${p.description}` : ""} (stock:{" "}
                                    {num(stock)})
                                  </option>
                                );
                              })}
                            </Select>
                          </div>
                          <div className="w-20">
                            <TextInput
                              type="number"
                              step="any"
                              min="0"
                              name="quantity"
                              placeholder="Qty"
                              defaultValue={1}
                              required
                            />
                          </div>
                          <div className="w-28">
                            <TextInput
                              type="number"
                              step="any"
                              min="0"
                              name="unitCost"
                              placeholder="Unit cost"
                            />
                          </div>
                          <Button type="submit" variant="secondary">
                            + Part
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {editable ? (
              <form
                action={addWorkOrderLine}
                className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4"
              >
                <input type="hidden" name="workOrderId" value={wo.id} />
                <div className="w-64">
                  <Select name="taskId" defaultValue="">
                    <option value="">Select service task…</option>
                    {tasks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="w-72">
                  <TextInput name="description" placeholder="Optional description" />
                </div>
                <Button type="submit">+ Add Line</Button>
              </form>
            ) : null}
          </Card>

          <Card title={`Linked Issues (${wo.issues.length})`}>
            {wo.issues.length === 0 ? (
              <p className="py-1 text-sm text-slate-400">No issues linked.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {wo.issues.map((issue) => (
                  <li
                    key={issue.id}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <div>
                      <Link
                        href={`/issues/${issue.id}`}
                        className="text-sm font-medium text-indigo-600 hover:underline"
                      >
                        #{issue.number}
                      </Link>
                      <span className="ml-2 text-sm text-slate-700">{issue.summary}</span>
                    </div>
                    <StatusBadge def={ISSUE_STATUS} value={issue.status} />
                  </li>
                ))}
              </ul>
            )}
            {editable && openIssues.length > 0 ? (
              <form
                action={attachIssue}
                className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3"
              >
                <input type="hidden" name="workOrderId" value={wo.id} />
                <div className="w-80">
                  <Select name="issueId" required defaultValue="">
                    <option value="">Open issues on this vehicle…</option>
                    {openIssues.map((i) => (
                      <option key={i.id} value={i.id}>
                        #{i.number} — {i.summary}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button type="submit" variant="secondary">
                  Attach Issue
                </Button>
              </form>
            ) : null}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Details">
            <dl>
              <FieldRow
                label="Vehicle"
                value={
                  <Link
                    href={`/vehicles/${wo.vehicleId}`}
                    className="text-indigo-600 hover:underline"
                  >
                    {wo.vehicle.name}
                  </Link>
                }
              />
              <FieldRow
                label="Status"
                value={<StatusBadge def={WORK_ORDER_STATUS} value={wo.status} />}
              />
              <FieldRow
                label="Priority"
                value={<StatusBadge def={PRIORITY} value={wo.priority} />}
              />
              <FieldRow
                label="Repair Class"
                value={enumLabel(REPAIR_CLASS, wo.repairClass)}
              />
              <FieldRow
                label="Assigned To"
                value={
                  wo.assignedTo
                    ? `${wo.assignedTo.firstName} ${wo.assignedTo.lastName}`
                    : "—"
                }
              />
              <FieldRow label="Vendor" value={wo.vendor?.name ?? "—"} />
              <FieldRow label="Issued" value={shortDate(wo.issuedAt)} />
              <FieldRow label="Scheduled" value={shortDate(wo.scheduledFor)} />
              <FieldRow label="Started" value={shortDate(wo.startedAt)} />
              <FieldRow label="Completed" value={shortDate(wo.completedAt)} />
              <FieldRow
                label="Meter at Service"
                value={meter(wo.meterAtService, unit)}
              />
            </dl>
          </Card>

          <Card title="Totals">
            <dl>
              <FieldRow label="Labor" value={money(wo.laborTotal)} />
              <FieldRow label="Parts" value={money(wo.partsTotal)} />
              <FieldRow label="Subtotal" value={money(wo.subtotal)} />
              <FieldRow label="Tax (7%)" value={money(wo.tax)} />
              <FieldRow
                label="Total"
                value={
                  <span className="text-base font-semibold text-slate-900">
                    {money(wo.total)}
                  </span>
                }
              />
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
