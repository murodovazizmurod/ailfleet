import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { VehicleForm } from "../../VehicleForm";
import { updateVehicle } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditVehiclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [vehicle, groups] = await Promise.all([
    db.vehicle.findUnique({ where: { id } }),
    db.vehicleGroup.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!vehicle) notFound();

  const action = updateVehicle.bind(null, vehicle.id);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={`Edit ${vehicle.name}`} subtitle="Update vehicle details" />
      <VehicleForm action={action} groups={groups} vehicle={vehicle} submitLabel="Save Changes" />
    </div>
  );
}
