import { db } from "@/lib/db";
import { dispatchEvent } from "@/lib/webhooks";

export type TelematicsSyncSummary = {
  metersCreated: number;
  faultsCreated: number;
  issuesCreated: number;
};

const DTC_CATALOG = [
  { code: "P0301", description: "Cylinder 1 misfire detected", severity: "medium" },
  { code: "P0420", description: "Catalyst system efficiency below threshold", severity: "low" },
  { code: "P0217", description: "Engine coolant over-temperature condition", severity: "high" },
  { code: "C1234", description: "Wheel speed sensor circuit failure", severity: "high" },
] as const;

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Simulated telematics sync: creates a meter entry for every non-archived
 * mi/km vehicle (advancing its odometer 15–120 units), occasionally reports
 * a fault code from a small DTC catalog, and auto-creates a high-priority
 * issue for high-severity faults. Updates the connection's lastSyncAt.
 */
export async function runTelematicsSync(connectionId: string): Promise<TelematicsSyncSummary> {
  const summary: TelematicsSyncSummary = { metersCreated: 0, faultsCreated: 0, issuesCreated: 0 };

  const vehicles = await db.vehicle.findMany({
    where: { archived: false, meterUnit: { in: ["mi", "km"] } },
  });

  for (const vehicle of vehicles) {
    const value = Math.round(vehicle.currentMeter + rand(15, 120));
    await db.meterEntry.create({
      data: { vehicleId: vehicle.id, value, source: "telematics" },
    });
    await db.vehicle.update({
      where: { id: vehicle.id },
      data: { currentMeter: value },
    });
    summary.metersCreated += 1;
  }

  // ~20% chance per sync: one fault code on a random vehicle
  if (vehicles.length > 0 && Math.random() < 0.2) {
    const vehicle = vehicles[Math.floor(Math.random() * vehicles.length)];
    const dtc = DTC_CATALOG[Math.floor(Math.random() * DTC_CATALOG.length)];

    let issueId: string | null = null;
    if (dtc.severity === "high") {
      const { _max } = await db.issue.aggregate({ _max: { number: true } });
      const issue = await db.issue.create({
        data: {
          number: (_max.number ?? 0) + 1,
          vehicleId: vehicle.id,
          summary: `Fault code ${dtc.code}: ${dtc.description}`,
          description: `Reported by telematics device during automatic sync. Severity: ${dtc.severity}.`,
          source: "fault_code",
          priority: "high",
        },
      });
      issueId = issue.id;
      summary.issuesCreated += 1;
      void dispatchEvent("issue.created", {
        id: issue.id,
        number: issue.number,
        vehicle_id: issue.vehicleId,
        summary: issue.summary,
        priority: issue.priority,
        source: issue.source,
        status: issue.status,
      });
    }

    await db.faultCode.create({
      data: {
        vehicleId: vehicle.id,
        code: dtc.code,
        description: dtc.description,
        severity: dtc.severity,
        source: "telematics",
        issueId,
      },
    });
    summary.faultsCreated += 1;
  }

  await db.integrationConnection.update({
    where: { id: connectionId },
    data: { lastSyncAt: new Date(), status: "connected", lastError: null },
  });

  return summary;
}
