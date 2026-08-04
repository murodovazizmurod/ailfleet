import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { VehicleForm } from "../VehicleForm";
import { createVehicle } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewVehiclePage() {
  const groups = await db.vehicleGroup.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New Vehicle" subtitle="Add a vehicle, equipment, or trailer to the fleet" />
      <VehicleForm action={createVehicle} groups={groups} submitLabel="Create Vehicle" />
    </div>
  );
}
