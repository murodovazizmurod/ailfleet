"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

function numVal(fd: FormData, key: string): number | null {
  const s = str(fd, key);
  if (s == null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export async function createFuelEntry(formData: FormData) {
  const vehicleId = str(formData, "vehicleId");
  const meter = numVal(formData, "meter");
  const volume = numVal(formData, "volume");
  if (!vehicleId || meter == null || volume == null) {
    throw new Error("Vehicle, meter and volume are required");
  }

  const dateStr = str(formData, "date");
  const date = dateStr ? new Date(dateStr) : new Date();
  const pricePerUnit = numVal(formData, "pricePerUnit") ?? 0;
  const vendorId = str(formData, "vendorId");
  const reference = str(formData, "reference");
  const partial = formData.get("partial") === "on";
  const personal = formData.get("personal") === "on";

  const vehicle = await db.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) throw new Error("Vehicle not found");

  const total = volume * pricePerUnit;

  // Fuel economy vs the previous entry (by date) for this vehicle.
  let fuelEconomy: number | null = null;
  if (!partial) {
    const prev = await db.fuelEntry.findFirst({
      where: { vehicleId, date: { lt: date } },
      orderBy: { date: "desc" },
    });
    if (prev && !prev.partial && prev.meter != null) {
      const usage = meter - prev.meter;
      if (usage > 0 && volume > 0) fuelEconomy = usage / volume;
    }
  }

  // Exception flagging: volume exceeds tank capacity from vehicle specs.
  let flagged = false;
  let flagReason: string | null = null;
  try {
    const specs = JSON.parse(vehicle.specs ?? "{}");
    const capacity = Number(specs?.fuelTankCapacity);
    if (Number.isFinite(capacity) && capacity > 0 && volume > capacity) {
      flagged = true;
      flagReason = "Volume exceeds tank capacity";
    }
  } catch {
    // ignore malformed specs JSON
  }

  await db.fuelEntry.create({
    data: {
      vehicleId,
      date,
      vendorId,
      meter,
      volume,
      pricePerUnit,
      total,
      partial,
      personal,
      reference,
      source: "manual",
      fuelEconomy,
      flagged,
      flagReason,
    },
  });

  await db.meterEntry.create({
    data: { vehicleId, value: meter, date, source: "fuel_entry" },
  });

  if (meter > vehicle.currentMeter) {
    await db.vehicle.update({
      where: { id: vehicleId },
      data: { currentMeter: meter },
    });
  }

  revalidatePath("/fuel");
  redirect("/fuel");
}

export async function createChargingEntry(formData: FormData) {
  const vehicleId = str(formData, "vehicleId");
  const energyKwh = numVal(formData, "energyKwh");
  if (!vehicleId || energyKwh == null) {
    throw new Error("Vehicle and energy (kWh) are required");
  }

  const dateStr = str(formData, "date");
  const date = dateStr ? new Date(dateStr) : new Date();
  const durationMin = numVal(formData, "durationMin");
  const cost = numVal(formData, "cost") ?? 0;
  const location = str(formData, "location");

  await db.chargingEntry.create({
    data: {
      vehicleId,
      date,
      energyKwh,
      durationMin: durationMin == null ? null : Math.round(durationMin),
      cost,
      location,
      source: "manual",
    },
  });

  revalidatePath("/fuel");
  redirect("/fuel?tab=charging");
}
