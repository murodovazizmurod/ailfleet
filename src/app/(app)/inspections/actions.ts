"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function opt(v: FormDataEntryValue | null): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
}

type BuilderItem = {
  label: string;
  type: string;
  required: boolean;
  options: string[];
};

export async function createInspectionForm(formData: FormData) {
  const title = opt(formData.get("title"));
  if (!title) throw new Error("Title is required");

  let items: BuilderItem[] = [];
  try {
    const parsed = JSON.parse(String(formData.get("itemsJson") ?? "[]"));
    if (Array.isArray(parsed)) items = parsed;
  } catch {
    items = [];
  }

  const form = await db.inspectionForm.create({
    data: {
      title,
      description: opt(formData.get("description")),
      items: {
        create: items
          .filter((it) => it.label && it.label.trim() !== "")
          .map((it, idx) => ({
            position: idx,
            label: it.label.trim(),
            type: it.type,
            required: Boolean(it.required),
            options:
              it.type === "dropdown" && it.options.length > 0
                ? JSON.stringify(it.options)
                : null,
          })),
      },
    },
  });

  revalidatePath("/inspections");
  redirect(`/inspections/forms/${form.id}`);
}

export type PerformResult = {
  itemId: string;
  passed: boolean | null;
  failed: boolean;
  value: string | null;
  comment: string | null;
};

export type PerformPayload = {
  formId: string;
  vehicleId: string;
  submittedById: string | null;
  startedAt: string; // ISO
  durationSec: number;
  results: PerformResult[];
};

export async function submitInspection(payload: PerformPayload) {
  const [form, vehicle] = await Promise.all([
    db.inspectionForm.findUnique({
      where: { id: payload.formId },
      include: { items: true },
    }),
    db.vehicle.findUnique({ where: { id: payload.vehicleId } }),
  ]);
  if (!form || !vehicle) throw new Error("Form or vehicle not found");

  const itemsById = new Map(form.items.map((it) => [it.id, it]));
  const results = payload.results.filter((r) => itemsById.has(r.itemId));
  const failedResults = results.filter((r) => r.failed);

  const submittedAt = new Date();
  const startedAt = payload.startedAt ? new Date(payload.startedAt) : submittedAt;

  const submission = await db.inspectionSubmission.create({
    data: {
      formId: form.id,
      vehicleId: vehicle.id,
      submittedById: payload.submittedById || null,
      startedAt,
      submittedAt,
      durationSec: Math.max(0, Math.round(payload.durationSec)),
      failedCount: failedResults.length,
    },
  });

  // Sequential issue numbering for auto-created issues
  const { _max } = await db.issue.aggregate({ _max: { number: true } });
  let nextNumber = (_max.number ?? 0) + 1;

  for (const r of results) {
    const item = itemsById.get(r.itemId)!;
    let issueId: string | null = null;

    if (r.failed && ["pass_fail", "dropdown", "number"].includes(item.type)) {
      const issue = await db.issue.create({
        data: {
          number: nextNumber++,
          vehicleId: vehicle.id,
          summary: `${item.label} — failed inspection`,
          description: r.comment
            ? `Failed during "${form.title}" inspection. Operator comment: ${r.comment}`
            : `Failed during "${form.title}" inspection.`,
          status: "open",
          priority: item.required ? "high" : "medium",
          source: "inspection",
          reportedById: payload.submittedById || null,
        },
      });
      issueId = issue.id;
    }

    await db.inspectionItemResult.create({
      data: {
        submissionId: submission.id,
        itemId: item.id,
        passed: r.passed,
        value: r.value,
        comment: r.comment,
        issueId,
      },
    });

    // Meter entries from meter-type items
    if (item.type === "meter" && r.value != null && r.value !== "") {
      const meterValue = parseFloat(r.value);
      if (!Number.isNaN(meterValue)) {
        await db.meterEntry.create({
          data: {
            vehicleId: vehicle.id,
            value: meterValue,
            date: submittedAt,
            meterType: "primary",
            source: "inspection",
          },
        });
        if (meterValue > vehicle.currentMeter) {
          await db.vehicle.update({
            where: { id: vehicle.id },
            data: { currentMeter: meterValue },
          });
        }
      }
    }
  }

  revalidatePath("/inspections");
  revalidatePath("/issues");
  redirect(`/inspections/submissions/${submission.id}`);
}
