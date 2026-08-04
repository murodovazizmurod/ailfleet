import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Select } from "@/components/ui/FormField";
import { vehicleTitle } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function StartInspectionPage({
  searchParams,
}: {
  searchParams: Promise<{ formId?: string; vehicleId?: string }>;
}) {
  const sp = await searchParams;

  const [forms, vehicles] = await Promise.all([
    db.inspectionForm.findMany({
      where: { archived: false },
      include: { _count: { select: { items: true } } },
      orderBy: { title: "asc" },
    }),
    db.vehicle.findMany({ where: { archived: false }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="Start Inspection"
        subtitle="Choose a form and the vehicle being inspected"
      />
      <Card>
        <form method="get" action="/inspections/perform" className="grid gap-4">
          <Field label="Inspection Form" required>
            <Select name="formId" required defaultValue={sp.formId ?? ""}>
              <option value="" disabled>
                Select a form…
              </option>
              {forms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title} ({f._count.items} items)
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Vehicle" required>
            <Select name="vehicleId" required defaultValue={sp.vehicleId ?? ""}>
              <option value="" disabled>
                Select a vehicle…
              </option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} — {vehicleTitle(v)}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex justify-end border-t border-slate-100 pt-4">
            <Button type="submit">Begin Inspection</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
