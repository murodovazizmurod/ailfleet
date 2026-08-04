"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  completeWorkOrder,
  reopenWorkOrder,
  recomputeWorkOrderTotals,
} from "@/lib/workorder";

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

function numOf(fd: FormData, key: string): number | null {
  const s = str(fd, key);
  if (s == null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function dateOf(fd: FormData, key: string): Date | null {
  const s = str(fd, key);
  if (s == null) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function revalidateWo(id: string) {
  revalidatePath("/work-orders");
  revalidatePath(`/work-orders/${id}`);
}

export async function createWorkOrder(formData: FormData) {
  const vehicleId = str(formData, "vehicleId");
  if (!vehicleId) return;

  const vehicle = await db.vehicle.findUniqueOrThrow({
    where: { id: vehicleId },
    select: { currentMeter: true },
  });

  const { _max } = await db.workOrder.aggregate({ _max: { number: true } });
  const number = (_max.number ?? 0) + 1;

  const wo = await db.workOrder.create({
    data: {
      number,
      vehicleId,
      description: str(formData, "description"),
      priority: str(formData, "priority") ?? "none",
      repairClass: str(formData, "repairClass") ?? "scheduled",
      assignedToId: str(formData, "assignedToId"),
      vendorId: str(formData, "vendorId"),
      scheduledFor: dateOf(formData, "scheduledFor"),
      meterAtService: numOf(formData, "meterAtService") ?? vehicle.currentMeter,
    },
  });

  const issueId = str(formData, "issueId");
  if (issueId) {
    await db.issue.update({
      where: { id: issueId },
      data: { workOrderId: wo.id },
    });
  }

  // Optional task preselect (e.g. arriving from a service reminder)
  const taskId = str(formData, "taskId");
  if (taskId) {
    await db.workOrderLine.create({
      data: { workOrderId: wo.id, taskId },
    });
  }

  revalidatePath("/work-orders");
  redirect(`/work-orders/${wo.id}`);
}

export async function setWorkOrderStatus(formData: FormData) {
  const id = str(formData, "id");
  const status = str(formData, "status");
  if (!id || !status) return;

  if (status === "completed") {
    await completeWorkOrder(id);
    revalidatePath("/service-entries");
    revalidatePath("/reminders");
    revalidatePath("/issues");
  } else if (status === "reopen") {
    await reopenWorkOrder(id);
    revalidatePath("/service-entries");
  } else {
    const wo = await db.workOrder.findUniqueOrThrow({
      where: { id },
      select: { startedAt: true },
    });
    await db.workOrder.update({
      where: { id },
      data: {
        status,
        startedAt:
          status === "in_progress" && !wo.startedAt ? new Date() : undefined,
      },
    });
  }
  revalidateWo(id);
}

export async function addWorkOrderLine(formData: FormData) {
  const workOrderId = str(formData, "workOrderId");
  if (!workOrderId) return;
  const taskId = str(formData, "taskId");
  const description = str(formData, "description");
  if (!taskId && !description) return;

  await db.workOrderLine.create({
    data: { workOrderId, taskId, description },
  });
  await recomputeWorkOrderTotals(workOrderId);
  revalidateWo(workOrderId);
}

export async function addLaborEntry(formData: FormData) {
  const workOrderId = str(formData, "workOrderId");
  const lineId = str(formData, "lineId");
  if (!workOrderId || !lineId) return;

  const hours = numOf(formData, "hours") ?? 0;
  const rate = numOf(formData, "rate") ?? 0;

  await db.workOrderLabor.create({
    data: {
      lineId,
      technicianId: str(formData, "technicianId"),
      hours,
      rate,
      cost: Math.round(hours * rate * 100) / 100,
    },
  });
  await recomputeWorkOrderTotals(workOrderId);
  revalidateWo(workOrderId);
}

export async function addPartEntry(formData: FormData) {
  const workOrderId = str(formData, "workOrderId");
  const lineId = str(formData, "lineId");
  const partId = str(formData, "partId");
  if (!workOrderId || !lineId || !partId) return;

  const part = await db.part.findUniqueOrThrow({
    where: { id: partId },
    select: { unitCost: true },
  });
  const quantity = numOf(formData, "quantity") ?? 1;
  const unitCost = numOf(formData, "unitCost") ?? part.unitCost;

  await db.workOrderPart.create({
    data: {
      lineId,
      partId,
      quantity,
      unitCost,
      cost: Math.round(quantity * unitCost * 100) / 100,
    },
  });
  await recomputeWorkOrderTotals(workOrderId);
  revalidateWo(workOrderId);
}

export async function attachIssue(formData: FormData) {
  const workOrderId = str(formData, "workOrderId");
  const issueId = str(formData, "issueId");
  if (!workOrderId || !issueId) return;

  await db.issue.update({
    where: { id: issueId },
    data: { workOrderId },
  });
  revalidateWo(workOrderId);
  revalidatePath("/issues");
}
