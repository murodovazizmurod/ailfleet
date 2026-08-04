import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { money, num, shortDate } from "@/lib/format";
import { PO_STATUS, WORK_ORDER_STATUS } from "@/lib/enums";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, FieldRow } from "@/components/ui/Card";
import { DataTable, Td } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ButtonLink } from "@/components/ui/Button";
import { VENDOR_CLASSIFICATION, parseClassifications } from "../classifications";

export const dynamic = "force-dynamic";

export default async function VendorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const vendor = await db.vendor.findUnique({
    where: { id },
    include: {
      fuelEntries: {
        include: { vehicle: true },
        orderBy: { date: "desc" },
        take: 5,
      },
      serviceEntries: {
        include: { vehicle: true },
        orderBy: { date: "desc" },
        take: 5,
      },
      workOrders: {
        include: { vehicle: true },
        orderBy: { issuedAt: "desc" },
        take: 5,
      },
      purchaseOrders: {
        include: { _count: { select: { lines: true } } },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      _count: {
        select: {
          fuelEntries: true,
          serviceEntries: true,
          workOrders: true,
          purchaseOrders: true,
        },
      },
    },
  });
  if (!vendor) notFound();

  const classifications = parseClassifications(vendor.classifications);

  return (
    <div>
      <PageHeader
        title={vendor.name}
        subtitle={
          classifications.length > 0 ? (
            <span className="mt-1 flex flex-wrap gap-1">
              {classifications.map((c) => (
                <StatusBadge key={c} def={VENDOR_CLASSIFICATION} value={c} />
              ))}
            </span>
          ) : (
            "Vendor detail"
          )
        }
        actions={<ButtonLink href="/vendors" variant="secondary">Back to Vendors</ButtonLink>}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title={`Recent Fuel Entries (${num(vendor._count.fuelEntries)})`}>
            {vendor.fuelEntries.length === 0 ? (
              <p className="text-sm text-slate-500">No fuel entries from this vendor.</p>
            ) : (
              <DataTable headers={["Date", "Vehicle", "Volume", "Total"]}>
                {vendor.fuelEntries.map((e) => (
                  <tr key={e.id}>
                    <Td>{shortDate(e.date)}</Td>
                    <Td>
                      <Link
                        href={`/vehicles/${e.vehicleId}`}
                        className="text-indigo-600 hover:underline"
                      >
                        {e.vehicle.name}
                      </Link>
                    </Td>
                    <Td>{num(e.volume, 2)} gal</Td>
                    <Td className="font-medium text-slate-900">{money(e.total)}</Td>
                  </tr>
                ))}
              </DataTable>
            )}
          </Card>

          <Card title={`Recent Service Entries (${num(vendor._count.serviceEntries)})`}>
            {vendor.serviceEntries.length === 0 ? (
              <p className="text-sm text-slate-500">No service entries from this vendor.</p>
            ) : (
              <DataTable headers={["Date", "Vehicle", "Reference", "Total"]}>
                {vendor.serviceEntries.map((e) => (
                  <tr key={e.id}>
                    <Td>{shortDate(e.date)}</Td>
                    <Td>
                      <Link
                        href={`/vehicles/${e.vehicleId}`}
                        className="text-indigo-600 hover:underline"
                      >
                        {e.vehicle.name}
                      </Link>
                    </Td>
                    <Td>{e.reference ?? "—"}</Td>
                    <Td className="font-medium text-slate-900">{money(e.total)}</Td>
                  </tr>
                ))}
              </DataTable>
            )}
          </Card>

          <Card title={`Recent Work Orders (${num(vendor._count.workOrders)})`}>
            {vendor.workOrders.length === 0 ? (
              <p className="text-sm text-slate-500">No work orders with this vendor.</p>
            ) : (
              <DataTable headers={["WO #", "Vehicle", "Status", "Issued", "Total"]}>
                {vendor.workOrders.map((wo) => (
                  <tr key={wo.id}>
                    <Td>
                      <Link
                        href={`/work-orders/${wo.id}`}
                        className="font-medium text-indigo-600 hover:underline"
                      >
                        #{wo.number}
                      </Link>
                    </Td>
                    <Td>{wo.vehicle.name}</Td>
                    <Td>
                      <StatusBadge def={WORK_ORDER_STATUS} value={wo.status} />
                    </Td>
                    <Td>{shortDate(wo.issuedAt)}</Td>
                    <Td className="font-medium text-slate-900">{money(wo.total)}</Td>
                  </tr>
                ))}
              </DataTable>
            )}
          </Card>

          <Card title={`Recent Purchase Orders (${num(vendor._count.purchaseOrders)})`}>
            {vendor.purchaseOrders.length === 0 ? (
              <p className="text-sm text-slate-500">No purchase orders for this vendor.</p>
            ) : (
              <DataTable headers={["PO #", "Status", "Lines", "Created", "Total"]}>
                {vendor.purchaseOrders.map((po) => (
                  <tr key={po.id}>
                    <Td>
                      <Link
                        href={`/purchase-orders/${po.id}`}
                        className="font-medium text-indigo-600 hover:underline"
                      >
                        #{po.number}
                      </Link>
                    </Td>
                    <Td>
                      <StatusBadge def={PO_STATUS} value={po.status} />
                    </Td>
                    <Td>{num(po._count.lines)}</Td>
                    <Td>{shortDate(po.createdAt)}</Td>
                    <Td className="font-medium text-slate-900">{money(po.total)}</Td>
                  </tr>
                ))}
              </DataTable>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Details">
            <dl className="divide-y divide-slate-100">
              <FieldRow label="Contact" value={vendor.contactName ?? "—"} />
              <FieldRow label="Phone" value={vendor.phone ?? "—"} />
              <FieldRow
                label="Email"
                value={
                  vendor.email ? (
                    <a
                      href={`mailto:${vendor.email}`}
                      className="text-indigo-600 hover:underline"
                    >
                      {vendor.email}
                    </a>
                  ) : (
                    "—"
                  )
                }
              />
              <FieldRow
                label="Website"
                value={
                  vendor.website ? (
                    <a
                      href={vendor.website}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-600 hover:underline"
                    >
                      {vendor.website.replace(/^https?:\/\//, "")}
                    </a>
                  ) : (
                    "—"
                  )
                }
              />
              <FieldRow label="Address" value={vendor.address ?? "—"} />
              <FieldRow label="Fuel Entries" value={num(vendor._count.fuelEntries)} />
              <FieldRow label="Service Entries" value={num(vendor._count.serviceEntries)} />
              <FieldRow label="Work Orders" value={num(vendor._count.workOrders)} />
              <FieldRow label="Purchase Orders" value={num(vendor._count.purchaseOrders)} />
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
