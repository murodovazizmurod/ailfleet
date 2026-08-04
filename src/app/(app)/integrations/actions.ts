"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { providerDef } from "@/lib/integrations/providers";
import { runTelematicsSync } from "@/lib/integrations/telematics";
import { runFuelCardSync } from "@/lib/integrations/fuelcards";
import {
  readSamsaraConfig,
  resolveSamsaraToken,
  runSamsaraSync,
  testSamsaraConnection,
} from "@/lib/integrations/samsara";

export async function connectIntegration(formData: FormData) {
  const provider = String(formData.get("provider") ?? "");
  const def = providerDef(provider);
  if (!def) return;

  const existing = await db.integrationConnection.findFirst({ where: { provider } });
  if (existing) {
    await db.integrationConnection.update({
      where: { id: existing.id },
      data: { status: "connected", lastError: null },
    });
  } else {
    await db.integrationConnection.create({
      data: { kind: def.kind, provider, status: "connected" },
    });
  }
  revalidatePath("/integrations");
}

/**
 * Samsara-specific connect: takes a real API token + region, verifies it
 * against the live API before saving. Falls back to error status (with the
 * message shown in the UI) when the credential is bad.
 */
export async function connectSamsara(formData: FormData) {
  const token = String(formData.get("token") ?? "").trim();
  const region = String(formData.get("region") ?? "us");

  if (!token && !process.env.SAMSARA_API_TOKEN) {
    redirect(
      `/integrations?error=${encodeURIComponent("Samsara: paste an API token (Samsara dashboard → Settings → API Tokens) or set SAMSARA_API_TOKEN.")}`
    );
  }

  const effectiveToken = token || process.env.SAMSARA_API_TOKEN!;
  const test = await testSamsaraConnection(effectiveToken, region);

  const existing = await db.integrationConnection.findFirst({
    where: { provider: "samsara" },
  });
  const data = test.ok
    ? {
        kind: "telematics",
        provider: "samsara",
        status: "connected",
        lastError: null,
        // Only persist the token if it was pasted; env-var setups keep the DB clean.
        config: JSON.stringify({ ...(token ? { token } : {}), region }),
      }
    : {
        kind: "telematics",
        provider: "samsara",
        status: "error",
        lastError: test.error,
        config: JSON.stringify({ ...(token ? { token } : {}), region }),
      };

  if (existing) {
    await db.integrationConnection.update({ where: { id: existing.id }, data });
  } else {
    await db.integrationConnection.create({ data });
  }

  revalidatePath("/integrations");
  if (!test.ok) {
    redirect(`/integrations?error=${encodeURIComponent(`Samsara connection failed: ${test.error}`)}`);
  }
  redirect(
    `/integrations?synced=${encodeURIComponent(
      JSON.stringify({ provider: "Samsara", connectedVehiclesSeen: test.vehicleCount })
    )}`
  );
}

export async function disconnectIntegration(formData: FormData) {
  const provider = String(formData.get("provider") ?? "");
  const existing = await db.integrationConnection.findFirst({ where: { provider } });
  if (!existing) return;
  await db.integrationConnection.update({
    where: { id: existing.id },
    data: { status: "disconnected" },
  });
  revalidatePath("/integrations");
}

export async function syncIntegration(formData: FormData) {
  const provider = String(formData.get("provider") ?? "");
  const def = providerDef(provider);
  if (!def) return;

  const connection = await db.integrationConnection.findFirst({
    where: { provider, status: { in: ["connected", "error"] } },
  });
  if (!connection) return;

  let banner: Record<string, string | number>;
  try {
    if (provider === "samsara" && resolveSamsaraToken(readSamsaraConfig(connection.config))) {
      // Real API sync when a token is configured.
      const summary = await runSamsaraSync(connection.id);
      banner = { provider: "Samsara (live)", ...summary };
    } else if (def.kind === "telematics") {
      const summary = await runTelematicsSync(connection.id);
      banner = { provider: def.name, ...summary };
    } else if (def.kind === "fuel_card") {
      const summary = await runFuelCardSync(connection.id);
      banner = { provider: def.name, ...summary };
    } else {
      return;
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.integrationConnection.update({
      where: { id: connection.id },
      data: { status: "error", lastError: message },
    });
    revalidatePath("/integrations");
    redirect(`/integrations?error=${encodeURIComponent(`${def.name} sync failed: ${message}`)}`);
  }

  revalidatePath("/integrations");
  redirect(`/integrations?synced=${encodeURIComponent(JSON.stringify(banner))}`);
}
