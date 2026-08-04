import Link from "next/link";
import { db } from "@/lib/db";
import { money, num, shortDate } from "@/lib/format";
import { PO_STATUS } from "@/lib/enums";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Tabs } from "@/components/ui/Tabs";
import { DataTable, Td } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";

export const dynamic = "force-dynamic";

const STATUS_GROUPS: Record<string, { label: string; statuses: string[] }> = {
  all: { label: "All", statuses: [] },
  draft: { label: "Draft", statuses: ["draft"] },
  pending: { label: "Pending Approval", statuses: ["pending_approval"] },
  approved: { label: "Approved", statuses: ["approved"] },
  receiving: { label: "Purchased / Receiving", statuses: ["purchased", "received_partial"] },
  received: { label: "Received", statuses: ["received_full"] },
  closed: { label: "Closed / Rejected", statuses: ["closed", "rejected"] },
};

const OPEN_STATUSES = ["pending_approval", "approved", "purchased", "received_partial"];

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status = "all" } = await searchParams;
  const group = STATUS_GROUPS[status] ?? STATUS_GROUPS.all;
  const activeKey = STATUS_GROUPS[status] ? status : "all";

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [pos, allPos, pendingCount, openAgg, receivedAgg] = await Promise.all([
    db.purchaseOrder.findMany({
      where:
        group.statuses.length > 0 ? { status: { in: group.statuses } } : undefined,
      include: { vendor: true, _count: { select: { lines: true } } },
      orderBy: { number: "desc" },
    }),
    db.purchaseOrder.findMany({ select: { status: true } }),
    db.purchaseOrder.count({ where: { status: "pending_approval" } }),
    db.purchaseOrder.aggregate({
      where: { status: { in: OPEN_STATUSES } },
      _sum: { total: true },
    }),
    db.purchaseOrder.aggregate({
      where: { receivedAt: { gte: monthStart } },
      _sum: { total: true },
    }),
  ]);

  const countFor = (key: string) => {
    const g = STATUS_GROUPS[key];
    if (g.statuses.length === 0) return allPos.length;
    return allPos.filter((p) => g.statuses.includes(p.status)).length;
  };

  const tabs = Object.entries(STATUS_GROUPS).map(([key, g]) => ({
    key,
    label: g.label,
    href: `/purchase-orders?status=${key}`,
    count: countFor(key),
  }));

  return (
    <div>
      <PageHeader
        title="Purchase Orders"
        subtitle="Parts purchasing workflow from draft to receiving"
        actions={<ButtonLink href="/purchase-orders/new">+ New Purchase Order</ButtonLink>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Pending Approval"
          value={num(pendingCount)}
          accent={pendingCount > 0 ? "text-amber-600" : "text-slate-900"}
          href="/purchase-orders?status=pending"
        />
        <StatCard
          label="Open Value"
          value={money(openAgg._sum.total ?? 0)}
          hint="Pending, approved and receiving orders"
        />
        <StatCard
          label="Received This Month"
          value={money(receivedAgg._sum.total ?? 0)}
          hint={`Since ${shortDate(monthStart)}`}
        />
      </div>

      <Tabs tabs={tabs} active={activeKey} />

      {pos.length === 0 ? (
        <EmptyState
          title="No purchase orders here"
          hint="Create a purchase order to restock parts from a vendor."
          action={<ButtonLink href="/purchase-orders/new">+ New Purchase Order</ButtonLink>}
        />
      ) : (
        <DataTable
          headers={["PO #", "Vendor", "Status", "Description", "Lines", "Total", "Created"]}
        >
          {pos.map((po) => (
            <tr key={po.id} className="hover:bg-slate-50">
              <Td>
                <Link
                  href={`/purchase-orders/${po.id}`}
                  className="font-medium text-indigo-600 hover:underline"
                >
                  #{po.number}
                </Link>
              </Td>
              <Td>{po.vendor.name}</Td>
              <Td>
                <StatusBadge def={PO_STATUS} value={po.status} />
              </Td>
              <Td className="max-w-xs truncate text-slate-500">{po.description ?? "—"}</Td>
              <Td>{num(po._count.lines)}</Td>
              <Td className="font-medium text-slate-900">{money(po.total)}</Td>
              <Td>{shortDate(po.createdAt)}</Td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}
