"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resetRemindersForTasks } from "@/lib/workorder";
import { promises as fs } from "fs";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".pdf", ".txt", ".csv"]);
const MAX_FILE_BYTES = 15 * 1024 * 1024;

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

type LinePayload = {
  taskId?: string;
  description?: string;
  laborCost?: number;
  partsCost?: number;
};

export async function createServiceEntry(formData: FormData) {
  const vehicleId = str(formData, "vehicleId");
  if (!vehicleId) return;

  const dateStr = str(formData, "date");
  const date = dateStr ? new Date(dateStr) : new Date();
  const startDateStr = str(formData, "startDate");
  const meterVal = numOf(formData, "meter");
  const discount = numOf(formData, "discount") ?? 0;
  const tax = numOf(formData, "tax") ?? 0;

  // Dynamic line items serialized by the client form
  let lines: LinePayload[] = [];
  try {
    const raw = str(formData, "linesJson");
    if (raw) lines = JSON.parse(raw) as LinePayload[];
  } catch {
    lines = [];
  }
  const cleanLines = lines
    .filter((l) => l.taskId || (l.description && l.description.trim() !== ""))
    .map((l) => {
      const laborCost = Number.isFinite(l.laborCost) ? Number(l.laborCost) : 0;
      const partsCost = Number.isFinite(l.partsCost) ? Number(l.partsCost) : 0;
      return {
        taskId: l.taskId || null,
        description: l.description?.trim() || null,
        laborCost,
        partsCost,
        cost: Math.round((laborCost + partsCost) * 100) / 100,
      };
    });

  const laborTotal = Math.round(cleanLines.reduce((s, l) => s + l.laborCost, 0) * 100) / 100;
  const partsTotal = Math.round(cleanLines.reduce((s, l) => s + l.partsCost, 0) * 100) / 100;
  const total = Math.round((laborTotal + partsTotal - discount + tax) * 100) / 100;

  const issueIds = (formData.getAll("issueIds") as string[]).filter(Boolean);

  const entry = await db.$transaction(async (tx) => {
    const created = await tx.serviceEntry.create({
      data: {
        vehicleId,
        date,
        startDate: startDateStr ? new Date(startDateStr) : null,
        repairClass: str(formData, "repairClass"),
        meter: meterVal,
        vendorId: str(formData, "vendorId"),
        reference: str(formData, "reference"),
        invoiceNumber: str(formData, "invoiceNumber"),
        notes: str(formData, "notes"),
        discount,
        tax,
        laborTotal,
        partsTotal,
        total,
        lines: { create: cleanLines },
      },
    });

    // Resolve the issues this service addressed
    if (issueIds.length > 0) {
      await tx.issue.updateMany({
        where: { id: { in: issueIds }, vehicleId },
        data: {
          status: "resolved",
          resolvedAt: date,
          resolvedNote: `Resolved by service entry on ${date.toISOString().slice(0, 10)}`,
        },
      });
      // Fault codes tied to those issues follow along
      await tx.faultCode.updateMany({
        where: { issueId: { in: issueIds } },
        data: { status: "resolved" },
      });
    }

    // Meter reading at service → meter history (only forward movement)
    if (meterVal != null) {
      const vehicle = await tx.vehicle.findUnique({ where: { id: vehicleId } });
      if (vehicle && meterVal > vehicle.currentMeter) {
        await tx.meterEntry.create({
          data: { vehicleId, value: meterVal, date, source: "work_order" },
        });
        await tx.vehicle.update({ where: { id: vehicleId }, data: { currentMeter: meterVal } });
      }
    }

    // Saving a service entry resets matching reminders, same as WO completion.
    await resetRemindersForTasks(
      tx,
      vehicleId,
      cleanLines.map((l) => l.taskId).filter((t): t is string => t != null),
      meterVal,
      date
    );

    return created;
  });

  // Invoice / receipt files → uploads dir + Document rows
  const files = formData.getAll("invoiceFiles").filter((f): f is File => f instanceof File);
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  for (const file of files) {
    if (!file.name || file.size === 0 || file.size > MAX_FILE_BYTES) continue;
    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) continue;
    const doc = await db.document.create({
      data: {
        entityType: "service_entry",
        entityId: entry.id,
        name: file.name,
        url: "", // filled below once the id exists
        sizeBytes: file.size,
      },
    });
    const buf = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(path.join(UPLOAD_DIR, `${doc.id}${ext}`), buf);
    await db.document.update({ where: { id: doc.id }, data: { url: `/api/files/${doc.id}` } });
  }

  const comment = str(formData, "comment");
  if (comment) {
    await db.comment.create({
      data: {
        entityType: "service_entry",
        entityId: entry.id,
        authorName: str(formData, "commentAuthor") ?? "Fleet Manager",
        body: comment,
      },
    });
  }

  revalidatePath("/service-entries");
  revalidatePath("/reminders");
  revalidatePath("/issues");

  const again = str(formData, "saveAndAddAnother");
  if (again === "1") redirect("/service-entries/new?saved=1");
  redirect(`/service-entries/${entry.id}`);
}

export async function addServiceEntryComment(formData: FormData) {
  const entryId = str(formData, "entryId");
  const body = str(formData, "body");
  if (!entryId || !body) return;
  await db.comment.create({
    data: {
      entityType: "service_entry",
      entityId: entryId,
      authorName: str(formData, "authorName") ?? "Fleet Manager",
      body,
    },
  });
  revalidatePath(`/service-entries/${entryId}`);
}
