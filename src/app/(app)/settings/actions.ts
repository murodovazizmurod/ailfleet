"use server";

import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function opt(v: FormDataEntryValue | null): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
}

// ── Company settings ─────────────────────────────────────────────

const COMPANY_KEYS = ["company_name", "currency", "distance_unit"] as const;

export async function updateCompanySettings(formData: FormData) {
  for (const key of COMPANY_KEYS) {
    const value = opt(formData.get(key));
    if (value == null) continue;
    await db.accountSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
  revalidatePath("/settings");
}

// ── API tokens ───────────────────────────────────────────────────

export async function createApiToken(formData: FormData) {
  const name = opt(formData.get("name")) ?? "API Token";
  const plaintext = `aif_${randomBytes(16).toString("hex")}`;
  const tokenHash = createHash("sha256").update(plaintext).digest("hex");

  await db.apiToken.create({
    data: {
      name,
      tokenHash,
      prefix: plaintext.slice(0, 12),
    },
  });

  revalidatePath("/settings");
  // plaintext is shown exactly once via the ?created= banner — only the hash is stored
  redirect(`/settings?created=${encodeURIComponent(plaintext)}`);
}

export async function revokeApiToken(formData: FormData) {
  const id = String(formData.get("tokenId") ?? "");
  if (!id) return;
  await db.apiToken.update({
    where: { id },
    data: { revokedAt: new Date() },
  });
  revalidatePath("/settings");
}

// ── Webhooks ─────────────────────────────────────────────────────

export async function createWebhook(formData: FormData) {
  const url = opt(formData.get("url"));
  if (!url) return;
  const secret = opt(formData.get("secret")) ?? randomBytes(16).toString("hex");
  const events = formData
    .getAll("events")
    .map((e) => String(e))
    .filter(Boolean);
  if (events.length === 0) return;

  await db.webhook.create({
    data: { url, secret, events: JSON.stringify(events) },
  });
  revalidatePath("/settings");
}

export async function toggleWebhook(formData: FormData) {
  const id = String(formData.get("webhookId") ?? "");
  if (!id) return;
  const hook = await db.webhook.findUnique({ where: { id } });
  if (!hook) return;
  await db.webhook.update({
    where: { id },
    data: { active: !hook.active },
  });
  revalidatePath("/settings");
}

export async function deleteWebhook(formData: FormData) {
  const id = String(formData.get("webhookId") ?? "");
  if (!id) return;
  await db.webhook.delete({ where: { id } });
  revalidatePath("/settings");
}
