import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Tabs } from "@/components/ui/Tabs";
import { DataTable, Td } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink, Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Select, TextInput } from "@/components/ui/FormField";
import { VEHICLE_STATUS, ASSET_TYPE } from "@/lib/enums";
import { meter, vehicleTitle } from "@/lib/format";

export const dynamic = "force-dynamic";

const AVATAR_COLORS = [
  "bg-indigo-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-sky-500",
  "bg-purple-500",
];

function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const tab = first(sp.tab) || "all";
  const q = first(sp.q)?.trim() || "";
  const status = first(sp.status) || "";
  const groupId = first(sp.group) || "";
  const assetType = first(sp.assetType) || "";

  const where: Prisma.VehicleWhereInput = {
    archived: tab === "archived",
  };
  if (tab === "assigned") where.assignments = { some: { current: true } };
  if (tab === "unassigned") where.assignments = { none: { current: true } };
  if (status) where.status = status;
  if (groupId) where.groupId = groupId;
  if (assetType) where.assetType = assetType;
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { vin: { contains: q } },
      { licensePlate: { contains: q } },
    ];
  }

  const [vehicles, groups, total, active, inShop, outOfService] = await Promise.all([
    db.vehicle.findMany({
      where,
      include: {
        group: true,
        assignments: { where: { current: true }, include: { contact: true } },
        _count: {
          select: { issues: { where: { status: { in: ["open", "overdue"] } } } },
        },
      },
      orderBy: { name: "asc" },
    }),
    db.vehicleGroup.findMany({ orderBy: { name: "asc" } }),
    db.vehicle.count({ where: { archived: false } }),
    db.vehicle.count({ where: { archived: false, status: "active" } }),
    db.vehicle.count({ where: { archived: false, status: "in_shop" } }),
    db.vehicle.count({ where: { archived: false, status: "out_of_service" } }),
  ]);

  const keepParams = new URLSearchParams();
  if (q) keepParams.set("q", q);
  if (status) keepParams.set("status", status);
  if (groupId) keepParams.set("group", groupId);
  if (assetType) keepParams.set("assetType", assetType);
  const keepQuery = keepParams.toString();
  const tabHref = (t: string) => `/vehicles?tab=${t}${keepQuery ? `&${keepQuery}` : ""}`;

  return (
    <div>
      <PageHeader
        title="Vehicles"
        subtitle="All fleet assets — vehicles, equipment, and trailers"
        actions={<ButtonLink href="/vehicles/new">+ New Vehicle</ButtonLink>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total vehicles" value={total} />
        <StatCard label="Active" value={active} accent="text-emerald-600" />
        <StatCard label="In shop" value={inShop} accent="text-amber-600" />
        <StatCard label="Out of service" value={outOfService} accent="text-red-600" />
      </div>

      <Tabs
        active={tab}
        tabs={[
          { key: "all", label: "All", href: tabHref("all") },
          { key: "assigned", label: "Assigned", href: tabHref("assigned") },
          { key: "unassigned", label: "Unassigned", href: tabHref("unassigned") },
          { key: "archived", label: "Archived", href: tabHref("archived") },
        ]}
      />

      <form method="GET" action="/vehicles" className="mb-4 flex flex-wrap items-end gap-3">
        <input type="hidden" name="tab" value={tab} />
        <div className="w-64">
          <TextInput name="q" placeholder="Search name, VIN, plate…" defaultValue={q} />
        </div>
        <div className="w-44">
          <Select name="status" defaultValue={status}>
            <option value="">All statuses</option>
            {Object.entries(VEHICLE_STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-44">
          <Select name="group" defaultValue={groupId}>
            <option value="">All groups</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-44">
          <Select name="assetType" defaultValue={assetType}>
            <option value="">All types</option>
            {Object.entries(ASSET_TYPE).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="secondary">
          Apply
        </Button>
      </form>

      {vehicles.length === 0 ? (
        <EmptyState
          title="No vehicles match"
          hint="Try clearing filters, or add a new vehicle to the fleet."
          action={<ButtonLink href="/vehicles/new">+ New Vehicle</ButtonLink>}
        />
      ) : (
        <DataTable
          headers={[
            "",
            "Name",
            "Year / Make / Model",
            "VIN",
            "Plate",
            "Status",
            "Group",
            "Operator",
            "Meter",
            "Open Issues",
          ]}
        >
          {vehicles.map((v) => {
            const operator = v.assignments[0]?.contact;
            return (
              <tr key={v.id} className="hover:bg-slate-50/60">
                <Td className="w-12">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-white ${avatarColor(v.name)}`}
                  >
                    {v.name.charAt(0).toUpperCase()}
                  </span>
                </Td>
                <Td>
                  <Link href={`/vehicles/${v.id}`} className="font-medium text-indigo-600 hover:underline">
                    {v.name}
                  </Link>
                </Td>
                <Td>{vehicleTitle(v)}</Td>
                <Td className="font-mono text-xs">{v.vin ?? "—"}</Td>
                <Td>{v.licensePlate ?? "—"}</Td>
                <Td>
                  <StatusBadge def={VEHICLE_STATUS} value={v.status} />
                </Td>
                <Td>{v.group?.name ?? "—"}</Td>
                <Td>
                  {operator ? (
                    <Link href={`/contacts/${operator.id}`} className="text-indigo-600 hover:underline">
                      {operator.firstName} {operator.lastName}
                    </Link>
                  ) : (
                    <span className="text-slate-400">Unassigned</span>
                  )}
                </Td>
                <Td>{meter(v.currentMeter, v.meterUnit)}</Td>
                <Td>
                  {v._count.issues > 0 ? (
                    <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                      {v._count.issues}
                    </span>
                  ) : (
                    <span className="text-slate-400">0</span>
                  )}
                </Td>
              </tr>
            );
          })}
        </DataTable>
      )}
    </div>
  );
}
