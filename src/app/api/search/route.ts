import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export type SearchHit = {
  type: string;
  label: string;
  sublabel: string;
  href: string;
};

// Global search across all major entities. SQLite LIKE is ASCII
// case-insensitive, so plain `contains` behaves as expected.
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ hits: [] });

  const num = /^#?(\d+)$/.exec(q);
  const asNumber = num ? parseInt(num[1], 10) : null;

  const [vehicles, contacts, issues, workOrders, serviceEntries, parts, vendors] =
    await Promise.all([
      db.vehicle.findMany({
        where: {
          archived: false,
          OR: [
            { name: { contains: q } },
            { vin: { contains: q } },
            { licensePlate: { contains: q } },
            { make: { contains: q } },
            { model: { contains: q } },
          ],
        },
        take: 5,
        orderBy: { name: "asc" },
      }),
      db.contact.findMany({
        where: {
          archived: false,
          OR: [
            { firstName: { contains: q } },
            { lastName: { contains: q } },
            { email: { contains: q } },
          ],
        },
        take: 5,
      }),
      db.issue.findMany({
        where: {
          OR: [
            { summary: { contains: q } },
            ...(asNumber != null ? [{ number: asNumber }] : []),
          ],
        },
        include: { vehicle: { select: { name: true } } },
        take: 5,
        orderBy: { number: "desc" },
      }),
      db.workOrder.findMany({
        where: {
          OR: [
            { description: { contains: q } },
            ...(asNumber != null ? [{ number: asNumber }] : []),
          ],
        },
        include: { vehicle: { select: { name: true } } },
        take: 5,
        orderBy: { number: "desc" },
      }),
      db.serviceEntry.findMany({
        where: {
          OR: [
            { reference: { contains: q } },
            { invoiceNumber: { contains: q } },
            { notes: { contains: q } },
          ],
        },
        include: { vehicle: { select: { name: true } } },
        take: 5,
        orderBy: { date: "desc" },
      }),
      db.part.findMany({
        where: {
          archived: false,
          OR: [{ number: { contains: q } }, { description: { contains: q } }],
        },
        take: 5,
      }),
      db.vendor.findMany({
        where: { archived: false, name: { contains: q } },
        take: 5,
      }),
    ]);

  const hits: SearchHit[] = [
    ...vehicles.map((v) => ({
      type: "Vehicle",
      label: v.name,
      sublabel: [v.year, v.make, v.model].filter(Boolean).join(" ") + (v.vin ? ` · ${v.vin}` : ""),
      href: `/vehicles/${v.id}`,
    })),
    ...contacts.map((c) => ({
      type: "Contact",
      label: `${c.firstName} ${c.lastName}`,
      sublabel: c.jobTitle ?? "Contact",
      href: `/contacts/${c.id}`,
    })),
    ...issues.map((i) => ({
      type: "Issue",
      label: `#${i.number} ${i.summary}`,
      sublabel: `${i.vehicle.name} · ${i.status}`,
      href: `/issues/${i.id}`,
    })),
    ...workOrders.map((w) => ({
      type: "Work Order",
      label: `WO #${w.number}`,
      sublabel: `${w.vehicle.name} · ${w.status}${w.description ? ` · ${w.description.slice(0, 60)}` : ""}`,
      href: `/work-orders/${w.id}`,
    })),
    ...serviceEntries.map((s) => ({
      type: "Service Entry",
      label: `Service — ${s.vehicle.name}`,
      sublabel: `${s.date.toISOString().slice(0, 10)}${s.invoiceNumber ? ` · ${s.invoiceNumber}` : s.reference ? ` · ${s.reference}` : ""}`,
      href: `/service-entries/${s.id}`,
    })),
    ...parts.map((p) => ({
      type: "Part",
      label: p.number,
      sublabel: p.description ?? "Part",
      href: `/parts/${p.id}`,
    })),
    ...vendors.map((v) => ({
      type: "Vendor",
      label: v.name,
      sublabel: "Vendor",
      href: `/vendors/${v.id}`,
    })),
  ];

  return NextResponse.json({ hits: hits.slice(0, 25) });
}
