import { db } from "@/lib/db";
import { PRIORITY, REPAIR_CLASS } from "@/lib/enums";
import { meter, vehicleTitle } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  EnumSelect,
  Field,
  Select,
  TextArea,
  TextInput,
} from "@/components/ui/FormField";
import { createWorkOrder } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewWorkOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ issueId?: string; vehicleId?: string; taskId?: string }>;
}) {
  const sp = await searchParams;

  const [vehicles, techs, vendors, issue, task] = await Promise.all([
    db.vehicle.findMany({ where: { archived: false }, orderBy: { name: "asc" } }),
    db.contact.findMany({
      where: { isTechnician: true, archived: false },
      orderBy: { lastName: "asc" },
    }),
    db.vendor.findMany({ where: { archived: false }, orderBy: { name: "asc" } }),
    sp.issueId
      ? db.issue.findUnique({ where: { id: sp.issueId }, include: { vehicle: true } })
      : Promise.resolve(null),
    sp.taskId ? db.serviceTask.findUnique({ where: { id: sp.taskId } }) : Promise.resolve(null),
  ]);

  const preVehicleId = issue?.vehicleId ?? sp.vehicleId ?? "";
  const preVehicle = preVehicleId
    ? vehicles.find((v) => v.id === preVehicleId)
    : undefined;

  return (
    <div>
      <PageHeader
        title="New Work Order"
        subtitle={
          issue
            ? `Linked to Issue #${issue.number} — ${issue.summary}`
            : task
              ? `Prefilled with task: ${task.name}`
              : "Schedule an in-house repair or service job"
        }
      />
      <Card className="max-w-3xl">
        <form action={createWorkOrder} className="grid gap-4 sm:grid-cols-2">
          {sp.issueId ? <input type="hidden" name="issueId" value={sp.issueId} /> : null}
          {sp.taskId ? <input type="hidden" name="taskId" value={sp.taskId} /> : null}

          <Field label="Vehicle" required>
            <Select name="vehicleId" required defaultValue={preVehicleId}>
              <option value="">Select vehicle…</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} — {vehicleTitle(v)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Assigned Technician">
            <Select name="assignedToId" defaultValue="">
              <option value="">Unassigned</option>
              {techs.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.firstName} {t.lastName}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Priority">
            <EnumSelect def={PRIORITY} name="priority" defaultValue="none" />
          </Field>

          <Field label="Repair Class">
            <EnumSelect def={REPAIR_CLASS} name="repairClass" defaultValue="scheduled" />
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

          <Field label="Scheduled Date">
            <TextInput type="date" name="scheduledFor" />
          </Field>

          <Field
            label="Meter at Service"
            hint={
              preVehicle
                ? `Current meter: ${meter(preVehicle.currentMeter, preVehicle.meterUnit)}`
                : "Defaults to the vehicle's current meter if left blank"
            }
          >
            <TextInput
              type="number"
              step="any"
              name="meterAtService"
              defaultValue={preVehicle ? preVehicle.currentMeter : undefined}
              placeholder="Vehicle current meter"
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Description">
              <TextArea
                name="description"
                placeholder="What needs to be done?"
                defaultValue={issue ? issue.summary : task ? task.name : undefined}
              />
            </Field>
          </div>

          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit">Create Work Order</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
