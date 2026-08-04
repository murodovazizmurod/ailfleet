"use server";

import { db } from "@/lib/db";
import { ADJUSTMENT_REASON } from "@/lib/enums";
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

export async function createPart(formData: FormData) {
  const number = str(formData, "number");
  if (!number) throw new Error("Part number is required");

  const unitCost = numVal(formData, "unitCost") ?? 0;
  const locationId = str(formData, "locationId");
  const initialQty = numVal(formData, "initialQty");
  const reorderPoint = numVal(formData, "reorderPoint");

  const part = await db.part.create({
    data: {
      number,
      description: str(formData, "description"),
      category: str(formData, "category"),
      manufacturer: str(formData, "manufacturer"),
      unitCost,
    },
  });

  if (locationId) {
    await db.partStock.create({
      data: {
        partId: part.id,
        locationId,
        quantity: initialQty ?? 0,
        reorderPoint,
      },
    });
    if (initialQty != null && initialQty !== 0) {
      await db.partAdjustment.create({
        data: {
          partId: part.id,
          locationId,
          delta: initialQty,
          reason: "correction",
          note: "Initial stock",
        },
      });
    }
  }

  revalidatePath("/parts");
  redirect(`/parts/${part.id}`);
}

export async function adjustStock(formData: FormData) {
  const partId = str(formData, "partId");
  const locationId = str(formData, "locationId");
  const newQuantity = numVal(formData, "newQuantity");
  const reason = str(formData, "reason");
  const note = str(formData, "note");

  if (!partId || !locationId || newQuantity == null || !reason) {
    throw new Error("Location, new quantity and reason are required");
  }
  if (!(reason in ADJUSTMENT_REASON)) throw new Error("Invalid adjustment reason");

  const stock = await db.partStock.findUnique({
    where: { partId_locationId: { partId, locationId } },
  });

  const currentQty = stock?.quantity ?? 0;
  const delta = newQuantity - currentQty;

  if (stock) {
    await db.partStock.update({
      where: { id: stock.id },
      data: { quantity: newQuantity },
    });
  } else {
    await db.partStock.create({
      data: { partId, locationId, quantity: newQuantity },
    });
  }

  if (delta !== 0) {
    await db.partAdjustment.create({
      data: { partId, locationId, delta, reason, note },
    });
  }

  revalidatePath("/parts");
  revalidatePath(`/parts/${partId}`);
}
