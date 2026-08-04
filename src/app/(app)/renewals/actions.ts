"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function str(fd: FormData, name: string): string | null {
  const v = fd.get(name);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

function intVal(fd: FormData, name: string): number | null {
  const s = str(fd, name);
  if (s == null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function dateVal(fd: FormData, name: string): Date | null {
  const s = str(fd, name);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function createVehicleRenewal(formData: FormData) {
  const vehicleId = str(formData, "vehicleId");
  const dueDate = dateVal(formData, "dueDate");
  if (!vehicleId || !dueDate) {
    redirect(
      `/renewals?tab=vehicles&error=${encodeURIComponent("Vehicle and due date are required.")}`
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
  revalidatePath("/renewals");
  revalidatePath(`/vehicles/${vehicleId}`);
  redirect("/renewals?tab=vehicles");
}

export async function createContactRenewal(formData: FormData) {
  const contactId = str(formData, "contactId");
  const dueDate = dateVal(formData, "dueDate");
  if (!contactId || !dueDate) {
    redirect(
      `/renewals?tab=contacts&error=${encodeURIComponent("Contact and due date are required.")}`
    );
  }
  await db.contactRenewal.create({
    data: {
      contactId,
      type: str(formData, "type") ?? "custom",
      name: str(formData, "name"),
      dueDate,
      dueSoonDays: intVal(formData, "dueSoonDays") ?? 30,
    },
  });
  revalidatePath("/renewals");
  revalidatePath(`/contacts/${contactId}`);
  redirect("/renewals?tab=contacts");
}

export async function completeVehicleRenewal(id: string) {
  const renewal = await db.vehicleRenewal.update({
    where: { id },
    data: { completedAt: new Date(), status: "completed" },
  });
  revalidatePath("/renewals");
  revalidatePath(`/vehicles/${renewal.vehicleId}`);
}

export async function completeContactRenewal(id: string) {
  const renewal = await db.contactRenewal.update({
    where: { id },
    data: { completedAt: new Date(), status: "completed" },
  });
  revalidatePath("/renewals");
  revalidatePath(`/contacts/${renewal.contactId}`);
}
