import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field, TextInput, Select, TextArea } from "@/components/ui/FormField";
import { createPurchaseOrder } from "../actions";

export const dynamic = "force-dynamic";

const LINE_ROWS = [0, 1, 2, 3, 4, 5];

export default async function NewPurchaseOrderPage() {
  const [vendors, parts] = await Promise.all([
    db.vendor.findMany({
      where: { archived: false, classifications: { contains: "parts" } },
      orderBy: { name: "asc" },
    }),
    db.part.findMany({ where: { archived: false }, orderBy: { number: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="New Purchase Order"
        subtitle="Order parts from a parts-classified vendor"
        actions={
          <ButtonLink href="/purchase-orders" variant="secondary">
            Cancel
          </ButtonLink>
        }
      />
      <Card>
        <form action={createPurchaseOrder} className="grid gap-4 sm:grid-cols-2">
          <Field label="Vendor" required hint="Parts-classified vendors only">
            <Select name="vendorId" required defaultValue="">
              <option value="" disabled>
                Select a vendor…
              </option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Description">
            <TextArea
              name="description"
              rows={1}
              placeholder="What is this order for?"
            />
          </Field>

          <div className="sm:col-span-2 border-t border-slate-100 pt-4">
            <h4 className="mb-1 text-sm font-semibold text-slate-900">Line Items</h4>
            <p className="mb-3 text-xs text-slate-400">
              Add up to 6 lines. Leave unit cost blank to use the part&apos;s catalog
              cost. Subtotal, 7% tax and total are computed on save.
            </p>
            <div className="space-y-3">
              {LINE_ROWS.map((i) => (
                <div key={i} className="grid gap-3 sm:grid-cols-[1fr_8rem_10rem]">
                  <Select name={`part_${i}`} defaultValue="">
                    <option value="">— Part —</option>
                    {parts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.number}
                        {p.description ? ` — ${p.description}` : ""} ({money(p.unitCost)})
                      </option>
                    ))}
                  </Select>
                  <TextInput
                    type="number"
                    name={`qty_${i}`}
                    step="1"
                    min="1"
                    placeholder="Qty"
                  />
                  <TextInput
                    type="number"
                    name={`cost_${i}`}
                    step="0.01"
                    min="0"
                    placeholder="Unit cost (default)"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="sm:col-span-2 flex justify-end gap-2 border-t border-slate-100 pt-4">
            <ButtonLink href="/purchase-orders" variant="secondary">
              Cancel
            </ButtonLink>
            <Button type="submit">Create Draft PO</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
