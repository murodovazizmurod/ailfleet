import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { vehicleTitle, meter } from "@/lib/format";
import { PerformInspection } from "./PerformInspection";

export const dynamic = "force-dynamic";

export default async function PerformInspectionPage({
  searchParams,
}: {
  searchParams: Promise<{ formId?: string; vehicleId?: string }>;
}) {
  const { formId, vehicleId } = await searchParams;
  if (!formId || !vehicleId) redirect("/inspections/start");

  const [form, vehicle, contacts] = await Promise.all([
    db.inspectionForm.findUnique({
      where: { id: formId },
      include: { items: { orderBy: { position: "asc" } } },
    }),
    db.vehicle.findUnique({ where: { id: vehicleId } }),
    db.contact.findMany({
      where: { archived: false, isOperator: true },
      orderBy: { firstName: "asc" },
    }),
  ]);
  if (!form || !vehicle) redirect("/inspections/start");

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={form.title}
        subtitle={`${vehicle.name} — ${vehicleTitle(vehicle)} · Current meter: ${meter(
          vehicle.currentMeter,
          vehicle.meterUnit
        )}`}
      />
      <PerformInspection
        formId={form.id}
        vehicleId={vehicle.id}
        items={form.items.map((it) => ({
          id: it.id,
          type: it.type,
          label: it.label,
          instructions: it.instructions,
          required: it.required,
          options: (() => {
            try {
              const parsed = JSON.parse(it.options ?? "[]");
              return Array.isArray(parsed) ? (parsed as string[]) : [];
            } catch {
              return [];
            }
          })(),
        }))}
        contacts={contacts.map((c) => ({
          id: c.id,
          name: `${c.firstName} ${c.lastName}`,
        }))}
      />
    </div>
  );
}
