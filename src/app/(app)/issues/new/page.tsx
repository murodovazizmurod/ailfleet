import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, TextInput, TextArea, Select, EnumSelect } from "@/components/ui/FormField";
import { PRIORITY } from "@/lib/enums";
import { createIssue } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewIssuePage({
  searchParams,
}: {
  searchParams: Promise<{ vehicleId?: string }>;
}) {
  const { vehicleId } = await searchParams;

  const [vehicles, contacts] = await Promise.all([
    db.vehicle.findMany({ where: { archived: false }, orderBy: { name: "asc" } }),
    db.contact.findMany({ where: { archived: false }, orderBy: { firstName: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New Issue" subtitle="Report a defect or problem on a vehicle" />
      <Card>
        <form action={createIssue} className="grid gap-4 sm:grid-cols-2">
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
          <Field label="Priority">
            <EnumSelect def={PRIORITY} name="priority" defaultValue="none" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Summary" required>
              <TextInput
                name="summary"
                required
                placeholder="Short description of the problem"
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Description">
              <TextArea name="description" placeholder="Add details, symptoms, context…" />
            </Field>
          </div>
          <Field label="Assigned To">
            <Select name="assignedToId" defaultValue="">
              <option value="">Unassigned</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Reported By">
            <Select name="reportedById" defaultValue="">
              <option value="">—</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Due Date">
            <TextInput type="date" name="dueDate" />
          </Field>
          <Field label="Due Meter" hint="Resolve before the vehicle reaches this reading">
            <TextInput type="number" name="dueMeter" step="any" min="0" placeholder="e.g. 85000" />
          </Field>
          <div className="sm:col-span-2 flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="submit">Create Issue</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
