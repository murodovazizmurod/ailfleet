// Work order completion side-effects + totals recomputation.
// Keep all cross-entity mutations (issues, stock, service entries, reminders)
// in here so both the WO status actions and standalone service entries reuse it.

import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { addDays } from "date-fns";

type Tx = Prisma.TransactionClient;

export const WO_TAX_RATE = 0.07;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Reset every ServiceReminder matching (vehicleId, taskId in taskIds):
 * lastCompletedAt/lastCompletedMeter stamped, next dues pushed forward by the
 * reminder's own intervals, status back to "upcoming".
 * Reused by WO completion and standalone service entries.
 */
export async function resetRemindersForTasks(
  tx: Tx,
  vehicleId: string,
  taskIds: string[],
  meter: number | null,
  now: Date = new Date()
): Promise<void> {
  if (taskIds.length === 0) return;
  const reminders = await tx.serviceReminder.findMany({
    where: { vehicleId, taskId: { in: taskIds } },
  });
  for (const r of reminders) {
    await tx.serviceReminder.update({
      where: { id: r.id },
      data: {
        lastCompletedAt: now,
        lastCompletedMeter: meter,
        nextDueMeter:
          r.intervalMeter != null && meter != null
            ? meter + r.intervalMeter
            : r.nextDueMeter,
        nextDueDate:
          r.intervalDays != null ? addDays(now, r.intervalDays) : r.nextDueDate,
        status: "upcoming",
      },
    });
  }
}

/**
 * Recompute per-line laborCost/partsCost/subtotal and the WO's
 * laborTotal/partsTotal/subtotal/tax (7%)/total. Call after every
 * line/labor/part mutation.
 */
export async function recomputeWorkOrderTotals(workOrderId: string): Promise<void> {
  const lines = await db.workOrderLine.findMany({
    where: { workOrderId },
    include: { laborLines: true, partLines: true },
  });
  let laborTotal = 0;
  let partsTotal = 0;
  for (const line of lines) {
    const laborCost = round2(line.laborLines.reduce((s, l) => s + l.cost, 0));
    const partsCost = round2(line.partLines.reduce((s, p) => s + p.cost, 0));
    const subtotal = round2(laborCost + partsCost);
    if (
      laborCost !== line.laborCost ||
      partsCost !== line.partsCost ||
      subtotal !== line.subtotal
    ) {
      await db.workOrderLine.update({
        where: { id: line.id },
        data: { laborCost, partsCost, subtotal },
      });
    }
    laborTotal += laborCost;
    partsTotal += partsCost;
  }
  laborTotal = round2(laborTotal);
  partsTotal = round2(partsTotal);
  const subtotal = round2(laborTotal + partsTotal);
  const tax = round2(subtotal * WO_TAX_RATE);
  await db.workOrder.update({
    where: { id: workOrderId },
    data: { laborTotal, partsTotal, subtotal, tax, total: round2(subtotal + tax) },
  });
}

/**
 * Complete a work order with all side effects, atomically:
 * 1. status → completed, completedAt stamped
 * 2. all linked open/overdue issues resolved ("Resolved by WO #N")
 * 3. stock decremented at the first location with stock for each WO part
 *    (+ PartAdjustment reason "used")
 * 4. ServiceEntry (+ line per WO line) auto-generated
 * 5. matching ServiceReminders reset
 */
export async function completeWorkOrder(id: string): Promise<void> {
  // Totals may be stale if lines were created outside the add-labor/add-part
  // actions (imports, API) — the generated ServiceEntry copies them.
  await recomputeWorkOrderTotals(id);
  const wo = await db.workOrder.findUniqueOrThrow({
    where: { id },
    include: {
      lines: { include: { partLines: true } },
      serviceEntry: { select: { id: true } },
    },
  });
  const now = new Date();

  await db.$transaction(async (tx) => {
    await tx.workOrder.update({
      where: { id },
      data: {
        status: "completed",
        completedAt: now,
        startedAt: wo.startedAt ?? now,
      },
    });

    await tx.issue.updateMany({
      where: { workOrderId: id, status: { in: ["open", "overdue"] } },
      data: {
        status: "resolved",
        resolvedAt: now,
        resolvedNote: `Resolved by WO #${wo.number}`,
      },
    });

    for (const line of wo.lines) {
      for (const wp of line.partLines) {
        const stock = await tx.partStock.findFirst({
          where: { partId: wp.partId, quantity: { gt: 0 } },
        });
        if (stock) {
          await tx.partStock.update({
            where: { id: stock.id },
            data: { quantity: stock.quantity - wp.quantity },
          });
          await tx.partAdjustment.create({
            data: {
              partId: wp.partId,
              locationId: stock.locationId,
              delta: -wp.quantity,
              reason: "used",
              note: `WO #${wo.number}`,
            },
          });
        }
      }
    }

    // Guard against double-completion leaving a duplicate entry
    // (workOrderId is unique on ServiceEntry).
    if (!wo.serviceEntry) {
      await tx.serviceEntry.create({
        data: {
          vehicleId: wo.vehicleId,
          workOrderId: wo.id,
          date: now,
          meter: wo.meterAtService,
          vendorId: wo.vendorId,
          notes: `Auto-generated from WO #${wo.number}`,
          laborTotal: wo.laborTotal,
          partsTotal: wo.partsTotal,
          total: wo.total,
          lines: {
            create: wo.lines.map((l) => ({
              taskId: l.taskId,
              description: l.description,
              cost: l.subtotal,
            })),
          },
        },
      });
    }

    const taskIds = wo.lines
      .map((l) => l.taskId)
      .filter((t): t is string => t != null);
    await resetRemindersForTasks(tx, wo.vehicleId, taskIds, wo.meterAtService, now);
  });
}

/**
 * Reopen a completed work order: delete its auto-generated ServiceEntry
 * (lines cascade), status back to open, completedAt cleared.
 * NOTE: issues resolved at completion are intentionally left as-is —
 * reopening does not un-resolve them.
 */
export async function reopenWorkOrder(id: string): Promise<void> {
  const wo = await db.workOrder.findUniqueOrThrow({
    where: { id },
    include: { serviceEntry: { select: { id: true } } },
  });
  await db.$transaction(async (tx) => {
    if (wo.serviceEntry) {
      await tx.serviceEntry.delete({ where: { id: wo.serviceEntry.id } });
    }
    await tx.workOrder.update({
      where: { id },
      data: { status: "open", completedAt: null },
    });
  });
}
