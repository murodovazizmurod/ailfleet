import { db } from "@/lib/db";
import { vehicleTitle } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Select, TextArea, TextInput } from "@/components/ui/FormField";
import { createServiceEntry } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewServiceEntryPage() {
  const [vehicles, vendors, tasks] = await Promise.all([
    db.vehicle.findMany({ where: { archived: false }, orderBy: { name: "asc" } }),
    db.vendor.findMany({ where: { archived: false }, orderBy: { name: "asc" } }),
    db.serviceTask.findMany({ orderBy: { name: "asc" } }),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <PageHeader
        title="New Service Entry"
        subtitle="Log completed maintenance (e.g. outsourced work). Matching reminders reset automatically."
      />
      <Card className="max-w-3xl">
        <form action={createServiceEntry} className="grid gap-4 sm:grid-cols-2">
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

          <Field label="Date">
            <TextInput type="date" name="date" defaultValue={today} />
          </Field>

          <Field label="Meter" hint="Meter reading at time of service">
            <TextInput type="number" step="any" name="meter" placeholder="e.g. 45200" />
          </Field>

          <Field label="Vendor">
            <Select name="vendorId" defaultValue="">
              <option value="">None (in-house)</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Reference #" hint="Invoice or RO number">
            <TextInput name="reference" placeholder="INV-1042" />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Notes">
              <TextArea name="notes" placeholder="Anything worth remembering…" />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <p className="mb-2 text-sm font-medium text-slate-700">Task Lines</p>
            <div className="space-y-2 rounded-lg border border-slate-200 p-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1">
                    <Select name={`task_${i}`} defaultValue="">
                      <option value="">
                        {i === 0 ? "Select task…" : "— (unused row)"}
                      </option>
                      {tasks.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="w-36">
                    <TextInput
                      type="number"
                      step="any"
                      min="0"
                      name={`cost_${i}`}
                      placeholder="Total cost $"
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Rows without a task selected are ignored.
            </p>
          </div>

          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit">Save Service Entry</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
