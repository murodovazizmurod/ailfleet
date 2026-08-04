"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const TAX_RATE = 0.07;

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

export async function createPurchaseOrder(formData: FormData) {
  const vendorId = str(formData, "vendorId");
  if (!vendorId) throw new Error("Vendor is required");
  const description = str(formData, "description");

  // Collect up to 6 static line rows.
  const lines: { partId: string; quantity: number; unitCost: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const partId = str(formData, `part_${i}`);
    if (!partId) continue;
    const quantity = numVal(formData, `qty_${i}`) ?? 1;
    if (quantity <= 0) continue;
    let unitCost = numVal(formData, `cost_${i}`);
    if (unitCost == null) {
      const part = await db.part.findUnique({ where: { id: partId } });
      unitCost = part?.unitCost ?? 0;
    }
    lines.push({ partId, quantity, unitCost });
  }
  if (lines.length === 0) throw new Error("At least one line item is required");

  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitCost, 0);
  const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
  const total = subtotal + tax;

  const { _max } = await db.purchaseOrder.aggregate({ _max: { number: true } });
  const number = (_max.number ?? 0) + 1;

  const po = await db.purchaseOrder.create({
    data: {
      number,
      vendorId,
      status: "draft",
      description,
      subtotal,
      tax,
      total,
      lines: { create: lines },
    },
  });

  revalidatePath("/purchase-orders");
  redirect(`/purchase-orders/${po.id}`);
}

async function setStatus(
  formData: FormData,
  fromStatuses: string[],
  toStatus: string,
  extra: Record<string, Date> = {}
) {
  const id = str(formData, "id");
  if (!id) throw new Error("Missing purchase order id");
  const po = await db.purchaseOrder.findUnique({ where: { id } });
  if (!po) throw new Error("Purchase order not found");
  if (!fromStatuses.includes(po.status)) {
    throw new Error(`Cannot move a ${po.status} purchase order to ${toStatus}`);
  }
  await db.purchaseOrder.update({
    where: { id },
    data: { status: toStatus, ...extra },
  });
  revalidatePath("/purchase-orders");
  revalidatePath(`/purchase-orders/${id}`);
}

export async function submitForApproval(formData: FormData) {
  await setStatus(formData, ["draft"], "pending_approval");
}

export async function approvePurchaseOrder(formData: FormData) {
  await setStatus(formData, ["pending_approval"], "approved", {
    approvedAt: new Date(),
  });
}

export async function rejectPurchaseOrder(formData: FormData) {
  await setStatus(formData, ["pending_approval"], "rejected");
}

export async function markPurchased(formData: FormData) {
  await setStatus(formData, ["approved"], "purchased", { purchasedAt: new Date() });
}

export async function closePurchaseOrder(formData: FormData) {
  await setStatus(formData, ["received_full", "received_partial"], "closed");
}

export async function receiveLines(formData: FormData) {
  const id = str(formData, "id");
  if (!id) throw new Error("Missing purchase order id");

  const po = await db.purchaseOrder.findUnique({
    where: { id },
    include: { lines: true },
  });
  if (!po) throw new Error("Purchase order not found");
  if (!["purchased", "received_partial"].includes(po.status)) {
    throw new Error("Only purchased orders can be received");
  }

  const firstLocation = await db.inventoryLocation.findFirst({
    orderBy: { name: "asc" },
  });

  let receivedAnything = false;

  for (const line of po.lines) {
    const input = numVal(formData, `receive_${line.id}`);
    if (input == null || input <= 0) continue;
    const remaining = line.quantity - line.received;
    const qty = Math.min(input, Math.max(remaining, 0));
    if (qty <= 0) continue;

    receivedAnything = true;

    await db.purchaseOrderLine.update({
      where: { id: line.id },
      data: { received: { increment: qty } },
    });

    await db.partAdjustment.create({
      data: {
        partId: line.partId,
        locationId: firstLocation?.id ?? null,
        delta: qty,
        reason: "received",
        note: `Received on PO #${po.number}`,
      },
    });

    if (firstLocation) {
      const stock = await db.partStock.findUnique({
        where: {
          partId_locationId: { partId: line.partId, locationId: firstLocation.id },
        },
      });
      if (stock) {
        await db.partStock.update({
          where: { id: stock.id },
          data: { quantity: { increment: qty } },
        });
      } else {
        await db.partStock.create({
          data: {
            partId: line.partId,
            locationId: firstLocation.id,
            quantity: qty,
          },
        });
      }
    }
  }

  if (receivedAnything) {
    const updated = await db.purchaseOrder.findUnique({
      where: { id },
      include: { lines: true },
    });
    const allReceived = updated!.lines.every((l) => l.received >= l.quantity);
    await db.purchaseOrder.update({
      where: { id },
      data: allReceived
        ? { status: "received_full", receivedAt: new Date() }
        : { status: "received_partial" },
    });
  }

  revalidatePath("/purchase-orders");
  revalidatePath(`/purchase-orders/${id}`);
  revalidatePath("/parts");
}
