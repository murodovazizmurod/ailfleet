import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { vehicleTitle } from "@/lib/format";
import { ServiceEntryForm } from "../ServiceEntryForm";

export const dynamic = "force-dynamic";

export default async function NewServiceEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ vehicleId?: string; saved?: string }>;
}) {
  const { vehicleId, saved } = await searchParams;

  const [vehicles, issues, tasks, vendors] = await Promise.all([
    db.vehicle.findMany({ where: { archived: false }, orderBy: { name: "asc" } }),
    db.issue.findMany({
      where: { status: { in: ["open", "overdue"] } },
      orderBy: { number: "desc" },
      select: { id: true, number: true, summary: true, vehicleId: true },
    }),
    db.serviceTask.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.vendor.findMany({
      where: { archived: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true, classifications: true },
    }),
  ]);

  const serviceVendors = vendors.filter((v) => {
    try {
      const c = v.classifications ? (JSON.parse(v.classifications) as string[]) : [];
      return c.length === 0 || c.includes("service");
    } catch {
      return true;
    }
  });

  return (
    <div>
      <PageHeader title="New Service Entry" subtitle="Log completed maintenance or repair work" />
      {saved ? (
        <div className="mx-auto mb-4 max-w-3xl rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Service entry saved.
        </div>
      ) : null}
      <ServiceEntryForm
        vehicles={vehicles.map((v) => ({
          id: v.id,
          name: v.name,
          title: vehicleTitle(v),
          currentMeter: v.currentMeter,
          meterUnit: v.meterUnit,
        }))}
        issues={issues}
        tasks={tasks}
        vendors={serviceVendors.map((v) => ({ id: v.id, name: v.name }))}
        preselectVehicleId={vehicleId}
      />
    </div>
  );
}
