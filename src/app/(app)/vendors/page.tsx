import Link from "next/link";
import { db } from "@/lib/db";
import { num } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { DataTable, Td } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { VENDOR_CLASSIFICATION, parseClassifications } from "./classifications";

export const dynamic = "force-dynamic";

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab = "all" } = await searchParams;

  const vendors = await db.vendor.findMany({
    where: { archived: false },
    include: {
      _count: {
        select: { fuelEntries: true, serviceEntries: true, purchaseOrders: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const enriched = vendors.map((v) => ({
    vendor: v,
    classifications: parseClassifications(v.classifications),
  }));

  const matches = (classifications: string[], key: string) =>
    key === "vehicles"
      ? classifications.includes("vehicles") || classifications.includes("vehicle")
      : classifications.includes(key);

  const countFor = (key: string) =>
    key === "all"
      ? enriched.length
      : enriched.filter((e) => matches(e.classifications, key)).length;

  const visible =
    tab === "all" ? enriched : enriched.filter((e) => matches(e.classifications, tab));

  const tabDefs = [
    { key: "all", label: "All" },
    { key: "fuel", label: "Fuel" },
    { key: "service", label: "Service" },
    { key: "parts", label: "Parts" },
  ];
  const tabs = tabDefs.map((t) => ({
    key: t.key,
    label: t.label,
    href: `/vendors?tab=${t.key}`,
    count: countFor(t.key),
  }));

  return (
    <div>
      <PageHeader
        title="Vendors"
        subtitle="Fuel stations, service shops and parts suppliers"
        actions={<ButtonLink href="/vendors/new">+ New Vendor</ButtonLink>}
      />

      <Tabs tabs={tabs} active={tabDefs.some((t) => t.key === tab) ? tab : "all"} />

      {visible.length === 0 ? (
        <EmptyState
          title="No vendors here"
          hint="Add a vendor to use it on fuel entries, service entries and purchase orders."
          action={<ButtonLink href="/vendors/new">+ New Vendor</ButtonLink>}
        />
      ) : (
        <DataTable
          headers={[
            "Name",
            "Classifications",
            "Contact",
            "Fuel Entries",
            "Service Entries",
            "Purchase Orders",
          ]}
        >
          {visible.map(({ vendor, classifications }) => (
            <tr key={vendor.id} className="hover:bg-slate-50">
              <Td>
                <Link
                  href={`/vendors/${vendor.id}`}
                  className="font-medium text-indigo-600 hover:underline"
                >
                  {vendor.name}
                </Link>
              </Td>
              <Td>
                {classifications.length > 0 ? (
                  <span className="flex flex-wrap gap-1">
                    {classifications.map((c) => (
                      <StatusBadge key={c} def={VENDOR_CLASSIFICATION} value={c} />
                    ))}
                  </span>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </Td>
              <Td>
                <div>{vendor.phone ?? "—"}</div>
                <div className="text-xs text-slate-400">{vendor.email ?? ""}</div>
              </Td>
              <Td>{num(vendor._count.fuelEntries)}</Td>
              <Td>{num(vendor._count.serviceEntries)}</Td>
              <Td>{num(vendor._count.purchaseOrders)}</Td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}
