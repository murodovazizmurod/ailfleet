import { db } from "@/lib/db";
import { dispatchEvent } from "@/lib/webhooks";

export type FuelCardSyncSummary = {
  fuelEntriesCreated: number;
  metersCreated: number;
};

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Simulated fuel-card transaction import: picks 2–3 random non-electric
 * vehicles and creates a fuel entry (source "fuel_card") with a matching
 * meter entry (source "fuel_entry"), advancing the vehicle's odometer.
 * Fuel economy is computed against the vehicle's previous fuel entry.
 */
export async function runFuelCardSync(connectionId: string): Promise<FuelCardSyncSummary> {
  const summary: FuelCardSyncSummary = { fuelEntriesCreated: 0, metersCreated: 0 };

  const candidates = await db.vehicle.findMany({
    where: {
      archived: false,
      OR: [{ fuelType: null }, { fuelType: { not: "electric" } }],
    },
  });

  // shuffle and take 2–3
  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, Math.min(shuffled.length, Math.random() < 0.5 ? 2 : 3));

  const fuelVendors = (
    await db.vendor.findMany({ where: { archived: false } })
  ).filter((v) => {
    try {
      const classifications: unknown = JSON.parse(v.classifications ?? "[]");
      return Array.isArray(classifications) && classifications.includes("fuel");
    } catch {
      return false;
    }
  });

  for (const vehicle of picked) {
    const previous = await db.fuelEntry.findFirst({
      where: { vehicleId: vehicle.id, meter: { not: null } },
      orderBy: { date: "desc" },
    });

    const meter = Math.round(vehicle.currentMeter + rand(40, 200));
    const volume = round2(rand(10, 25));
    const pricePerUnit = round2(rand(3.4, 4.1));
    const total = round2(volume * pricePerUnit);
    const vendor =
      fuelVendors.length > 0
        ? fuelVendors[Math.floor(Math.random() * fuelVendors.length)]
        : null;

    // distance since previous fill-up / volume of this fill-up (MPG-style)
    const fuelEconomy =
      previous?.meter != null && meter > previous.meter
        ? round2((meter - previous.meter) / volume)
        : null;

    const entry = await db.fuelEntry.create({
      data: {
        vehicleId: vehicle.id,
        meter,
        volume,
        pricePerUnit,
        total,
        vendorId: vendor?.id ?? null,
        source: "fuel_card",
        fuelEconomy,
        reference: `CARD-${Math.floor(rand(100000, 999999))}`,
      },
    });
    summary.fuelEntriesCreated += 1;

    await db.meterEntry.create({
      data: { vehicleId: vehicle.id, value: meter, source: "fuel_entry" },
    });
    summary.metersCreated += 1;

    await db.vehicle.update({
      where: { id: vehicle.id },
      data: { currentMeter: meter },
    });

    void dispatchEvent("fuel_entry.created", {
      id: entry.id,
      vehicle_id: entry.vehicleId,
      date: entry.date,
      meter: entry.meter,
      volume: entry.volume,
      price_per_unit: entry.pricePerUnit,
      total: entry.total,
      vendor_id: entry.vendorId,
      source: entry.source,
    });
  }

  await db.integrationConnection.update({
    where: { id: connectionId },
    data: { lastSyncAt: new Date(), status: "connected", lastError: null },
  });

  return summary;
}
