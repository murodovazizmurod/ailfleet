import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, FieldRow } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Field, TextArea, TextInput } from "@/components/ui/FormField";
import { REPAIR_CLASS } from "@/lib/enums";
import { money, meter, dateTime, shortDate, vehicleTitle, relative } from "@/lib/format";
import { FileText, ImageIcon } from "lucide-react";
import { addServiceEntryComment } from "../actions";

export const dynamic = "force-dynamic";

const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;

export default async function ServiceEntryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const entry = await db.serviceEntry.findUnique({
    where: { id },
    include: {
      vehicle: true,
      vendor: true,
      workOrder: { select: { id: true, number: true } },
      lines: { include: { task: true } },
    },
  });
  if (!entry) notFound();

  const [documents, comments, resolvedIssues] = await Promise.all([
    db.document.findMany({
      where: { entityType: "service_entry", entityId: entry.id },
      orderBy: { createdAt: "asc" },
    }),
    db.comment.findMany({
      where: { entityType: "service_entry", entityId: entry.id },
      orderBy: { createdAt: "asc" },
    }),
    db.issue.findMany({
      where: {
        vehicleId: entry.vehicleId,
        status: "resolved",
        resolvedAt: entry.date,
      },
      select: { id: true, number: true, summary: true },
    }),
  ]);

  const subtotal = entry.laborTotal + entry.partsTotal;

  return (
    <div>
      <PageHeader
        title={`Service Entry — ${entry.vehicle.name}`}
        subtitle={
          <>
            {shortDate(entry.date)} · {vehicleTitle(entry.vehicle)}
            {entry.workOrder ? (
              <>
                {" · from "}
                <Link
                  href={`/work-orders/${entry.workOrder.id}`}
                  className="text-indigo-600 hover:underline"
                >
                  WO #{entry.workOrder.number}
                </Link>
              </>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Line Items">
            {entry.lines.length === 0 ? (
              <p className="text-sm text-slate-400">No line items.</p>
            ) : (
              <div>
                <div className="mb-3 grid grid-cols-3 gap-3">
                  <div className="rounded-lg bg-slate-50 p-3 text-center">
                    <p className="text-xs text-slate-500">Labor</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {money(entry.laborTotal)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3 text-center">
                    <p className="text-xs text-slate-500">Parts</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {money(entry.partsTotal)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3 text-center">
                    <p className="text-xs text-slate-500">Total</p>
                    <p className="text-lg font-semibold text-slate-900">{money(entry.total)}</p>
                  </div>
                </div>
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-2">Item</th>
                      <th className="py-2 text-right">Labor</th>
                      <th className="py-2 text-right">Parts</th>
                      <th className="py-2 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {entry.lines.map((l) => (
                      <tr key={l.id}>
                        <td className="py-2">
                          <span className="font-medium text-slate-800">
                            {l.task?.name ?? "—"}
                          </span>
                          {l.description ? (
                            <span className="ml-2 text-slate-500">{l.description}</span>
                          ) : null}
                        </td>
                        <td className="py-2 text-right text-slate-700">{money(l.laborCost)}</td>
                        <td className="py-2 text-right text-slate-700">{money(l.partsCost)}</td>
                        <td className="py-2 text-right font-medium text-slate-800">
                          {money(l.cost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {resolvedIssues.length > 0 ? (
            <Card title="Issues Resolved">
              <ul className="divide-y divide-slate-100">
                {resolvedIssues.map((i) => (
                  <li key={i.id} className="py-2 text-sm">
                    <Link href={`/issues/${i.id}`} className="text-indigo-600 hover:underline">
                      #{i.number}
                    </Link>{" "}
                    <span className="text-slate-700">{i.summary}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card title="Comments">
            {comments.length === 0 ? (
              <p className="text-sm text-slate-400">No comments yet.</p>
            ) : (
              <ul className="mb-4 space-y-3">
                {comments.map((c) => (
                  <li key={c.id} className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-medium text-slate-500">
                      {c.authorName} · {relative(c.createdAt)}
                    </p>
                    <p className="mt-1 text-sm text-slate-700">{c.body}</p>
                  </li>
                ))}
              </ul>
            )}
            <form action={addServiceEntryComment} className="space-y-2">
              <input type="hidden" name="entryId" value={entry.id} />
              <div className="grid gap-2 sm:grid-cols-[1fr_2fr]">
                <TextInput name="authorName" placeholder="Your name" />
              </div>
              <Field label="">
                <TextArea name="body" placeholder="Add a comment" required />
              </Field>
              <div className="flex justify-end">
                <Button type="submit" variant="secondary">
                  Comment
                </Button>
              </div>
            </form>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Details">
            <dl className="divide-y divide-slate-50">
              <FieldRow
                label="Vehicle"
                value={
                  <Link
                    href={`/vehicles/${entry.vehicleId}`}
                    className="text-indigo-600 hover:underline"
                  >
                    {entry.vehicle.name}
                  </Link>
                }
              />
              <FieldRow
                label="Repair Priority Class"
                value={
                  entry.repairClass ? (
                    <StatusBadge def={REPAIR_CLASS} value={entry.repairClass} />
                  ) : (
                    "—"
                  )
                }
              />
              {entry.startDate ? (
                <FieldRow label="Start Date" value={dateTime(entry.startDate)} />
              ) : null}
              <FieldRow label="Completion Date" value={dateTime(entry.date)} />
              <FieldRow label="Odometer" value={meter(entry.meter, entry.vehicle.meterUnit)} />
              <FieldRow label="Vendor" value={entry.vendor?.name ?? "—"} />
              <FieldRow label="Reference" value={entry.reference ?? "—"} />
              <FieldRow label="Notes" value={entry.notes ?? "—"} />
            </dl>
          </Card>

          <Card title="Invoice">
            <dl className="divide-y divide-slate-50">
              <FieldRow label="Invoice Number" value={entry.invoiceNumber ?? "—"} />
              <FieldRow label="Labor" value={money(entry.laborTotal)} />
              <FieldRow label="Parts" value={money(entry.partsTotal)} />
              <FieldRow label="Subtotal" value={money(subtotal)} />
              <FieldRow label="Discount" value={entry.discount ? `−${money(entry.discount)}` : "—"} />
              <FieldRow label="Tax" value={entry.tax ? money(entry.tax) : "—"} />
              <FieldRow
                label="Invoice Total"
                value={<span className="text-base font-semibold">{money(entry.total)}</span>}
              />
            </dl>
          </Card>

          <Card title={`Documents (${documents.length})`}>
            {documents.length === 0 ? (
              <p className="text-sm text-slate-400">
                No invoice files attached. Attach photos or PDFs when creating the entry.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {documents.map((d) =>
                  IMAGE_EXT.test(d.name) ? (
                    <a
                      key={d.id}
                      href={d.url}
                      target="_blank"
                      className="group overflow-hidden rounded-lg border border-slate-200"
                      title={d.name}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={d.url}
                        alt={d.name}
                        className="h-28 w-full object-cover transition-transform group-hover:scale-105"
                      />
                      <p className="truncate px-2 py-1 text-xs text-slate-500">{d.name}</p>
                    </a>
                  ) : (
                    <a
                      key={d.id}
                      href={d.url}
                      target="_blank"
                      className="flex h-28 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                      title={d.name}
                    >
                      {d.name.toLowerCase().endsWith(".pdf") ? (
                        <FileText className="h-6 w-6" />
                      ) : (
                        <ImageIcon className="h-6 w-6" />
                      )}
                      <span className="max-w-full truncate px-2 text-xs">{d.name}</span>
                    </a>
                  )
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
