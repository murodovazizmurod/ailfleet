// Shared query + filter + CSV helpers for the Reports module.
// Used by both the report pages and their /csv route handlers.

import { db } from "@/lib/db";
import { vehicleTitle } from "@/lib/format";

// ── Filters ──────────────────────────────────────────────────────

export type SearchParams = Record<string, string | string[] | undefined>;

export function str(sp: SearchParams, key: string): string | null {
  const v = sp[key];
  if (typeof v === "string" && v.trim() !== "") return v.trim();
  return null;
}

export type ReportFilters = {
  from: string | null;
  to: string | null;
  vehicleId: string | null;
  fromDate: Date | null;
  toDate: Date | null;
};

function validDate(d: Date | null): Date | null {
  return d && !isNaN(d.getTime()) ? d : null;
}

export function parseFilters(sp: SearchParams): ReportFilters {
  const from = str(sp, "from");
  const to = str(sp, "to");
  return {
    from,
    to,
    vehicleId: str(sp, "vehicleId"),
    fromDate: validDate(from ? new Date(`${from}T00:00:00`) : null),
    toDate: validDate(to ? new Date(`${to}T23:59:59.999`) : null),
  };
}

/** Prisma `DateTime` range condition, or undefined when no bounds set. */
export function dateRange(f: ReportFilters): { gte?: Date; lte?: Date } | undefined {
  if (!f.fromDate && !f.toDate) return undefined;
  return {
    ...(f.fromDate ? { gte: f.fromDate } : {}),
    ...(f.toDate ? { lte: f.toDate } : {}),
  };
}

/** Build a querystring ("?a=b" or "") from non-empty values. */
export function filterQuery(params: Record<string, string | null | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) qs.set(k, v);
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

// ── Vehicle helpers ──────────────────────────────────────────────

export type VehicleOption = {
  id: string;
  name: string;
  year: number | null;
  make: string | null;
  model: string | null;
};

export function vehicleLabel(v: VehicleOption): string {
  const title = vehicleTitle(v);
  return title === "—" ? v.name : `${v.name} · ${title}`;
}

export function getVehicleOptions(): Promise<VehicleOption[]> {
  return db.vehicle.findMany({
    where: { archived: false },
    orderBy: { name: "asc" },
    select: { id: true, name: true, year: true, make: true, model: true },
  });
}

// ── Operating costs ──────────────────────────────────────────────

export type OperatingCostRow = {
  vehicleId: string;
  name: string;
  title: string;
  meterUnit: string;
  fuelCost: number;
  serviceCost: number;
  otherCost: number;
  total: number;
  meterDelta: number | null;
  costPerMeter: number | null;
};

export type OperatingCostReport = {
  rows: OperatingCostRow[];
  totals: { fuelCost: number; serviceCost: number; otherCost: number; total: number };
};

export async function getOperatingCosts(f: ReportFilters): Promise<OperatingCostReport> {
  const range = dateRange(f);
  const byVehicle = f.vehicleId ? { vehicleId: f.vehicleId } : {};

  const [vehicles, fuel, charging, service, expenses, meters] = await Promise.all([
    db.vehicle.findMany({
      where: f.vehicleId ? { id: f.vehicleId } : { archived: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true, year: true, make: true, model: true, meterUnit: true },
    }),
    db.fuelEntry.groupBy({
      by: ["vehicleId"],
      _sum: { total: true },
      where: { ...byVehicle, ...(range ? { date: range } : {}) },
    }),
    db.chargingEntry.groupBy({
      by: ["vehicleId"],
      _sum: { cost: true },
      where: { ...byVehicle, ...(range ? { date: range } : {}) },
    }),
    db.serviceEntry.groupBy({
      by: ["vehicleId"],
      _sum: { total: true },
      where: { ...byVehicle, ...(range ? { date: range } : {}) },
    }),
    db.expenseEntry.groupBy({
      by: ["vehicleId"],
      _sum: { amount: true },
      where: { ...byVehicle, ...(range ? { date: range } : {}) },
    }),
    db.meterEntry.groupBy({
      by: ["vehicleId"],
      _min: { value: true },
      _max: { value: true },
      where: {
        ...byVehicle,
        void: false,
        meterType: "primary",
        ...(range ? { date: range } : {}),
      },
    }),
  ]);

  const fuelMap = new Map(fuel.map((r) => [r.vehicleId, r._sum.total ?? 0]));
  const chargeMap = new Map(charging.map((r) => [r.vehicleId, r._sum.cost ?? 0]));
  const serviceMap = new Map(service.map((r) => [r.vehicleId, r._sum.total ?? 0]));
  const expenseMap = new Map(expenses.map((r) => [r.vehicleId, r._sum.amount ?? 0]));
  const meterMap = new Map(
    meters.map((r) => [r.vehicleId, { min: r._min.value, max: r._max.value }])
  );

  const rows: OperatingCostRow[] = vehicles.map((v) => {
    const fuelCost = (fuelMap.get(v.id) ?? 0) + (chargeMap.get(v.id) ?? 0);
    const serviceCost = serviceMap.get(v.id) ?? 0;
    const otherCost = expenseMap.get(v.id) ?? 0;
    const total = fuelCost + serviceCost + otherCost;
    const m = meterMap.get(v.id);
    const meterDelta =
      m && m.min != null && m.max != null && m.max > m.min ? m.max - m.min : null;
    return {
      vehicleId: v.id,
      name: v.name,
      title: vehicleTitle(v),
      meterUnit: v.meterUnit,
      fuelCost,
      serviceCost,
      otherCost,
      total,
      meterDelta,
      costPerMeter: meterDelta && meterDelta > 0 ? total / meterDelta : null,
    };
  });

  const totals = rows.reduce(
    (acc, r) => ({
      fuelCost: acc.fuelCost + r.fuelCost,
      serviceCost: acc.serviceCost + r.serviceCost,
      otherCost: acc.otherCost + r.otherCost,
      total: acc.total + r.total,
    }),
    { fuelCost: 0, serviceCost: 0, otherCost: 0, total: 0 }
  );

  return { rows, totals };
}

// ── Fuel summary ─────────────────────────────────────────────────

export type FuelSummaryRow = {
  vehicleId: string;
  name: string;
  title: string;
  meterUnit: string;
  fuelType: string | null;
  entries: number;
  volume: number;
  cost: number;
  avgEconomy: number | null;
  avgPrice: number | null;
};

export async function getFuelSummary(f: ReportFilters): Promise<FuelSummaryRow[]> {
  const range = dateRange(f);
  const grouped = await db.fuelEntry.groupBy({
    by: ["vehicleId"],
    _count: { _all: true },
    _sum: { volume: true, total: true },
    _avg: { fuelEconomy: true, pricePerUnit: true },
    where: {
      ...(f.vehicleId ? { vehicleId: f.vehicleId } : {}),
      ...(range ? { date: range } : {}),
    },
  });
  const vehicles = await db.vehicle.findMany({
    where: { id: { in: grouped.map((g) => g.vehicleId) } },
    select: { id: true, name: true, year: true, make: true, model: true, meterUnit: true, fuelType: true },
  });
  const vMap = new Map(vehicles.map((v) => [v.id, v]));

  return grouped
    .map((g) => {
      const v = vMap.get(g.vehicleId);
      return {
        vehicleId: g.vehicleId,
        name: v?.name ?? "Unknown vehicle",
        title: v ? vehicleTitle(v) : "—",
        meterUnit: v?.meterUnit ?? "mi",
        fuelType: v?.fuelType ?? null,
        entries: g._count._all,
        volume: g._sum.volume ?? 0,
        cost: g._sum.total ?? 0,
        avgEconomy: g._avg.fuelEconomy,
        avgPrice: g._avg.pricePerUnit,
      };
    })
    .sort((a, b) => b.cost - a.cost);
}

// ── Service history ──────────────────────────────────────────────

export async function getServiceHistory(f: ReportFilters) {
  const range = dateRange(f);
  return db.serviceEntry.findMany({
    where: {
      ...(f.vehicleId ? { vehicleId: f.vehicleId } : {}),
      ...(range ? { date: range } : {}),
    },
    include: {
      vehicle: { select: { id: true, name: true, year: true, make: true, model: true, meterUnit: true } },
      vendor: { select: { id: true, name: true } },
      lines: { include: { task: { select: { name: true } } } },
    },
    orderBy: { date: "desc" },
  });
}

export function serviceEntryTasks(entry: {
  lines: { task: { name: string } | null; description: string | null }[];
}): string {
  const names = entry.lines
    .map((l) => l.task?.name ?? l.description)
    .filter((n): n is string => Boolean(n));
  return names.length ? names.join(", ") : "—";
}

// ── Issues list ──────────────────────────────────────────────────

export type IssueFilters = ReportFilters & {
  status: string | null;
  priority: string | null;
  source: string | null;
};

export function parseIssueFilters(sp: SearchParams): IssueFilters {
  return {
    ...parseFilters(sp),
    status: str(sp, "status"),
    priority: str(sp, "priority"),
    source: str(sp, "source"),
  };
}

export async function getIssuesList(f: IssueFilters) {
  const range = dateRange(f);
  return db.issue.findMany({
    where: {
      ...(f.vehicleId ? { vehicleId: f.vehicleId } : {}),
      ...(range ? { reportedAt: range } : {}),
      ...(f.status ? { status: f.status } : {}),
      ...(f.priority ? { priority: f.priority } : {}),
      ...(f.source ? { source: f.source } : {}),
    },
    include: {
      vehicle: { select: { id: true, name: true } },
      assignedTo: { select: { firstName: true, lastName: true } },
    },
    orderBy: { reportedAt: "desc" },
  });
}

// ── Work order status ────────────────────────────────────────────

export type WorkOrderFilters = ReportFilters & { status: string | null };

export function parseWorkOrderFilters(sp: SearchParams): WorkOrderFilters {
  return { ...parseFilters(sp), status: str(sp, "status") };
}

export async function getWorkOrderStatus(f: WorkOrderFilters) {
  const range = dateRange(f);
  const base = {
    ...(f.vehicleId ? { vehicleId: f.vehicleId } : {}),
    ...(range ? { issuedAt: range } : {}),
  };
  const [counts, rows] = await Promise.all([
    db.workOrder.groupBy({ by: ["status"], _count: { _all: true }, where: base }),
    db.workOrder.findMany({
      where: { ...base, ...(f.status ? { status: f.status } : {}) },
      include: {
        vehicle: { select: { id: true, name: true } },
        assignedTo: { select: { firstName: true, lastName: true } },
        vendor: { select: { name: true } },
      },
      orderBy: { issuedAt: "desc" },
    }),
  ]);
  const countMap = new Map(counts.map((c) => [c.status, c._count._all]));
  return { countMap, rows };
}

// ── Parts activity ───────────────────────────────────────────────

export type PartsActivityFilters = ReportFilters & { reason: string | null };

export function parsePartsActivityFilters(sp: SearchParams): PartsActivityFilters {
  return { ...parseFilters(sp), reason: str(sp, "reason") };
}

export async function getPartsActivity(f: PartsActivityFilters) {
  const range = dateRange(f);
  return db.partAdjustment.findMany({
    where: {
      ...(range ? { createdAt: range } : {}),
      ...(f.reason ? { reason: f.reason } : {}),
    },
    include: {
      part: { select: { id: true, number: true, description: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

// ── Vehicle status ───────────────────────────────────────────────

export type VehicleStatusFilters = { status: string | null };

export function parseVehicleStatusFilters(sp: SearchParams): VehicleStatusFilters {
  return { status: str(sp, "status") };
}

export async function getVehicleStatusReport(f: VehicleStatusFilters) {
  const [counts, rows] = await Promise.all([
    db.vehicle.groupBy({
      by: ["status"],
      _count: { _all: true },
      where: { archived: false },
    }),
    db.vehicle.findMany({
      where: { archived: false, ...(f.status ? { status: f.status } : {}) },
      include: { group: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
  ]);
  const countMap = new Map(counts.map((c) => [c.status, c._count._all]));
  return { countMap, rows };
}

// ── CSV helpers ──────────────────────────────────────────────────

export type CsvValue = string | number | null | undefined;

export function toCsv(headers: string[], rows: CsvValue[][]): string {
  const esc = (v: CsvValue): string => {
    if (v == null) return "";
    const s = typeof v === "number" ? String(Math.round(v * 100) / 100) : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map((r) => r.map(esc).join(",")).join("\r\n") + "\r\n";
}

export function csvResponse(filename: string, csv: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export function spFromRequest(req: Request): SearchParams {
  return Object.fromEntries(new URL(req.url).searchParams.entries());
}
