"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function opt(v: FormDataEntryValue | null): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
}

export async function createIssue(formData: FormData) {
  const vehicleId = opt(formData.get("vehicleId"));
  const summary = opt(formData.get("summary"));
  if (!vehicleId || !summary) throw new Error("Vehicle and summary are required");

  const { _max } = await db.issue.aggregate({ _max: { number: true } });
  const dueDate = opt(formData.get("dueDate"));
  const dueMeter = opt(formData.get("dueMeter"));

  const issue = await db.issue.create({
    data: {
      number: (_max.number ?? 0) + 1,
      vehicleId,
      summary,
      description: opt(formData.get("description")),
      priority: opt(formData.get("priority")) ?? "none",
      source: "manual",
      assignedToId: opt(formData.get("assignedToId")),
      reportedById: opt(formData.get("reportedById")),
      dueDate: dueDate ? new Date(dueDate) : null,
      dueMeter: dueMeter ? parseFloat(dueMeter) : null,
    },
  });

  revalidatePath("/issues");
  redirect(`/issues/${issue.id}`);
}

export async function resolveIssue(formData: FormData) {
  const id = String(formData.get("issueId") ?? "");
  if (!id) return;
  await db.issue.update({
    where: { id },
    data: {
      status: "resolved",
      resolvedAt: new Date(),
      resolvedNote: opt(formData.get("resolvedNote")),
    },
  });
  revalidatePath(`/issues/${id}`);
  revalidatePath("/issues");
}

export async function closeIssue(formData: FormData) {
  const id = String(formData.get("issueId") ?? "");
  if (!id) return;
  await db.issue.update({
    where: { id },
    data: { status: "closed" },
  });
  revalidatePath(`/issues/${id}`);
  revalidatePath("/issues");
}

export async function reopenIssue(formData: FormData) {
  const id = String(formData.get("issueId") ?? "");
  if (!id) return;
  await db.issue.update({
    where: { id },
    data: { status: "open", resolvedAt: null, resolvedNote: null },
  });
  revalidatePath(`/issues/${id}`);
  revalidatePath("/issues");
}

export async function addIssueToWorkOrder(formData: FormData) {
  const id = String(formData.get("issueId") ?? "");
  const workOrderId = opt(formData.get("workOrderId"));
  if (!id || !workOrderId) return;
  await db.issue.update({
    where: { id },
    data: { workOrderId },
  });
  revalidatePath(`/issues/${id}`);
  revalidatePath("/issues");
}

export async function addIssueComment(formData: FormData) {
  const id = String(formData.get("issueId") ?? "");
  const body = opt(formData.get("body"));
  if (!id || !body) return;
  await db.comment.create({
    data: {
      entityType: "issue",
      entityId: id,
      authorName: opt(formData.get("authorName")) ?? "Fleet Manager",
      body,
    },
  });
  revalidatePath(`/issues/${id}`);
}
