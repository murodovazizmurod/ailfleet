import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field, TextInput, Select } from "@/components/ui/FormField";
import { createFuelEntry } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewFuelEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ vehicleId?: string }>;
}) {
  const { vehicleId } = await searchParams;

  const [vehicles, vendors] = await Promise.all([
    db.vehicle.findMany({ where: { archived: false }, orderBy: { name: "asc" } }),
    db.vendor.findMany({
      where: { archived: false, classifications: { contains: "fuel" } },
      orderBy: { name: "asc" },
    }),
  ]);

  const now = new Date();
  const defaultDate = new Date(now.getTime() - now.getTimezoneOffset() * 60 * 1000)
    .toISOString()
    .slice(0, 16);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="New Fuel Entry"
        subtitle="Log a fill-up for a vehicle"
        actions={<ButtonLink href="/fuel" variant="secondary">Cancel</ButtonLink>}
      />
      <Card>
        <form action={createFuelEntry} className="grid gap-4 sm:grid-cols-2">
          <Field label="Vehicle" required>
            <Select name="vehicleId" required defaultValue={vehicleId ?? ""}>
              <option value="" disabled>
                Select a vehicle…
              </option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date">
            <TextInput type="datetime-local" name="date" defaultValue={defaultDate} />
          </Field>
          <Field label="Meter" required hint="Odometer / hours at fill-up">
            <TextInput type="number" name="meter" step="0.1" min="0" required />
          </Field>
          <Field label="Volume (gal)" required>
            <TextInput type="number" name="volume" step="0.001" min="0" required />
          </Field>
          <Field label="Price per Unit">
            <TextInput type="number" name="pricePerUnit" step="0.001" min="0" placeholder="0.00" />
          </Field>
          <Field label="Vendor" hint="Fuel-classified vendors only">
            <Select name="vendorId" defaultValue="">
              <option value="">—</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Reference" hint="Invoice or transaction #">
            <TextInput type="text" name="reference" />
          </Field>
          <div className="flex items-end gap-6 pb-1">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name="partial"
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
              />
              Partial fuel-up
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name="personal"
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
              />
              Personal
            </label>
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2 border-t border-slate-100 pt-4">
            <ButtonLink href="/fuel" variant="secondary">
              Cancel
            </ButtonLink>
            <Button type="submit">Save Fuel Entry</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
