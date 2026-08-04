import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { money, num, shortDate } from "@/lib/format";
import { PO_STATUS } from "@/lib/enums";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, FieldRow } from "@/components/ui/Card";
import { DataTable, Td } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button, ButtonLink } from "@/components/ui/Button";
import {
  submitForApproval,
  approvePurchaseOrder,
  rejectPurchaseOrder,
  markPurchased,
  closePurchaseOrder,
  receiveLines,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const po = await db.purchaseOrder.findUnique({
    where: { id },
    include: { vendor: true, lines: { include: { part: true } } },
  });
  if (!po) notFound();

  const receiving = po.status === "purchased" || po.status === "received_partial";

  return (
    <div>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            Purchase Order #{po.number}
            <StatusBadge def={PO_STATUS} value={po.status} />
          </span>
        }
        subtitle={po.description ?? undefined}
        actions={
          <ButtonLink href="/purchase-orders" variant="secondary">
            Back to Purchase Orders
          </ButtonLink>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Line Items">
            {receiving ? (
              <form action={receiveLines}>
                <input type="hidden" name="id" value={po.id} />
                <DataTable
                  headers={[
                    "Part",
                    "Qty",
                    "Unit Cost",
                    "Received",
                    "Line Total",
                    "Receive Qty",
                  ]}
                >
                  {po.lines.map((line) => {
                    const remaining = Math.max(line.quantity - line.received, 0);
                    return (
                      <tr key={line.id}>
                        <Td>
                          <span className="font-medium text-slate-900">
                            {line.part.number}
                          </span>
                          <div className="text-xs text-slate-400">
                            {line.part.description ?? ""}
                          </div>
                        </Td>
                        <Td>{num(line.quantity)}</Td>
                        <Td>{money(line.unitCost)}</Td>
                        <Td>
                          {num(line.received)} / {num(line.quantity)}
                        </Td>
                        <Td className="font-medium text-slate-900">
                          {money(line.quantity * line.unitCost)}
                        </Td>
                        <Td>
                          {remaining > 0 ? (
                            <input
                              type="number"
                              name={`receive_${line.id}`}
                              min={0}
                              max={remaining}
                              step="1"
                              placeholder={`≤ ${num(remaining)}`}
                              className="block w-24 rounded-lg border-0 bg-white px-2 py-1 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600"
                            />
                          ) : (
                            <span className="text-xs font-medium text-emerald-600">
                              Fully received
                            </span>
                          )}
                        </Td>
                      </tr>
                    );
                  })}
                </DataTable>
                <div className="mt-4 flex justify-end">
                  <Button type="submit">Receive Items</Button>
                </div>
              </form>
            ) : (
              <DataTable headers={["Part", "Qty", "Unit Cost", "Received", "Line Total"]}>
                {po.lines.map((line) => (
                  <tr key={line.id}>
                    <Td>
                      <span className="font-medium text-slate-900">{line.part.number}</span>
                      <div className="text-xs text-slate-400">
                        {line.part.description ?? ""}
                      </div>
                    </Td>
                    <Td>{num(line.quantity)}</Td>
                    <Td>{money(line.unitCost)}</Td>
                    <Td>
                      {num(line.received)} / {num(line.quantity)}
                    </Td>
                    <Td className="font-medium text-slate-900">
                      {money(line.quantity * line.unitCost)}
                    </Td>
                  </tr>
                ))}
              </DataTable>
            )}
          </Card>

          <Card title="Actions">
            <div className="flex flex-wrap gap-2">
              {po.status === "draft" ? (
                <form action={submitForApproval}>
                  <input type="hidden" name="id" value={po.id} />
                  <Button type="submit">Submit for Approval</Button>
                </form>
              ) : null}
              {po.status === "pending_approval" ? (
                <>
                  <form action={approvePurchaseOrder}>
                    <input type="hidden" name="id" value={po.id} />
                    <Button type="submit">Approve</Button>
                  </form>
                  <form action={rejectPurchaseOrder}>
                    <input type="hidden" name="id" value={po.id} />
                    <Button type="submit" variant="danger">
                      Reject
                    </Button>
                  </form>
                </>
              ) : null}
              {po.status === "approved" ? (
                <form action={markPurchased}>
                  <input type="hidden" name="id" value={po.id} />
                  <Button type="submit">Mark Purchased</Button>
                </form>
              ) : null}
              {po.status === "received_full" || po.status === "received_partial" ? (
                <form action={closePurchaseOrder}>
                  <input type="hidden" name="id" value={po.id} />
                  <Button type="submit" variant="secondary">
                    Close Purchase Order
                  </Button>
                </form>
              ) : null}
              {["rejected", "closed"].includes(po.status) ? (
                <p className="text-sm text-slate-500">
                  This purchase order is {po.status === "closed" ? "closed" : "rejected"} —
                  no further actions available.
                </p>
              ) : null}
              {receiving ? (
                <p className="w-full text-xs text-slate-400">
                  Enter quantities in the line items table above and click “Receive Items”
                  to add stock to inventory.
                </p>
              ) : null}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Details">
            <dl className="divide-y divide-slate-100">
              <FieldRow label="PO Number" value={`#${po.number}`} />
              <FieldRow label="Vendor" value={po.vendor.name} />
              <FieldRow label="Status" value={<StatusBadge def={PO_STATUS} value={po.status} />} />
              <FieldRow label="Created" value={shortDate(po.createdAt)} />
              <FieldRow label="Approved" value={shortDate(po.approvedAt)} />
              <FieldRow label="Purchased" value={shortDate(po.purchasedAt)} />
              <FieldRow label="Received" value={shortDate(po.receivedAt)} />
              <FieldRow label="Line Items" value={num(po.lines.length)} />
            </dl>
          </Card>

          <Card title="Totals">
            <dl className="divide-y divide-slate-100">
              <FieldRow label="Subtotal" value={money(po.subtotal)} />
              <FieldRow label="Tax" value={money(po.tax)} />
              <FieldRow label="Shipping" value={money(po.shipping)} />
              <FieldRow
                label="Total"
                value={<span className="text-base font-semibold">{money(po.total)}</span>}
              />
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
