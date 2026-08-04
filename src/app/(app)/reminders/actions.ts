"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addDays } from "date-fns";

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

export async function toggleSnooze(formData: FormData) {
  const id = str(formData, "id");
  const snooze = str(formData, "snooze") === "true";
  if (!id) return;

  await db.serviceReminder.update({
    where: { id },
    data: { status: snooze ? "snoozed" : "upcoming" },
  });
  revalidatePath("/reminders");
}

export async function createReminder(formData: FormData) {
  const vehicleId = str(formData, "vehicleId");
  const taskId = str(formData, "taskId");
  if (!vehicleId || !taskId) return;

  const vehicle = await db.vehicle.findUniqueOrThrow({
    where: { id: vehicleId },
    select: { currentMeter: true },
  });

  const intervalMeter = numOf(formData, "intervalMeter");
  const intervalDays = numOf(formData, "intervalDays");

  const firstDueMeter = numOf(formData, "firstDueMeter");
  const firstDueDateStr = str(formData, "firstDueDate");

  const nextDueMeter =
    firstDueMeter ??
    (intervalMeter != null ? vehicle.currentMeter + intervalMeter : null);
  const nextDueDate = firstDueDateStr
    ? new Date(firstDueDateStr)
    : intervalDays != null
      ? addDays(new Date(), intervalDays)
      : null;

  await db.serviceReminder.create({
    data: {
      vehicleId,
      taskId,
      intervalMeter,
      intervalDays: intervalDays != null ? Math.round(intervalDays) : null,
      nextDueMeter,
      nextDueDate,
      status: "upcoming",
    },
  });

  revalidatePath("/reminders");
  redirect("/reminders");
}
