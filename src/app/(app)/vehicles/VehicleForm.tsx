import type { Vehicle, VehicleGroup } from "@prisma/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, TextInput, Select, EnumSelect } from "@/components/ui/FormField";
import { ASSET_TYPE, VEHICLE_STATUS, OWNERSHIP, FUEL_TYPE } from "@/lib/enums";

function dateInput(d: Date | null | undefined): string | undefined {
  return d ? new Date(d).toISOString().slice(0, 10) : undefined;
}

export function VehicleForm({
  action,
  groups,
  vehicle,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  groups: VehicleGroup[];
  vehicle?: Vehicle | null;
  submitLabel: string;
}) {
  return (
    <Card>
      <form action={action} className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required>
          <TextInput
            name="name"
            required
            defaultValue={vehicle?.name}
            placeholder="e.g. Truck 12"
          />
        </Field>
        <Field label="Asset type">
          <EnumSelect name="assetType" def={ASSET_TYPE} defaultValue={vehicle?.assetType ?? "vehicle"} />
        </Field>
        <Field label="Status">
          <EnumSelect name="status" def={VEHICLE_STATUS} defaultValue={vehicle?.status ?? "active"} />
        </Field>
        <Field label="Group">
          <Select name="groupId" defaultValue={vehicle?.groupId ?? ""}>
            <option value="">No group</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Year">
          <TextInput name="year" type="number" min={1900} max={2100} defaultValue={vehicle?.year ?? ""} />
        </Field>
        <Field label="Make">
          <TextInput name="make" defaultValue={vehicle?.make ?? ""} />
        </Field>
        <Field label="Model">
          <TextInput name="model" defaultValue={vehicle?.model ?? ""} />
        </Field>
        <Field label="Trim">
          <TextInput name="trim" defaultValue={vehicle?.trim ?? ""} />
        </Field>

        <Field label="VIN">
          <TextInput name="vin" defaultValue={vehicle?.vin ?? ""} />
        </Field>
        <Field label="License plate">
          <TextInput name="licensePlate" defaultValue={vehicle?.licensePlate ?? ""} />
        </Field>
        <Field label="Color">
          <TextInput name="color" defaultValue={vehicle?.color ?? ""} />
        </Field>
        <Field label="Fuel type">
          <EnumSelect name="fuelType" def={FUEL_TYPE} allowEmpty emptyLabel="—" defaultValue={vehicle?.fuelType ?? ""} />
        </Field>

        <Field label="Meter unit">
          <Select name="meterUnit" defaultValue={vehicle?.meterUnit ?? "mi"}>
            <option value="mi">Miles (mi)</option>
            <option value="km">Kilometers (km)</option>
            <option value="hr">Hours (hr)</option>
          </Select>
        </Field>
        <Field label="Current meter">
          <TextInput name="currentMeter" type="number" step="any" min={0} defaultValue={vehicle?.currentMeter ?? 0} />
        </Field>
        <Field label="Ownership">
          <EnumSelect name="ownership" def={OWNERSHIP} defaultValue={vehicle?.ownership ?? "owned"} />
        </Field>

        <Field label="Purchase date">
          <TextInput name="purchaseDate" type="date" defaultValue={dateInput(vehicle?.purchaseDate)} />
        </Field>
        <Field label="Purchase price">
          <TextInput name="purchasePrice" type="number" step="any" min={0} defaultValue={vehicle?.purchasePrice ?? ""} />
        </Field>

        <div className="sm:col-span-2 flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="submit">{submitLabel}</Button>
        </div>
      </form>
    </Card>
  );
}
