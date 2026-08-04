import { PrismaClient } from "@prisma/client";
import { createHash } from "crypto";

const db = new PrismaClient();

const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000);
const daysAhead = (n: number) => new Date(now.getTime() + n * 86400000);

async function main() {
  // Guard: this script WIPES the database. Refuse when real integration data
  // is present (e.g. a connected Samsara org) unless explicitly forced.
  const realConnection = await db.integrationConnection.findFirst({
    where: { status: "connected", config: { not: null } },
  });
  if (realConnection && process.env.FORCE_SEED !== "1") {
    console.error(
      `Refusing to seed: a configured "${realConnection.provider}" integration exists — ` +
        "this database holds real fleet data. Set FORCE_SEED=1 to override."
    );
    process.exit(1);
  }

  console.log("Seeding AIlFleet…");

  // wipe (order matters for FK constraints)
  const tables = [
    "webhookDelivery", "webhook", "apiToken", "integrationConnection",
    "workOrderPart", "workOrderLabor", "workOrderLine",
    "serviceEntryLine", "serviceEntry",
    "inspectionItemResult", "inspectionSubmission", "inspectionItem", "inspectionForm",
    "faultCode", "issue",
    "serviceReminder", "serviceProgramVehicle", "serviceProgramTask", "serviceProgram",
    "purchaseOrderLine", "purchaseOrder",
    "partAdjustment", "partStock", "part", "inventoryLocation",
    "fuelEntry", "chargingEntry", "expenseEntry",
    "vehicleRenewal", "contactRenewal",
    "comment", "document", "meterEntry", "vehicleAssignment",
    "workOrder", "serviceTask", "vehicle", "vehicleGroup",
    "vendor", "user", "contact", "accountSetting",
  ] as const;
  for (const t of tables) {
    // @ts-expect-error dynamic access
    await db[t].deleteMany({});
  }

  // ── groups ──
  const gMain = await db.vehicleGroup.create({ data: { name: "Main Depot" } });
  const gNorth = await db.vehicleGroup.create({ data: { name: "North Branch" } });
  const gConstruction = await db.vehicleGroup.create({
    data: { name: "Construction", parentId: gMain.id },
  });

  // ── contacts & users ──
  const mkContact = (
    firstName: string, lastName: string, email: string,
    opts: Partial<{ isTechnician: boolean; isOperator: boolean; jobTitle: string; licenseNumber: string; licenseClass: string }> = {}
  ) =>
    db.contact.create({
      data: {
        firstName, lastName, email,
        phone: "+1 (555) 010-" + Math.floor(1000 + Math.random() * 9000),
        isOperator: opts.isOperator ?? true,
        isTechnician: opts.isTechnician ?? false,
        jobTitle: opts.jobTitle,
        licenseNumber: opts.licenseNumber,
        licenseClass: opts.licenseClass,
        hireDate: daysAgo(400 + Math.floor(Math.random() * 1000)),
      },
    });

  const carlos = await mkContact("Carlos", "Mendez", "carlos@ailfleet.test", { jobTitle: "Driver", licenseNumber: "D-4482913", licenseClass: "CDL-A" });
  const dana = await mkContact("Dana", "Whitfield", "dana@ailfleet.test", { jobTitle: "Driver", licenseNumber: "D-9917432", licenseClass: "CDL-B" });
  const jamal = await mkContact("Jamal", "Ortiz", "jamal@ailfleet.test", { jobTitle: "Driver", licenseNumber: "D-2231098", licenseClass: "C" });
  const priya = await mkContact("Priya", "Raman", "priya@ailfleet.test", { jobTitle: "Lead Technician", isTechnician: true, isOperator: false });
  const marek = await mkContact("Marek", "Nowak", "marek@ailfleet.test", { jobTitle: "Technician", isTechnician: true, isOperator: false });
  const admin = await mkContact("Alex", "Kim", "alex@ailfleet.test", { jobTitle: "Fleet Manager", isOperator: false });

  const hash = (s: string) => createHash("sha256").update(s).digest("hex");
  await db.user.create({ data: { email: "alex@ailfleet.test", passwordHash: hash("admin123"), role: "admin", contactId: admin.id } });
  await db.user.create({ data: { email: "priya@ailfleet.test", passwordHash: hash("tech123"), role: "technician", contactId: priya.id } });
  await db.user.create({ data: { email: "carlos@ailfleet.test", passwordHash: hash("driver123"), role: "operator", contactId: carlos.id } });

  // ── vendors ──
  const vShell = await db.vendor.create({ data: { name: "Shell Station #204", classifications: JSON.stringify(["fuel"]), address: "1200 Industrial Pkwy" } });
  const vPilot = await db.vendor.create({ data: { name: "Pilot Travel Center", classifications: JSON.stringify(["fuel"]) } });
  const vNapa = await db.vendor.create({ data: { name: "NAPA Auto Parts", classifications: JSON.stringify(["parts"]), phone: "+1 (555) 300-1200" } });
  const vMidway = await db.vendor.create({ data: { name: "Midway Truck Service", classifications: JSON.stringify(["service"]), phone: "+1 (555) 300-8899" } });
  const vDealer = await db.vendor.create({ data: { name: "Metro Ford Commercial", classifications: JSON.stringify(["vehicles", "service"]) } });

  // ── vehicles ──
  type VSpec = {
    name: string; year: number; make: string; model: string; type?: string;
    vin: string; plate: string; status?: string; fuel?: string; meter: number;
    group?: string; unit?: string; purchasePrice?: number; tank?: number;
  };
  const vspecs: VSpec[] = [
    { name: "Truck 101", year: 2022, make: "Ford", model: "F-150", vin: "1FTFW1E52NKE11223", plate: "TRK-101", meter: 48230, fuel: "gasoline", group: gMain.id, purchasePrice: 42000, tank: 26 },
    { name: "Truck 102", year: 2021, make: "Ford", model: "F-250", vin: "1FT7W2B60MEC33401", plate: "TRK-102", meter: 67810, fuel: "diesel", group: gMain.id, purchasePrice: 51500, tank: 34 },
    { name: "Van 201", year: 2023, make: "Ram", model: "ProMaster 2500", vin: "3C6TRVDG8PE501287", plate: "VAN-201", meter: 22140, fuel: "gasoline", group: gMain.id, purchasePrice: 46900, tank: 24 },
    { name: "Van 202", year: 2020, make: "Mercedes-Benz", model: "Sprinter 2500", vin: "W1Y4ECHY1LT031244", plate: "VAN-202", meter: 89320, fuel: "diesel", status: "in_shop", group: gNorth.id, purchasePrice: 48200, tank: 24.5 },
    { name: "Box 301", year: 2019, make: "Isuzu", model: "NPR-HD", vin: "JALC4W167K7002931", plate: "BOX-301", meter: 112400, fuel: "diesel", group: gNorth.id, purchasePrice: 58800, tank: 30 },
    { name: "EV 401", year: 2024, make: "Ford", model: "F-150 Lightning", vin: "1FTVW1EL8RWG20455", plate: "EV-401", meter: 12890, fuel: "electric", group: gMain.id, purchasePrice: 62900 },
    { name: "Sedan 501", year: 2022, make: "Toyota", model: "Camry", vin: "4T1G11AK6NU612345", plate: "SED-501", meter: 34560, fuel: "hybrid", group: gMain.id, purchasePrice: 28900, tank: 13 },
    { name: "Excavator E-1", year: 2018, make: "Caterpillar", model: "320 GC", type: "equipment", vin: "CAT0320GCLDF10221", plate: "—", meter: 4210, unit: "hr", fuel: "diesel", group: gConstruction.id, purchasePrice: 168000 },
    { name: "Trailer T-1", year: 2020, make: "Great Dane", model: "Everest", type: "trailer", vin: "1GRAA0628LB702214", plate: "TRL-001", meter: 0, group: gConstruction.id, purchasePrice: 32000 },
    { name: "Truck 103", year: 2017, make: "Chevrolet", model: "Silverado 2500", vin: "1GC1KVEG5HF201182", plate: "TRK-103", status: "out_of_service", meter: 154200, fuel: "gasoline", group: gNorth.id, purchasePrice: 39900, tank: 36 },
  ];

  const vehicles: Record<string, { id: string }> = {};
  for (const s of vspecs) {
    vehicles[s.name] = await db.vehicle.create({
      data: {
        name: s.name, assetType: s.type ?? "vehicle", vin: s.vin, licensePlate: s.plate,
        year: s.year, make: s.make, model: s.model, status: s.status ?? "active",
        fuelType: s.fuel, meterUnit: s.unit ?? "mi", currentMeter: s.meter,
        groupId: s.group, ownership: "owned",
        purchaseDate: daysAgo(300 + Math.floor(Math.random() * 900)),
        purchasePrice: s.purchasePrice,
        specs: s.tank ? JSON.stringify({ fuelTankCapacity: s.tank }) : null,
      },
    });
  }

  // assignments
  await db.vehicleAssignment.create({ data: { vehicleId: vehicles["Truck 101"].id, contactId: carlos.id, startedAt: daysAgo(200) } });
  await db.vehicleAssignment.create({ data: { vehicleId: vehicles["Van 201"].id, contactId: dana.id, startedAt: daysAgo(120) } });
  await db.vehicleAssignment.create({ data: { vehicleId: vehicles["Sedan 501"].id, contactId: jamal.id, startedAt: daysAgo(60) } });

  // meter history (last 6 entries per powered vehicle)
  for (const s of vspecs) {
    if (s.type === "trailer") continue;
    const v = vehicles[s.name];
    for (let i = 5; i >= 0; i--) {
      await db.meterEntry.create({
        data: {
          vehicleId: v.id,
          value: Math.round(s.meter - i * (s.unit === "hr" ? 40 : 900) + Math.random() * 50),
          date: daysAgo(i * 15),
          source: i % 2 === 0 ? "telematics" : "fuel_entry",
        },
      });
    }
  }

  // ── service tasks ──
  const taskNames = [
    ["Engine Oil & Filter Change", 1],
    ["Tire Rotation", 0.5],
    ["Brake Pad Replacement — Front", 2],
    ["Brake Inspection", 0.5],
    ["Air Filter Replacement", 0.3],
    ["Cabin Air Filter Replacement", 0.3],
    ["Transmission Fluid Change", 1.5],
    ["Coolant Flush", 1],
    ["Battery Replacement", 0.5],
    ["Wiper Blade Replacement", 0.2],
    ["DOT Annual Inspection", 2],
    ["Hydraulic System Inspection", 1.5],
    ["A/C System Service", 1],
  ] as const;
  const tasks: Record<string, { id: string }> = {};
  for (const [name, hrs] of taskNames) {
    tasks[name] = await db.serviceTask.create({ data: { name, expectedLaborHours: hrs } });
  }

  // ── service program + reminders ──
  const program = await db.serviceProgram.create({ data: { name: "Light Truck PM Program" } });
  await db.serviceProgramTask.create({ data: { programId: program.id, taskId: tasks["Engine Oil & Filter Change"].id, intervalMeter: 5000, intervalDays: 180, dueSoonMeter: 500, dueSoonDays: 14 } });
  await db.serviceProgramTask.create({ data: { programId: program.id, taskId: tasks["Tire Rotation"].id, intervalMeter: 7500, dueSoonMeter: 500 } });
  await db.serviceProgramTask.create({ data: { programId: program.id, taskId: tasks["Brake Inspection"].id, intervalMeter: 15000, intervalDays: 365, dueSoonMeter: 1000, dueSoonDays: 30 } });
  for (const n of ["Truck 101", "Truck 102", "Van 201", "Van 202"]) {
    await db.serviceProgramVehicle.create({ data: { programId: program.id, vehicleId: vehicles[n].id } });
  }

  const remSpecs: [string, string, number | null, number | null, string][] = [
    ["Truck 101", "Engine Oil & Filter Change", 48600, null, "due_soon"],
    ["Truck 101", "Tire Rotation", 50100, null, "upcoming"],
    ["Truck 102", "Engine Oil & Filter Change", 67500, null, "overdue"],
    ["Truck 102", "Brake Inspection", 75000, null, "upcoming"],
    ["Van 201", "Engine Oil & Filter Change", 25000, null, "upcoming"],
    ["Van 202", "Transmission Fluid Change", 90000, null, "due_soon"],
    ["Box 301", "DOT Annual Inspection", null, 20, "due_soon"],
    ["Excavator E-1", "Hydraulic System Inspection", 4300, null, "due_soon"],
  ];
  for (const [vname, tname, dueMeter, dueDays, status] of remSpecs) {
    await db.serviceReminder.create({
      data: {
        vehicleId: vehicles[vname].id, taskId: tasks[tname].id,
        nextDueMeter: dueMeter, nextDueDate: dueDays ? daysAhead(dueDays) : status === "overdue" ? daysAgo(10) : daysAhead(45),
        intervalMeter: dueMeter ? 5000 : null, intervalDays: dueDays ? 365 : 180,
        status,
        lastCompletedAt: daysAgo(90), lastCompletedMeter: dueMeter ? dueMeter - 5000 : null,
      },
    });
  }

  // ── inspection form ──
  const form = await db.inspectionForm.create({
    data: { title: "Daily Driver Vehicle Inspection (DVIR)", description: "Pre-trip walkaround inspection required before first use each day." },
  });
  const itemSpecs: [string, string, boolean][] = [
    ["Walkaround", "section", false],
    ["Tires — tread & pressure", "pass_fail", true],
    ["Lights & reflectors", "pass_fail", true],
    ["Brakes — parking & service", "pass_fail", true],
    ["Fluid leaks", "pass_fail", true],
    ["Mirrors & windshield", "pass_fail", true],
    ["Cab", "section", false],
    ["Horn", "pass_fail", false],
    ["Seat belts", "pass_fail", true],
    ["Emergency equipment", "pass_fail", false],
    ["Odometer reading", "meter", true],
    ["Remarks", "text", false],
    ["Driver signature", "signature", true],
  ];
  const items: { id: string; label: string; type: string }[] = [];
  let pos = 0;
  for (const [label, type, required] of itemSpecs) {
    const it = await db.inspectionItem.create({
      data: { formId: form.id, position: pos++, type, label, required, requireCommentOnFail: true },
    });
    items.push({ id: it.id, label, type });
  }

  // helper to create an issue with sequential number
  let issueNo = 1;
  const mkIssue = (data: Omit<Parameters<typeof db.issue.create>[0]["data"], "number">) =>
    db.issue.create({ data: { ...data, number: issueNo++ } as never });

  // inspection submissions — one clean, one with failure
  const passSub = await db.inspectionSubmission.create({
    data: {
      formId: form.id, vehicleId: vehicles["Truck 101"].id, submittedById: carlos.id,
      startedAt: daysAgo(1), submittedAt: daysAgo(1), durationSec: 342, failedCount: 0,
    },
  });
  for (const it of items) {
    if (it.type === "section") continue;
    await db.inspectionItemResult.create({
      data: {
        submissionId: passSub.id, itemId: it.id,
        passed: it.type === "pass_fail" ? true : null,
        value: it.type === "meter" ? "48210" : it.type === "signature" ? "Carlos Mendez" : null,
      },
    });
  }

  const failSub = await db.inspectionSubmission.create({
    data: {
      formId: form.id, vehicleId: vehicles["Van 202"].id, submittedById: dana.id,
      startedAt: daysAgo(3), submittedAt: daysAgo(3), durationSec: 517, failedCount: 1,
    },
  });
  let brakeIssueId: string | null = null;
  for (const it of items) {
    if (it.type === "section") continue;
    const failed = it.label.startsWith("Brakes");
    let issueId: string | undefined;
    if (failed) {
      const issue = await mkIssue({
        vehicleId: vehicles["Van 202"].id,
        summary: "Parking brake not holding on incline",
        description: "Found during daily DVIR — parking brake requires excessive travel and van rolls on ramp.",
        status: "open", priority: "high", source: "inspection",
        reportedById: dana.id, reportedAt: daysAgo(3),
      });
      issueId = issue.id;
      brakeIssueId = issue.id;
    }
    await db.inspectionItemResult.create({
      data: {
        submissionId: failSub.id, itemId: it.id,
        passed: it.type === "pass_fail" ? !failed : null,
        value: it.type === "meter" ? "89310" : it.type === "signature" ? "Dana Whitfield" : null,
        comment: failed ? "Rolls back on the loading ramp with brake set" : null,
        issueId,
      },
    });
  }

  // ── more issues ──
  await mkIssue({
    vehicleId: vehicles["Truck 102"].id, summary: "Check engine light on",
    description: "Intermittent CEL, no drivability symptoms.", status: "open",
    priority: "medium", source: "manual", reportedById: carlos.id, reportedAt: daysAgo(6),
  });
  await mkIssue({
    vehicleId: vehicles["Box 301"].id, summary: "Liftgate slow to raise",
    status: "open", priority: "low", source: "manual", reportedById: jamal.id,
    reportedAt: daysAgo(12), dueDate: daysAgo(2),
  });
  await mkIssue({
    vehicleId: vehicles["Truck 101"].id, summary: "Windshield chip — passenger side",
    status: "resolved", priority: "low", source: "manual", reportedById: carlos.id,
    reportedAt: daysAgo(30), resolvedAt: daysAgo(21), resolvedNote: "Repaired by mobile glass service.",
  });

  // fault code → issue
  const faultIssue = await mkIssue({
    vehicleId: vehicles["Truck 102"].id, summary: "P0401 — EGR flow insufficient",
    description: "Imported from telematics DTC feed.", status: "open", priority: "medium",
    source: "fault_code", reportedAt: daysAgo(2),
  });
  await db.faultCode.create({
    data: {
      vehicleId: vehicles["Truck 102"].id, code: "P0401",
      description: "Exhaust Gas Recirculation Flow Insufficient", severity: "medium",
      status: "open", occurredAt: daysAgo(2), issueId: faultIssue.id,
    },
  });
  await db.faultCode.create({
    data: {
      vehicleId: vehicles["Van 202"].id, code: "C1234",
      description: "Wheel Speed Sensor Front Right Circuit", severity: "high",
      status: "open", occurredAt: daysAgo(1),
    },
  });

  // ── parts & inventory ──
  const locMain = await db.inventoryLocation.create({ data: { name: "Main Depot Shop" } });
  const locNorth = await db.inventoryLocation.create({ data: { name: "North Branch Storeroom" } });
  const partSpecs: [string, string, string, number, number, number][] = [
    // number, description, category, cost, mainQty, reorder
    ["OF-4967", "Engine Oil Filter — Motorcraft FL-500S", "Filters", 8.5, 24, 10],
    ["AF-2210", "Engine Air Filter", "Filters", 19.9, 3, 6],
    ["BP-8801", "Front Brake Pad Set — HD", "Brakes", 64.0, 8, 4],
    ["BR-1140", "Brake Rotor — Front", "Brakes", 88.0, 4, 2],
    ["OIL-5W30", "5W-30 Synthetic Oil (quart)", "Fluids", 6.75, 48, 24],
    ["OIL-15W40", "15W-40 Diesel Oil (gallon)", "Fluids", 21.0, 12, 8],
    ["WB-22", "Wiper Blade 22\"", "Exterior", 11.25, 14, 6],
    ["BAT-65", "Battery Group 65", "Electrical", 142.0, 2, 2],
    ["TIRE-LT265", "Tire LT265/70R17", "Tires", 189.0, 6, 4],
    ["CF-3320", "Cabin Air Filter", "Filters", 14.5, 0, 4],
  ];
  const parts: Record<string, { id: string; cost: number }> = {};
  for (const [number, description, category, cost, qty, reorder] of partSpecs) {
    const p = await db.part.create({ data: { number, description, category, unitCost: cost, manufacturer: category === "Tires" ? "BFGoodrich" : "Motorcraft" } });
    parts[number] = { id: p.id, cost };
    await db.partStock.create({ data: { partId: p.id, locationId: locMain.id, quantity: qty, reorderPoint: reorder } });
    if (["OF-4967", "OIL-5W30", "WB-22"].includes(number)) {
      await db.partStock.create({ data: { partId: p.id, locationId: locNorth.id, quantity: Math.ceil(qty / 3), reorderPoint: Math.ceil(reorder / 2) } });
    }
    await db.partAdjustment.create({ data: { partId: p.id, locationId: locMain.id, delta: qty, reason: "received", note: "Initial stock count" , createdAt: daysAgo(45)} });
  }

  // ── work orders ──
  // WO 1: completed oil change on Truck 101 (with service entry)
  const wo1 = await db.workOrder.create({
    data: {
      number: 1, vehicleId: vehicles["Truck 101"].id, status: "completed",
      priority: "none", repairClass: "scheduled", issuedAt: daysAgo(35),
      startedAt: daysAgo(34), completedAt: daysAgo(34), assignedToId: priya.id,
      meterAtService: 46900, description: "5k PM service",
      laborTotal: 85, partsTotal: 62.25, subtotal: 147.25, tax: 10.31, total: 157.56,
    },
  });
  const wo1line = await db.workOrderLine.create({
    data: { workOrderId: wo1.id, taskId: tasks["Engine Oil & Filter Change"].id, laborCost: 85, partsCost: 62.25, subtotal: 147.25 },
  });
  await db.workOrderLabor.create({ data: { lineId: wo1line.id, technicianId: priya.id, hours: 1, rate: 85, cost: 85 } });
  await db.workOrderPart.create({ data: { lineId: wo1line.id, partId: parts["OF-4967"].id, quantity: 1, unitCost: 8.5, cost: 8.5 } });
  await db.workOrderPart.create({ data: { lineId: wo1line.id, partId: parts["OIL-5W30"].id, quantity: 8, unitCost: 6.75, cost: 53.75 } });
  const se1 = await db.serviceEntry.create({
    data: {
      vehicleId: vehicles["Truck 101"].id, workOrderId: wo1.id, date: daysAgo(34),
      meter: 46900, laborTotal: 85, partsTotal: 62.25, total: 157.56,
    },
  });
  await db.serviceEntryLine.create({ data: { entryId: se1.id, taskId: tasks["Engine Oil & Filter Change"].id, cost: 147.25 } });

  // WO 2: in progress — Van 202 brakes, linked to DVIR issue
  const wo2 = await db.workOrder.create({
    data: {
      number: 2, vehicleId: vehicles["Van 202"].id, status: "in_progress",
      priority: "high", repairClass: "non_scheduled", issuedAt: daysAgo(2),
      startedAt: daysAgo(1), assignedToId: marek.id, meterAtService: 89320,
      description: "Parking brake repair from failed DVIR",
    },
  });
  const wo2line = await db.workOrderLine.create({
    data: { workOrderId: wo2.id, taskId: tasks["Brake Pad Replacement — Front"].id },
  });
  await db.workOrderLabor.create({ data: { lineId: wo2line.id, technicianId: marek.id, hours: 1.5, rate: 78, cost: 117 } });
  if (brakeIssueId) {
    await db.issue.update({ where: { id: brakeIssueId }, data: { workOrderId: wo2.id } });
  }

  // WO 3: open — Truck 102 overdue oil change
  await db.workOrder.create({
    data: {
      number: 3, vehicleId: vehicles["Truck 102"].id, status: "open",
      priority: "medium", repairClass: "scheduled", issuedAt: daysAgo(1),
      description: "Overdue 5k PM — oil & filter, tire rotation",
    },
  });

  // outsourced service entry (no WO)
  const se2 = await db.serviceEntry.create({
    data: {
      vehicleId: vehicles["Box 301"].id, date: daysAgo(20), meter: 111800,
      vendorId: vMidway.id, reference: "INV-20441", laborTotal: 260, partsTotal: 148, total: 408,
      notes: "Outsourced — exhaust leak repair",
    },
  });
  await db.serviceEntryLine.create({ data: { entryId: se2.id, description: "Exhaust manifold gasket replacement", cost: 408 } });

  // ── fuel entries (history per gas vehicle, computing economy) ──
  const fuelVehicles: [string, number, number, number][] = [
    // name, currentMeter, mpg approx, tank price
    ["Truck 101", 48230, 17, 3.55],
    ["Truck 102", 67810, 13.5, 3.95],
    ["Van 201", 22140, 15, 3.55],
    ["Box 301", 112400, 9.5, 3.95],
    ["Sedan 501", 34560, 44, 3.49],
  ];
  for (const [name, cur, mpg, price] of fuelVehicles) {
    let meterAt = cur;
    const entries: { meter: number; volume: number; date: Date }[] = [];
    for (let i = 0; i < 6; i++) {
      const dist = 300 + Math.random() * 150;
      const vol = dist / (mpg * (0.9 + Math.random() * 0.2));
      entries.unshift({ meter: Math.round(meterAt), volume: Math.round(vol * 100) / 100, date: daysAgo(i * 9 + 1) });
      meterAt -= dist;
    }
    let prev: number | null = null;
    for (const e of entries) {
      const economy = prev != null ? Math.round(((e.meter - prev) / e.volume) * 10) / 10 : null;
      await db.fuelEntry.create({
        data: {
          vehicleId: vehicles[name].id, date: e.date, meter: e.meter, volume: e.volume,
          pricePerUnit: price, total: Math.round(e.volume * price * 100) / 100,
          vendorId: Math.random() > 0.5 ? vShell.id : vPilot.id,
          enteredById: carlos.id, source: Math.random() > 0.6 ? "fuel_card" : "manual",
          fuelEconomy: economy,
        },
      });
      prev = e.meter;
    }
  }
  // EV charging
  for (let i = 0; i < 5; i++) {
    await db.chargingEntry.create({
      data: {
        vehicleId: vehicles["EV 401"].id, date: daysAgo(i * 6 + 2),
        energyKwh: Math.round((45 + Math.random() * 40) * 10) / 10,
        durationMin: 40 + Math.floor(Math.random() * 50),
        cost: Math.round((12 + Math.random() * 14) * 100) / 100,
        location: i % 2 === 0 ? "Depot DC Fast Charger" : "Electrify America — Rt 9",
        meter: 12890 - i * 400,
      },
    });
  }

  // ── expenses ──
  const expenseSpecs: [string, string, number, number][] = [
    ["Truck 101", "insurance", 210, 5],
    ["Truck 102", "insurance", 224, 5],
    ["Van 202", "registration", 145, 40],
    ["Box 301", "tolls", 86.4, 12],
    ["Sedan 501", "washing", 24, 8],
  ];
  for (const [vname, type, amount, ago] of expenseSpecs) {
    await db.expenseEntry.create({
      data: { vehicleId: vehicles[vname].id, type, amount, date: daysAgo(ago), recurring: type === "insurance", frequency: type === "insurance" ? "monthly" : null },
    });
  }

  // ── renewals ──
  await db.vehicleRenewal.create({ data: { vehicleId: vehicles["Truck 101"].id, type: "registration", dueDate: daysAhead(25), status: "due_soon" } });
  await db.vehicleRenewal.create({ data: { vehicleId: vehicles["Box 301"].id, type: "dot_inspection", dueDate: daysAhead(20), status: "due_soon" } });
  await db.vehicleRenewal.create({ data: { vehicleId: vehicles["Van 202"].id, type: "insurance", dueDate: daysAgo(5), status: "overdue" } });
  await db.vehicleRenewal.create({ data: { vehicleId: vehicles["Truck 102"].id, type: "registration", dueDate: daysAhead(120), status: "upcoming" } });
  await db.contactRenewal.create({ data: { contactId: carlos.id, type: "license", dueDate: daysAhead(45), status: "upcoming" } });
  await db.contactRenewal.create({ data: { contactId: dana.id, type: "medical_exam", dueDate: daysAhead(15), status: "due_soon" } });

  // ── purchase order ──
  const po = await db.purchaseOrder.create({
    data: {
      number: 1, vendorId: vNapa.id, status: "pending_approval",
      description: "Restock filters + cabin filters (below reorder point)",
      subtotal: 199.3, tax: 13.95, total: 213.25, createdAt: daysAgo(2),
    },
  });
  await db.purchaseOrderLine.create({ data: { poId: po.id, partId: parts["AF-2210"].id, quantity: 6, unitCost: 19.9 } });
  await db.purchaseOrderLine.create({ data: { poId: po.id, partId: parts["CF-3320"].id, quantity: 8, unitCost: 14.5 } });

  // ── integrations ──
  await db.integrationConnection.create({
    data: { kind: "telematics", provider: "samsara", status: "connected", lastSyncAt: daysAgo(0), config: JSON.stringify({ syncMeters: true, syncFaults: true, syncLocations: true }) },
  });
  await db.integrationConnection.create({
    data: { kind: "fuel_card", provider: "wex", status: "connected", lastSyncAt: daysAgo(1), config: JSON.stringify({ autoCreateVendors: true }) },
  });
  await db.integrationConnection.create({ data: { kind: "telematics", provider: "geotab", status: "disconnected" } });
  await db.integrationConnection.create({ data: { kind: "accounting", provider: "quickbooks", status: "disconnected" } });

  await db.apiToken.create({
    data: { name: "Reporting integration", prefix: "aif_demo", tokenHash: hash("aif_demo_token_123"), scopes: JSON.stringify(["read"]) },
  });

  await db.webhook.create({
    data: {
      url: "https://example.test/hooks/ailfleet", secret: "whsec_demo123",
      events: JSON.stringify(["issue.created", "work_order.completed", "fuel_entry.created"]),
    },
  });

  // ── comments ──
  await db.comment.create({ data: { entityType: "issue", entityId: faultIssue.id, authorName: "Alex Kim", body: "Scheduling diagnostics with the shop for Thursday." } });
  await db.comment.create({ data: { entityType: "work_order", entityId: wo2.id, authorName: "Marek Nowak", body: "Rear cable seized — replacement cable arriving tomorrow." } });

  await db.accountSetting.create({ data: { key: "company_name", value: "AIlFleet Demo Co." } });
  await db.accountSetting.create({ data: { key: "currency", value: "USD" } });
  await db.accountSetting.create({ data: { key: "distance_unit", value: "mi" } });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
