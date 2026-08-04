"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// ── FormData helpers ─────────────────────────────────────────────

function str(fd: FormData, name: string): string | null {
  const v = fd.get(name);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

function numVal(fd: FormData, name: string): number | null {
  const s = str(fd, name);
  if (s == null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function intVal(fd: FormData, name: string): number | null {
  const n = numVal(fd, name);
  return n == null ? null : Math.trunc(n);
}

function dateVal(fd: FormData, name: string): Date | null {
  const s = str(fd, name);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function vehicleData(fd: FormData) {
  return {
    name: str(fd, "name") ?? "Unnamed vehicle",
    assetType: str(fd, "assetType") ?? "vehicle",
    status: str(fd, "status") ?? "active",
    groupId: str(fd, "groupId"),
    year: intVal(fd, "year"),
    make: str(fd, "make"),
    model: str(fd, "model"),
    trim: str(fd, "trim"),
    vin: str(fd, "vin"),
    licensePlate: str(fd, "licensePlate"),
    color: str(fd, "color"),
    fuelType: str(fd, "fuelType"),
    meterUnit: str(fd, "meterUnit") ?? "mi",
    currentMeter: numVal(fd, "currentMeter") ?? 0,
    ownership: str(fd, "ownership") ?? "owned",
    purchaseDate: dateVal(fd, "purchaseDate"),
    purchasePrice: numVal(fd, "purchasePrice"),
  };
}

// ── Vehicle create / update ──────────────────────────────────────

export async function createVehicle(formData: FormData) {
  const vehicle = await db.vehicle.create({ data: vehicleData(formData) });
  revalidatePath("/vehicles");
  redirect(`/vehicles/${vehicle.id}`);
}

export async function updateVehicle(id: string, formData: FormData) {
  await db.vehicle.update({ where: { id }, data: vehicleData(formData) });
  revalidatePath("/vehicles");
  revalidatePath(`/vehicles/${id}`);
  redirect(`/vehicles/${id}`);
}

// ── Meter entries ────────────────────────────────────────────────

export async function addMeterEntry(vehicleId: string, formData: FormData) {
  const value = numVal(formData, "value");
  if (value == null) {
    redirect(
      `/vehicles/${vehicleId}?tab=meters&error=${encodeURIComponent("Meter value is required.")}`
    );
  }
  const date = dateVal(formData, "date") ?? new Date();

  // Monotonic validation: a new entry must be >= the max non-void primary value.
  const agg = await db.meterEntry.aggregate({
    where: { vehicleId, meterType: "primary", void: false },
    _max: { value: true },
  });
  const max = agg._max.value ?? 0;
  if (value < max) {
    redirect(
      `/vehicles/${vehicleId}?tab=meters&error=${encodeURIComponent(
        `Meter value must be at least the latest reading (${max}). Entry rejected.`
      )}`
    );
  }

  await db.$transaction([
    db.meterEntry.create({
      data: { vehicleId, value, date, meterType: "primary", source: "manual" },
    }),
    db.vehicle.update({ where: { id: vehicleId }, data: { currentMeter: value } }),
  ]);

  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath("/vehicles");
  redirect(`/vehicles/${vehicleId}?tab=meters`);
}

// ── Assignments ──────────────────────────────────────────────────

export async function assignOperator(vehicleId: string, formData: FormData) {
  const contactId = str(formData, "contactId");
  if (!contactId) {
    redirect(
      `/vehicles/${vehicleId}?tab=assignments&error=${encodeURIComponent(
        "Choose an operator to assign."
      )}`
    );
  }
  const now = new Date();
  await db.$transaction([
    // one operator at a time — end any current assignment first
    db.vehicleAssignment.updateMany({
      where: { vehicleId, current: true },
      data: { current: false, endedAt: now },
    }),
    db.vehicleAssignment.create({
      data: { vehicleId, contactId, startedAt: now, current: true },
    }),
  ]);
  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath("/vehicles");
  revalidatePath("/contacts");
  redirect(`/vehicles/${vehicleId}?tab=assignments`);
}

// ── Expenses ─────────────────────────────────────────────────────

export async function addExpense(vehicleId: string, formData: FormData) {
  const amount = numVal(formData, "amount");
  const type = str(formData, "type") ?? "other";
  if (amount == null) {
    redirect(
      `/vehicles/${vehicleId}?tab=expenses&error=${encodeURIComponent("Amount is required.")}`
    );
  }
  await db.expenseEntry.create({
    data: {
      vehicleId,
      type,
      amount,
      date: dateVal(formData, "date") ?? new Date(),
      vendorId: str(formData, "vendorId"),
      notes: str(formData, "notes"),
    },
  });
  revalidatePath(`/vehicles/${vehicleId}`);
  redirect(`/vehicles/${vehicleId}?tab=expenses`);
}

// ── Vehicle renewals (from vehicle detail) ───────────────────────

export async function addVehicleRenewal(vehicleId: string, formData: FormData) {
  const dueDate = dateVal(formData, "dueDate");
  if (!dueDate) {
    redirect(
      `/vehicles/${vehicleId}?tab=renewals&error=${encodeURIComponent("Due date is required.")}`
    );
  }
  await db.vehicleRenewal.create({
    data: {
      vehicleId,
      type: str(formData, "type") ?? "custom",
      name: str(formData, "name"),
      dueDate,
      dueSoonDays: intVal(formData, "dueSoonDays") ?? 30,
    },
  });
  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath("/renewals");
  redirect(`/vehicles/${vehicleId}?tab=renewals`);
}
