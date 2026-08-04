import { db } from "@/lib/db";
import { vehicleTitle } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Select, TextInput } from "@/components/ui/FormField";
import { createReminder } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewReminderPage() {
  const [vehicles, tasks] = await Promise.all([
    db.vehicle.findMany({ where: { archived: false }, orderBy: { name: "asc" } }),
    db.serviceTask.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader
        title="New Service Reminder"
        subtitle="Track a recurring maintenance task for a vehicle"
      />
      <Card className="max-w-3xl">
        <form action={createReminder} className="grid gap-4 sm:grid-cols-2">
          <Field label="Vehicle" required>
            <Select name="vehicleId" required defaultValue="">
              <option value="">Select vehicle…</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} — {vehicleTitle(v)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Service Task" required>
            <Select name="taskId" required defaultValue="">
              <option value="">Select task…</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Meter Interval" hint="Repeat every N miles/km/hours">
            <TextInput
              type="number"
              step="any"
              min="0"
              name="intervalMeter"
              placeholder="e.g. 5000"
            />
          </Field>

          <Field label="Time Interval (days)" hint="Repeat every N days">
            <TextInput
              type="number"
              min="0"
              name="intervalDays"
              placeholder="e.g. 180"
            />
          </Field>

          <Field
            label="First Due Meter"
            hint="Defaults to current meter + interval if left blank"
          >
            <TextInput type="number" step="any" min="0" name="firstDueMeter" />
          </Field>

          <Field
            label="First Due Date"
            hint="Defaults to today + interval days if left blank"
          >
            <TextInput type="date" name="firstDueDate" />
          </Field>

          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit">Create Reminder</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
