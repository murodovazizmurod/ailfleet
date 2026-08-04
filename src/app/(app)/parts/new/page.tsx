import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field, TextInput, Select } from "@/components/ui/FormField";
import { createPart } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewPartPage() {
  const locations = await db.inventoryLocation.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="New Part"
        subtitle="Add a part to the catalog"
        actions={<ButtonLink href="/parts" variant="secondary">Cancel</ButtonLink>}
      />
      <Card>
        <form action={createPart} className="grid gap-4 sm:grid-cols-2">
          <Field label="Part Number" required>
            <TextInput type="text" name="number" required placeholder="e.g. FLT-1042" />
          </Field>
          <Field label="Description">
            <TextInput type="text" name="description" />
          </Field>
          <Field label="Category">
            <TextInput type="text" name="category" placeholder="e.g. Filters" />
          </Field>
          <Field label="Manufacturer">
            <TextInput type="text" name="manufacturer" />
          </Field>
          <Field label="Unit Cost">
            <TextInput type="number" name="unitCost" step="0.01" min="0" placeholder="0.00" />
          </Field>

          <div className="sm:col-span-2 border-t border-slate-100 pt-4">
            <h4 className="mb-3 text-sm font-semibold text-slate-900">
              Initial Stock (optional)
            </h4>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Location">
                <Select name="locationId" defaultValue="">
                  <option value="">—</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Quantity">
                <TextInput type="number" name="initialQty" step="1" min="0" />
              </Field>
              <Field label="Reorder Point">
                <TextInput type="number" name="reorderPoint" step="1" min="0" />
              </Field>
            </div>
          </div>

          <div className="sm:col-span-2 flex justify-end gap-2 border-t border-slate-100 pt-4">
            <ButtonLink href="/parts" variant="secondary">
              Cancel
            </ButtonLink>
            <Button type="submit">Create Part</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
