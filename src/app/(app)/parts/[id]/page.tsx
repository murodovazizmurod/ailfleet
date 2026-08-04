import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { money, num, relative, shortDate } from "@/lib/format";
import { ADJUSTMENT_REASON } from "@/lib/enums";
import type { EnumDef } from "@/lib/enums";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, FieldRow } from "@/components/ui/Card";
import { DataTable, Td } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field, TextInput, Select, EnumSelect } from "@/components/ui/FormField";
import { EmptyState } from "@/components/ui/EmptyState";
import { adjustStock } from "../actions";

export const dynamic = "force-dynamic";

const STOCK_STATUS: EnumDef = {
  ok: { label: "In Stock", color: "green" },
  low: { label: "Low Stock", color: "orange" },
  out: { label: "Out of Stock", color: "red" },
};

export default async function PartDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [part, locations] = await Promise.all([
    db.part.findUnique({
      where: { id },
      include: {
        stocks: { include: { location: true } },
        adjustments: { orderBy: { createdAt: "desc" }, take: 25 },
        workOrderParts: {
          include: { line: { include: { workOrder: { include: { vehicle: true } } } } },
        },
      },
    }),
    db.inventoryLocation.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!part) notFound();

  const locationName = new Map(locations.map((l) => [l.id, l.name]));
  const totalQty = part.stocks.reduce((s, st) => s + st.quantity, 0);

  return (
    <div>
      <PageHeader
        title={part.number}
        subtitle={part.description ?? "Part detail"}
        actions={<ButtonLink href="/parts" variant="secondary">Back to Parts</ButtonLink>}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Stock by Location">
            {part.stocks.length === 0 ? (
              <p className="text-sm text-slate-500">
                No stock records yet. Use the adjustment form below to set a quantity.
              </p>
            ) : (
              <DataTable
                headers={["Location", "Quantity", "Reorder Point", "Aisle / Bin", "Status"]}
              >
                {part.stocks.map((st) => {
                  const status =
                    st.quantity <= 0
                      ? "out"
                      : st.reorderPoint != null && st.quantity <= st.reorderPoint
                        ? "low"
                        : "ok";
                  return (
                    <tr key={st.id}>
                      <Td className="font-medium text-slate-900">{st.location.name}</Td>
                      <Td>{num(st.quantity)}</Td>
                      <Td>{st.reorderPoint != null ? num(st.reorderPoint) : "—"}</Td>
                      <Td>
                        {[st.aisle, st.bin].filter(Boolean).join(" / ") || "—"}
                      </Td>
                      <Td>
                        <StatusBadge def={STOCK_STATUS} value={status} />
                      </Td>
                    </tr>
                  );
                })}
              </DataTable>
            )}
          </Card>

          <Card title="Adjust Stock">
            <form action={adjustStock} className="grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="partId" value={part.id} />
              <Field label="Location" required>
                <Select name="locationId" required defaultValue="">
                  <option value="" disabled>
                    Select a location…
                  </option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="New Quantity" required>
                <TextInput type="number" name="newQuantity" step="1" min="0" required />
              </Field>
              <Field label="Reason" required>
                <EnumSelect name="reason" def={ADJUSTMENT_REASON} required defaultValue="correction" />
              </Field>
              <Field label="Note">
                <TextInput type="text" name="note" placeholder="Optional comment" />
              </Field>
              <div className="sm:col-span-2 flex justify-end border-t border-slate-100 pt-4">
                <Button type="submit">Save Adjustment</Button>
              </div>
            </form>
          </Card>

          <Card title="Inventory Activity">
            {part.adjustments.length === 0 ? (
              <p className="text-sm text-slate-500">No adjustments recorded yet.</p>
            ) : (
              <DataTable headers={["When", "Location", "Change", "Reason", "Note"]}>
                {part.adjustments.map((a) => (
                  <tr key={a.id}>
                    <Td>
                      <span title={shortDate(a.createdAt)}>{relative(a.createdAt)}</span>
                    </Td>
                    <Td>
                      {a.locationId ? (locationName.get(a.locationId) ?? "—") : "—"}
                    </Td>
                    <Td
                      className={
                        a.delta > 0
                          ? "font-medium text-emerald-600"
                          : a.delta < 0
                            ? "font-medium text-red-600"
                            : ""
                      }
                    >
                      {a.delta > 0 ? `+${num(a.delta)}` : num(a.delta)}
                    </Td>
                    <Td>
                      <StatusBadge def={ADJUSTMENT_REASON} value={a.reason} />
                    </Td>
                    <Td className="text-slate-500">{a.note ?? "—"}</Td>
                  </tr>
                ))}
              </DataTable>
            )}
          </Card>

          <Card title="Work Order Usage">
            {part.workOrderParts.length === 0 ? (
              <EmptyState
                title="Not used on any work orders yet"
                hint="Usage will appear here when this part is added to a work order line."
              />
            ) : (
              <DataTable headers={["Work Order", "Vehicle", "Qty", "Unit Cost", "Cost"]}>
                {part.workOrderParts.map((wp) => (
                  <tr key={wp.id}>
                    <Td>
                      <Link
                        href={`/work-orders/${wp.line.workOrder.id}`}
                        className="font-medium text-indigo-600 hover:underline"
                      >
                        WO #{wp.line.workOrder.number}
                      </Link>
                    </Td>
                    <Td>{wp.line.workOrder.vehicle.name}</Td>
                    <Td>{num(wp.quantity)}</Td>
                    <Td>{money(wp.unitCost)}</Td>
                    <Td className="font-medium text-slate-900">{money(wp.cost)}</Td>
                  </tr>
                ))}
              </DataTable>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Details">
            <dl className="divide-y divide-slate-100">
              <FieldRow label="Part Number" value={part.number} />
              <FieldRow label="Description" value={part.description ?? "—"} />
              <FieldRow label="Category" value={part.category ?? "—"} />
              <FieldRow label="Manufacturer" value={part.manufacturer ?? "—"} />
              <FieldRow
                label="Mfr. Part Number"
                value={part.manufacturerPartNumber ?? "—"}
              />
              <FieldRow label="UPC" value={part.upc ?? "—"} />
              <FieldRow label="Unit Cost" value={money(part.unitCost)} />
              <FieldRow label="Measurement Unit" value={part.measurementUnit} />
              <FieldRow label="Total On Hand" value={num(totalQty)} />
              <FieldRow
                label="Stock Value"
                value={money(totalQty * part.unitCost)}
              />
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
