// Real Samsara integration.
//
// Auth: API token created in the Samsara dashboard (Settings → API Tokens),
// sent as `Authorization: Bearer <token>`. The token is read from the
// IntegrationConnection.config JSON ({ token, region }) or, if absent, from
// the SAMSARA_API_TOKEN environment variable.
//
// Sync flow (mirrors the telematics loop of the big fleet platforms):
//   1. GET /fleet/vehicles          → match Samsara vehicles to ours by VIN
//   2. GET /fleet/vehicles/stats    → obd/gps odometers → MeterEntries
//                                     faultCodes (OBD-II DTC / J1939 SPN+FMI)
//                                     → FaultCode rows; check-engine-on or
//                                     high severity auto-opens an Issue.

import { db } from "@/lib/db";
import { dispatchEvent } from "@/lib/webhooks";

const BASES: Record<string, string> = {
  us: "https://api.samsara.com",
  eu: "https://api.eu.samsara.com",
};

export type SamsaraConfig = { token?: string; region?: string; importVehicles?: boolean };

export function samsaraBase(region: string | undefined): string {
  return BASES[region ?? "us"] ?? BASES.us;
}

export function readSamsaraConfig(configJson: string | null): SamsaraConfig {
  try {
    return configJson ? (JSON.parse(configJson) as SamsaraConfig) : {};
  } catch {
    return {};
  }
}

export function resolveSamsaraToken(config: SamsaraConfig): string | null {
  return config.token || process.env.SAMSARA_API_TOKEN || null;
}

async function samsaraGet(
  token: string,
  base: string,
  path: string,
  params: Record<string, string> = {}
): Promise<Record<string, unknown>> {
  const url = new URL(base + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20000),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Samsara API ${res.status} on ${path}: ${body.slice(0, 300)}`);
  }
  return (await res.json()) as Record<string, unknown>;
}

type SamsaraVehicle = {
  id: string;
  name?: string;
  vin?: string;
  licensePlate?: string;
  make?: string;
  model?: string;
  year?: string;
  staticAssignedDriver?: { id: string; name: string };
};

type Paginated = {
  data?: unknown[];
  pagination?: { endCursor?: string; hasNextPage?: boolean };
};

async function listAll(
  token: string,
  base: string,
  path: string,
  params: Record<string, string> = {}
): Promise<unknown[]> {
  const out: unknown[] = [];
  let after: string | undefined;
  for (let page = 0; page < 40; page++) {
    const res = (await samsaraGet(token, base, path, {
      ...params,
      limit: "512",
      ...(after ? { after } : {}),
    })) as Paginated;
    out.push(...(res.data ?? []));
    if (!res.pagination?.hasNextPage || !res.pagination.endCursor) break;
    after = res.pagination.endCursor;
  }
  return out;
}

/** Cheap auth/connectivity check used by the Connect form. */
export async function testSamsaraConnection(
  token: string,
  region: string | undefined
): Promise<{ ok: true; vehicleCount: number } | { ok: false; error: string }> {
  try {
    const res = (await samsaraGet(token, samsaraBase(region), "/fleet/vehicles", {
      limit: "512",
    })) as Paginated;
    return { ok: true, vehicleCount: (res.data ?? []).length };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export type SamsaraSyncSummary = {
  vehiclesMatched: number;
  vehiclesImported: number;
  vehiclesUnmatched: number;
  metersCreated: number;
  locationsCreated: number;
  driversLinked: number;
  faultsCreated: number;
  issuesCreated: number;
};

type FaultRecord = { code: string; description: string; severity: string };

function metersToUnit(meters: number, unit: string): number | null {
  if (unit === "mi") return meters / 1609.344;
  if (unit === "km") return meters / 1000;
  return null; // hour-meter assets don't take odometer sync
}

function extractFaults(stats: Record<string, unknown>): FaultRecord[] {
  const out: FaultRecord[] = [];
  const fc = stats.faultCodes as
    | {
        obdii?: {
          checkEngineLightIsOn?: boolean;
          diagnosticTroubleCodes?: { dtcShortCode?: string; dtcDescription?: string }[];
        };
        j1939?: {
          checkEngineLights?: { emissionsIsOn?: boolean; stopIsOn?: boolean; warningIsOn?: boolean };
          diagnosticTroubleCodes?: {
            spnId?: number;
            fmiId?: number;
            spnDescription?: string;
            fmiDescription?: string;
          }[];
        };
      }
    | undefined;
  if (!fc) return out;

  const milOn = fc.obdii?.checkEngineLightIsOn === true;
  for (const dtc of fc.obdii?.diagnosticTroubleCodes ?? []) {
    if (!dtc.dtcShortCode) continue;
    out.push({
      code: dtc.dtcShortCode,
      description: dtc.dtcDescription ?? "OBD-II diagnostic trouble code",
      severity: milOn ? "high" : "medium",
    });
  }

  const j = fc.j1939;
  const stopOn = j?.checkEngineLights?.stopIsOn === true;
  const warnOn = j?.checkEngineLights?.warningIsOn === true || j?.checkEngineLights?.emissionsIsOn === true;
  for (const dtc of j?.diagnosticTroubleCodes ?? []) {
    if (dtc.spnId == null) continue;
    out.push({
      code: `SPN ${dtc.spnId} FMI ${dtc.fmiId ?? "?"}`,
      description:
        [dtc.spnDescription, dtc.fmiDescription].filter(Boolean).join(" — ") ||
        "J1939 diagnostic trouble code",
      severity: stopOn ? "high" : warnOn ? "medium" : "low",
    });
  }
  return out;
}

export async function runSamsaraSync(connectionId: string): Promise<SamsaraSyncSummary> {
  const connection = await db.integrationConnection.findUniqueOrThrow({
    where: { id: connectionId },
  });
  const config = readSamsaraConfig(connection.config);
  const token = resolveSamsaraToken(config);
  if (!token) {
    throw new Error(
      "No Samsara API token configured. Add one on the Connect form or set SAMSARA_API_TOKEN."
    );
  }
  const base = samsaraBase(config.region);

  // 1. Match Samsara vehicles → local vehicles by VIN (name as fallback).
  const remote = (await listAll(token, base, "/fleet/vehicles")) as SamsaraVehicle[];
  const local = await db.vehicle.findMany({ where: { archived: false } });
  const byVin = new Map(
    local.filter((v) => v.vin).map((v) => [v.vin!.trim().toUpperCase(), v])
  );
  const byName = new Map(local.map((v) => [v.name.trim().toLowerCase(), v]));

  // importVehicles (default true): Samsara vehicles with no VIN/name match are
  // created as new AIlFleet vehicles, so a fresh workspace fills itself from
  // the real fleet on first sync.
  const importVehicles = config.importVehicles !== false;

  const matches: { samsaraId: string; vehicleId: string }[] = [];
  let unmatched = 0;
  let imported = 0;
  for (const rv of remote) {
    const vehicle =
      (rv.vin ? byVin.get(rv.vin.trim().toUpperCase()) : undefined) ??
      (rv.name ? byName.get(rv.name.trim().toLowerCase()) : undefined);
    if (vehicle) {
      matches.push({ samsaraId: rv.id, vehicleId: vehicle.id });
    } else if (importVehicles && (rv.vin || rv.name)) {
      const year = rv.year ? parseInt(rv.year, 10) : null;
      const created = await db.vehicle.create({
        data: {
          name: rv.name || rv.vin || `Samsara ${rv.id}`,
          assetType: "vehicle",
          vin: rv.vin?.trim().toUpperCase() || null,
          licensePlate: rv.licensePlate || null,
          make: rv.make || null,
          model: rv.model || null,
          year: year && Number.isFinite(year) ? year : null,
          status: "active",
          ownership: "owned",
          meterUnit: "mi",
          fuelType: "diesel",
          customFields: JSON.stringify({ samsaraId: rv.id, importedFrom: "samsara" }),
        },
      });
      local.push(created);
      matches.push({ samsaraId: rv.id, vehicleId: created.id });
      imported++;
    } else {
      unmatched++;
    }
  }

  // Persist the device link on the vehicle (customFields.samsaraId) so future
  // features (deep links, per-vehicle sync) can use it.
  for (const m of matches) {
    const v = local.find((x) => x.id === m.vehicleId)!;
    let custom: Record<string, unknown> = {};
    try {
      custom = v.customFields ? JSON.parse(v.customFields) : {};
    } catch {
      /* rewrite corrupt blob */
    }
    if (custom.samsaraId !== m.samsaraId) {
      custom.samsaraId = m.samsaraId;
      await db.vehicle.update({
        where: { id: v.id },
        data: { customFields: JSON.stringify(custom) },
      });
    }
  }

  // 2. Pull current stats for matched vehicles.
  const summary: SamsaraSyncSummary = {
    vehiclesMatched: matches.length - imported,
    vehiclesImported: imported,
    vehiclesUnmatched: unmatched,
    metersCreated: 0,
    locationsCreated: 0,
    driversLinked: 0,
    faultsCreated: 0,
    issuesCreated: 0,
  };

  // Assigned drivers → contacts + vehicle assignments (create driver contacts
  // by name when missing; keep the current assignment in step with Samsara).
  const remoteById = new Map(remote.map((rv) => [rv.id, rv]));
  for (const m of matches) {
    const rv = remoteById.get(m.samsaraId);
    const driverName = rv?.staticAssignedDriver?.name?.trim();
    if (!driverName) continue;
    const [firstName, ...rest] = driverName.split(/\s+/);
    const lastName = rest.join(" ") || "—";
    let contact = await db.contact.findFirst({
      where: { firstName, lastName, archived: false },
    });
    if (!contact) {
      contact = await db.contact.create({
        data: { firstName, lastName, jobTitle: "Driver", isOperator: true },
      });
    }
    const current = await db.vehicleAssignment.findFirst({
      where: { vehicleId: m.vehicleId, current: true },
    });
    if (current?.contactId !== contact.id) {
      if (current) {
        await db.vehicleAssignment.update({
          where: { id: current.id },
          data: { current: false, endedAt: new Date() },
        });
      }
      await db.vehicleAssignment.create({
        data: { vehicleId: m.vehicleId, contactId: contact.id },
      });
      summary.driversLinked++;
    }
  }

  if (matches.length > 0) {
    // Samsara restricts /stats to 4 types per request — fetch in two batches
    // and merge per vehicle id.
    const [statsA, statsB] = await Promise.all([
      listAll(token, base, "/fleet/vehicles/stats", {
        types: "obdOdometerMeters,gpsOdometerMeters,faultCodes,gps",
      }) as Promise<Record<string, unknown>[]>,
      listAll(token, base, "/fleet/vehicles/stats", {
        types: "engineStates,fuelPercents",
      }) as Promise<Record<string, unknown>[]>,
    ]);
    const statsById = new Map(statsA.map((s) => [String(s.id), s]));
    for (const s of statsB) {
      const existing = statsById.get(String(s.id));
      if (existing) Object.assign(existing, s);
      else statsById.set(String(s.id), s);
    }
    const now = new Date();

    for (const m of matches) {
      const s = statsById.get(m.samsaraId);
      if (!s) continue;
      const vehicle = await db.vehicle.findUnique({ where: { id: m.vehicleId } });
      if (!vehicle) continue;

      // Odometer → meter entry (OBD preferred, GPS odometer fallback)
      const obd = s.obdOdometerMeters as { value?: number } | undefined;
      const gps = s.gpsOdometerMeters as { value?: number } | undefined;
      const rawMeters = obd?.value ?? gps?.value;
      if (rawMeters != null && rawMeters > 0) {
        const converted = metersToUnit(rawMeters, vehicle.meterUnit);
        if (converted != null) {
          const value = Math.round(converted * 10) / 10;
          if (value > vehicle.currentMeter) {
            await db.meterEntry.create({
              data: { vehicleId: vehicle.id, value, date: now, source: "telematics" },
            });
            await db.vehicle.update({
              where: { id: vehicle.id },
              data: { currentMeter: value },
            });
            summary.metersCreated++;
          }
        }
      }

      // GPS → LocationEntry (skip if unchanged since the last stored point)
      const gpsStat = s.gps as
        | {
            latitude?: number;
            longitude?: number;
            speedMilesPerHour?: number;
            headingDegrees?: number;
            reverseGeo?: { formattedLocation?: string };
            time?: string;
          }
        | undefined;
      if (gpsStat?.latitude != null && gpsStat.longitude != null) {
        const at = gpsStat.time ? new Date(gpsStat.time) : now;
        const last = await db.locationEntry.findFirst({
          where: { vehicleId: vehicle.id },
          orderBy: { date: "desc" },
        });
        if (!last || last.date.getTime() !== at.getTime()) {
          await db.locationEntry.create({
            data: {
              vehicleId: vehicle.id,
              latitude: gpsStat.latitude,
              longitude: gpsStat.longitude,
              speedMph: gpsStat.speedMilesPerHour ?? null,
              heading: gpsStat.headingDegrees ?? null,
              address: gpsStat.reverseGeo?.formattedLocation ?? null,
              date: at,
              source: "samsara",
            },
          });
          summary.locationsCreated++;
        }
      }

      // Engine state + fuel level → telemetry snapshot on the vehicle
      const engine = s.engineStates as { value?: string } | undefined;
      const fuel = s.fuelPercents as { value?: number } | undefined;
      if (engine?.value != null || fuel?.value != null) {
        let custom: Record<string, unknown> = {};
        try {
          custom = vehicle.customFields ? JSON.parse(vehicle.customFields) : {};
        } catch {
          /* rewrite corrupt blob */
        }
        custom.telemetry = {
          engineState: engine?.value ?? null,
          fuelPercent: fuel?.value ?? null,
          updatedAt: now.toISOString(),
        };
        await db.vehicle.update({
          where: { id: vehicle.id },
          data: { customFields: JSON.stringify(custom) },
        });
      }

      // Fault codes → FaultCode rows (+ Issue for high severity)
      for (const fault of extractFaults(s)) {
        const existing = await db.faultCode.findFirst({
          where: { vehicleId: vehicle.id, code: fault.code, status: { in: ["open", "acknowledged"] } },
        });
        if (existing) continue;

        let issueId: string | undefined;
        if (fault.severity === "high") {
          const maxNumber = await db.issue.aggregate({ _max: { number: true } });
          const issue = await db.issue.create({
            data: {
              number: (maxNumber._max.number ?? 0) + 1,
              vehicleId: vehicle.id,
              summary: `${fault.code} — ${fault.description}`.slice(0, 180),
              description: "Imported from Samsara fault code feed.",
              status: "open",
              priority: "high",
              source: "fault_code",
              reportedAt: now,
            },
          });
          issueId = issue.id;
          summary.issuesCreated++;
          void dispatchEvent("issue.created", issue);
        }

        await db.faultCode.create({
          data: {
            vehicleId: vehicle.id,
            code: fault.code,
            description: fault.description,
            severity: fault.severity,
            source: "samsara",
            status: "open",
            occurredAt: now,
            issueId,
          },
        });
        summary.faultsCreated++;
      }
    }
  }

  await db.integrationConnection.update({
    where: { id: connectionId },
    data: { status: "connected", lastSyncAt: new Date(), lastError: null },
  });
  return summary;
}
