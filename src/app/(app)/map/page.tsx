import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { vehicleTitle } from "@/lib/format";
import { MapView, type MapVehicle } from "./MapView";

export const dynamic = "force-dynamic";

function readTelemetry(customFields: string | null): {
  engineState: string | null;
  fuelPercent: number | null;
} {
  try {
    const parsed = customFields ? JSON.parse(customFields) : {};
    const t = parsed.telemetry ?? {};
    return {
      engineState: typeof t.engineState === "string" ? t.engineState : null,
      fuelPercent: typeof t.fuelPercent === "number" ? t.fuelPercent : null,
    };
  } catch {
    return { engineState: null, fuelPercent: null };
  }
}

export default async function MapPage() {
  const vehicles = await db.vehicle.findMany({
    where: { archived: false },
    include: {
      locationEntries: { orderBy: { date: "desc" }, take: 1 },
      assignments: {
        where: { current: true },
        include: { contact: true },
        take: 1,
      },
    },
  });

  const mapVehicles: MapVehicle[] = vehicles
    .filter((v) => v.locationEntries.length > 0)
    .map((v) => {
      const loc = v.locationEntries[0];
      const telemetry = readTelemetry(v.customFields);
      const driver = v.assignments[0]?.contact;
      return {
        id: v.id,
        name: v.name,
        title: vehicleTitle(v),
        status: v.status,
        lat: loc.latitude,
        lng: loc.longitude,
        speedMph: loc.speedMph,
        heading: loc.heading,
        address: loc.address,
        updatedAt: loc.date.toISOString(),
        engineState: telemetry.engineState,
        fuelPercent: telemetry.fuelPercent,
        driver: driver ? `${driver.firstName} ${driver.lastName}` : null,
      };
    });

  const running = mapVehicles.filter((v) => v.engineState === "On").length;
  const idling = mapVehicles.filter((v) => v.engineState === "Idle").length;

  return (
    <div>
      <PageHeader
        title="Live Map"
        subtitle={`${mapVehicles.length} vehicles with GPS · ${running} running · ${idling} idling — refreshes every 60s`}
        actions={<ButtonLink href="/integrations" variant="secondary">Sync now → Integrations</ButtonLink>}
      />
      {mapVehicles.length === 0 ? (
        <EmptyState
          title="No vehicle locations yet"
          hint="Connect a telematics integration and run a sync to see your fleet on the map."
          action={<ButtonLink href="/integrations">Open Integrations</ButtonLink>}
        />
      ) : (
        <>
          <div className="mb-3 flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#a3e635]" /> Running
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#fbbf24]" /> Idling
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#7e8ca0]" /> Off
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#f87171]" /> In shop / out of service
            </span>
          </div>
          <MapView vehicles={mapVehicles} />
        </>
      )}
    </div>
  );
}
