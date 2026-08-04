"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resetRemindersForTasks } from "@/lib/workorder";

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

export async function createServiceEntry(formData: FormData) {
  const vehicleId = str(formData, "vehicleId");
  if (!vehicleId) return;

  const dateStr = str(formData, "date");
  const date = dateStr ? new Date(dateStr) : new Date();
  const meterVal = numOf(formData, "meter");

  // Up to 5 statically-rendered task rows: task_0..task_4 / cost_0..cost_4
  const lines: { taskId: string; cost: number }[] = [];
  for (let i = 0; i < 5; i++) {
    const taskId = str(formData, `task_${i}`);
    if (!taskId) continue;
    lines.push({ taskId, cost: numOf(formData, `cost_${i}`) ?? 0 });
  }

  const total = Math.round(lines.reduce((s, l) => s + l.cost, 0) * 100) / 100;

  await db.$transaction(async (tx) => {
    await tx.serviceEntry.create({
      data: {
        vehicleId,
        date,
        meter: meterVal,
        vendorId: str(formData, "vendorId"),
        reference: str(formData, "reference"),
        notes: str(formData, "notes"),
        total,
        lines: { create: lines },
      },
    });

    // Saving a service entry resets matching reminders, same as WO completion.
    await resetRemindersForTasks(
      tx,
      vehicleId,
      lines.map((l) => l.taskId),
      meterVal,
      date
    );
  });

  revalidatePath("/service-entries");
  revalidatePath("/reminders");
  redirect("/service-entries");
}
