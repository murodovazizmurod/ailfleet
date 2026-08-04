import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field, TextInput, Select } from "@/components/ui/FormField";
import { createChargingEntry } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewChargingEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ vehicleId?: string }>;
}) {
  const { vehicleId } = await searchParams;

  const vehicles = await db.vehicle.findMany({
    where: { archived: false },
    orderBy: { name: "asc" },
  });
  // Electric (and hybrid) vehicles first.
  const electric = vehicles.filter((v) => v.fuelType === "electric");
  const hybrid = vehicles.filter((v) => v.fuelType === "hybrid");
  const others = vehicles.filter(
    (v) => v.fuelType !== "electric" && v.fuelType !== "hybrid"
  );

  const now = new Date();
  const defaultDate = new Date(now.getTime() - now.getTimezoneOffset() * 60 * 1000)
    .toISOString()
    .slice(0, 16);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="New Charging Entry"
        subtitle="Log an EV charging session"
        actions={
          <ButtonLink href="/fuel?tab=charging" variant="secondary">
            Cancel
          </ButtonLink>
        }
      />
      <Card>
        <form action={createChargingEntry} className="grid gap-4 sm:grid-cols-2">
          <Field label="Vehicle" required>
            <Select name="vehicleId" required defaultValue={vehicleId ?? ""}>
              <option value="" disabled>
                Select a vehicle…
              </option>
              {electric.length > 0 ? (
                <optgroup label="Electric">
                  {electric.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {hybrid.length > 0 ? (
                <optgroup label="Hybrid">
                  {hybrid.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {others.length > 0 ? (
                <optgroup label="Other vehicles">
                  {others.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </Select>
          </Field>
          <Field label="Date">
            <TextInput type="datetime-local" name="date" defaultValue={defaultDate} />
          </Field>
          <Field label="Energy (kWh)" required>
            <TextInput type="number" name="energyKwh" step="0.1" min="0" required />
          </Field>
          <Field label="Duration (min)">
            <TextInput type="number" name="durationMin" step="1" min="0" />
          </Field>
          <Field label="Cost">
            <TextInput type="number" name="cost" step="0.01" min="0" placeholder="0.00" />
          </Field>
          <Field label="Location" hint="e.g. Home, Depot, Public — Electrify America">
            <TextInput type="text" name="location" />
          </Field>
          <div className="sm:col-span-2 flex justify-end gap-2 border-t border-slate-100 pt-4">
            <ButtonLink href="/fuel?tab=charging" variant="secondary">
              Cancel
            </ButtonLink>
            <Button type="submit">Save Charging Entry</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
