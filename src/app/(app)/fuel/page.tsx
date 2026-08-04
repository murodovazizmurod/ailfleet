import Link from "next/link";
import { db } from "@/lib/db";
import { money, num, shortDate, vehicleTitle } from "@/lib/format";
import type { EnumDef } from "@/lib/enums";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Tabs } from "@/components/ui/Tabs";
import { DataTable, Td } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Select } from "@/components/ui/FormField";
import { StatusBadge } from "@/components/ui/StatusBadge";

export const dynamic = "force-dynamic";

const FUEL_SOURCE: EnumDef = {
  manual: { label: "Manual", color: "gray" },
  fuel_card: { label: "Fuel Card", color: "blue" },
};

const ENTRY_FLAGS: EnumDef = {
  partial: { label: "Partial", color: "yellow" },
  flagged: { label: "Flagged", color: "red" },
  personal: { label: "Personal", color: "purple" },
};

export default async function FuelPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; vehicleId?: string; vendorId?: string }>;
}) {
  const { tab = "fuel", vehicleId, vendorId } = await searchParams;
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [agg, economyAgg, fuelCount, chargingCount] = await Promise.all([
    db.fuelEntry.aggregate({
      where: { date: { gte: since } },
      _sum: { total: true, volume: true },
    }),
    db.fuelEntry.aggregate({
      where: { date: { gte: since }, fuelEconomy: { not: null } },
      _avg: { fuelEconomy: true },
    }),
    db.fuelEntry.count(),
    db.chargingEntry.count(),
  ]);

  const totalCost = agg._sum.total ?? 0;
  const totalVolume = agg._sum.volume ?? 0;
  const avgEconomy = economyAgg._avg.fuelEconomy;
  const avgPrice = totalVolume > 0 ? totalCost / totalVolume : null;

  const tabs = [
    { key: "fuel", label: "Fuel Entries", href: "/fuel?tab=fuel", count: fuelCount },
    {
      key: "charging",
      label: "Charging Entries",
      href: "/fuel?tab=charging",
      count: chargingCount,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Fuel & Energy"
        subtitle="Fuel and EV charging history across the fleet"
        actions={
          <>
            <ButtonLink href="/fuel/new-charging" variant="secondary">
              + New Charging Entry
            </ButtonLink>
            <ButtonLink href="/fuel/new">+ New Fuel Entry</ButtonLink>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Fuel Cost" value={money(totalCost)} hint="Last 30 days" />
        <StatCard
          label="Total Volume"
          value={`${num(totalVolume, 1)} gal`}
          hint="Last 30 days"
        />
        <StatCard
          label="Avg Fuel Economy"
          value={avgEconomy != null ? `${num(avgEconomy, 1)} MPG` : "—"}
          hint="Fleet average, last 30 days"
        />
        <StatCard
          label="Avg Price / Gallon"
          value={avgPrice != null ? money(avgPrice) : "—"}
          hint="Last 30 days"
        />
      </div>

      <Tabs tabs={tabs} active={tab === "charging" ? "charging" : "fuel"} />

      {tab === "charging" ? (
        <ChargingTable />
      ) : (
        <FuelTable vehicleId={vehicleId} vendorId={vendorId} />
      )}
    </div>
  );
}

async function FuelTable({
  vehicleId,
  vendorId,
}: {
  vehicleId?: string;
  vendorId?: string;
}) {
  const [entries, vehicles, vendors] = await Promise.all([
    db.fuelEntry.findMany({
      where: {
        ...(vehicleId ? { vehicleId } : {}),
        ...(vendorId ? { vendorId } : {}),
      },
      include: { vehicle: true, vendor: true },
      orderBy: { date: "desc" },
      take: 200,
    }),
    db.vehicle.findMany({ where: { archived: false }, orderBy: { name: "asc" } }),
    db.vendor.findMany({
      where: { archived: false, classifications: { contains: "fuel" } },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div>
      <form method="get" action="/fuel" className="mb-4 flex flex-wrap items-end gap-3">
        <input type="hidden" name="tab" value="fuel" />
        <div className="w-56">
          <Select name="vehicleId" defaultValue={vehicleId ?? ""}>
            <option value="">All vehicles</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-56">
          <Select name="vendorId" defaultValue={vendorId ?? ""}>
            <option value="">All vendors</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
        {vehicleId || vendorId ? (
          <Link
            href="/fuel?tab=fuel"
            className="text-sm text-indigo-600 hover:underline"
          >
            Clear
          </Link>
        ) : null}
      </form>

      {entries.length === 0 ? (
        <EmptyState
          title="No fuel entries found"
          hint="Log a fill-up to start tracking fuel costs and economy."
          action={<ButtonLink href="/fuel/new">+ New Fuel Entry</ButtonLink>}
        />
      ) : (
        <DataTable
          headers={[
            "Date",
            "Vehicle",
            "Vendor",
            "Meter",
            "Volume",
            "Price / Unit",
            "Total",
            "Economy",
            "Source",
            "Flags",
          ]}
        >
          {entries.map((e) => (
            <tr key={e.id} className="hover:bg-slate-50">
              <Td>{shortDate(e.date)}</Td>
              <Td>
                <Link
                  href={`/vehicles/${e.vehicleId}`}
                  className="font-medium text-indigo-600 hover:underline"
                >
                  {e.vehicle.name}
                </Link>
                <div className="text-xs text-slate-400">{vehicleTitle(e.vehicle)}</div>
              </Td>
              <Td>{e.vendor?.name ?? "—"}</Td>
              <Td>{e.meter != null ? `${num(e.meter)} ${e.vehicle.meterUnit}` : "—"}</Td>
              <Td>{num(e.volume, 2)} gal</Td>
              <Td>{money(e.pricePerUnit)}</Td>
              <Td className="font-medium text-slate-900">{money(e.total)}</Td>
              <Td>{e.fuelEconomy != null ? `${num(e.fuelEconomy, 1)} MPG` : "—"}</Td>
              <Td>
                <StatusBadge def={FUEL_SOURCE} value={e.source} />
              </Td>
              <Td>
                <span className="flex flex-wrap gap-1">
                  {e.partial ? <StatusBadge def={ENTRY_FLAGS} value="partial" /> : null}
                  {e.flagged ? (
                    <span title={e.flagReason ?? undefined}>
                      <StatusBadge def={ENTRY_FLAGS} value="flagged" />
                    </span>
                  ) : null}
                  {e.personal ? <StatusBadge def={ENTRY_FLAGS} value="personal" /> : null}
                  {!e.partial && !e.flagged && !e.personal ? (
                    <span className="text-slate-400">—</span>
                  ) : null}
                </span>
              </Td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}

async function ChargingTable() {
  const entries = await db.chargingEntry.findMany({
    include: { vehicle: true },
    orderBy: { date: "desc" },
    take: 200,
  });

  if (entries.length === 0) {
    return (
      <EmptyState
        title="No charging entries yet"
        hint="Log an EV charging session to start tracking energy costs."
        action={<ButtonLink href="/fuel/new-charging">+ New Charging Entry</ButtonLink>}
      />
    );
  }

  return (
    <DataTable headers={["Date", "Vehicle", "Energy", "Duration", "Cost", "Location"]}>
      {entries.map((e) => (
        <tr key={e.id} className="hover:bg-slate-50">
          <Td>{shortDate(e.date)}</Td>
          <Td>
            <Link
              href={`/vehicles/${e.vehicleId}`}
              className="font-medium text-indigo-600 hover:underline"
            >
              {e.vehicle.name}
            </Link>
            <div className="text-xs text-slate-400">{vehicleTitle(e.vehicle)}</div>
          </Td>
          <Td>{num(e.energyKwh, 1)} kWh</Td>
          <Td>{e.durationMin != null ? `${num(e.durationMin)} min` : "—"}</Td>
          <Td className="font-medium text-slate-900">{money(e.cost)}</Td>
          <Td>{e.location ?? "—"}</Td>
        </tr>
      ))}
    </DataTable>
  );
}
