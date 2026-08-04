import Link from "next/link";
import { db } from "@/lib/db";
import { money, num } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Tabs } from "@/components/ui/Tabs";
import { DataTable, Td } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button, ButtonLink } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/FormField";

export const dynamic = "force-dynamic";

export default async function PartsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  const { tab = "all", q } = await searchParams;

  const parts = await db.part.findMany({
    where: {
      archived: false,
      ...(q
        ? {
            OR: [
              { number: { contains: q } },
              { description: { contains: q } },
            ],
          }
        : {}),
    },
    include: { stocks: { include: { location: true } } },
    orderBy: { number: "asc" },
  });

  const enriched = parts.map((p) => {
    const totalQty = p.stocks.reduce((s, st) => s + st.quantity, 0);
    const belowReorder = p.stocks.some(
      (st) => st.reorderPoint != null && st.quantity <= st.reorderPoint
    );
    const outOfStock = p.stocks.length > 0 && totalQty <= 0;
    return { part: p, totalQty, belowReorder, outOfStock };
  });

  const totalParts = enriched.length;
  const stockValue = enriched.reduce(
    (s, e) =>
      s + e.part.stocks.reduce((acc, st) => acc + st.quantity * e.part.unitCost, 0),
    0
  );
  const lowCount = enriched.filter((e) => e.belowReorder && !e.outOfStock).length;
  const outCount = enriched.filter((e) => e.outOfStock).length;

  const visible =
    tab === "low"
      ? enriched.filter((e) => e.belowReorder && !e.outOfStock)
      : tab === "out"
        ? enriched.filter((e) => e.outOfStock)
        : enriched;

  const qParam = q ? `&q=${encodeURIComponent(q)}` : "";
  const tabs = [
    { key: "all", label: "All Parts", href: `/parts?tab=all${qParam}`, count: totalParts },
    { key: "low", label: "Low Stock", href: `/parts?tab=low${qParam}`, count: lowCount },
    { key: "out", label: "Out of Stock", href: `/parts?tab=out${qParam}`, count: outCount },
  ];

  return (
    <div>
      <PageHeader
        title="Parts & Inventory"
        subtitle="Parts catalog and stock levels across locations"
        actions={<ButtonLink href="/parts/new">+ New Part</ButtonLink>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Parts" value={num(totalParts)} />
        <StatCard label="Total Stock Value" value={money(stockValue)} hint="Qty × unit cost" />
        <StatCard
          label="Below Reorder Point"
          value={num(lowCount)}
          accent={lowCount > 0 ? "text-orange-600" : "text-slate-900"}
        />
        <StatCard
          label="Out of Stock"
          value={num(outCount)}
          accent={outCount > 0 ? "text-red-600" : "text-slate-900"}
        />
      </div>

      <Tabs tabs={tabs} active={tab === "low" || tab === "out" ? tab : "all"} />

      <form method="get" action="/parts" className="mb-4 flex items-center gap-2">
        <input type="hidden" name="tab" value={tab} />
        <div className="w-72">
          <TextInput
            type="search"
            name="q"
            placeholder="Search by part number or description…"
            defaultValue={q ?? ""}
          />
        </div>
        <Button type="submit" variant="secondary">
          Search
        </Button>
        {q ? (
          <Link href={`/parts?tab=${tab}`} className="text-sm text-indigo-600 hover:underline">
            Clear
          </Link>
        ) : null}
      </form>

      {visible.length === 0 ? (
        <EmptyState
          title={q ? "No parts match your search" : "No parts here"}
          hint={
            q
              ? "Try a different part number or description."
              : "Add your first part to start tracking inventory."
          }
          action={q ? undefined : <ButtonLink href="/parts/new">+ New Part</ButtonLink>}
        />
      ) : (
        <DataTable
          headers={[
            "Part Number",
            "Description",
            "Category",
            "Manufacturer",
            "Unit Cost",
            "Total Qty",
            "Locations",
          ]}
        >
          {visible.map(({ part, totalQty, belowReorder, outOfStock }) => (
            <tr key={part.id} className="hover:bg-slate-50">
              <Td>
                <Link
                  href={`/parts/${part.id}`}
                  className="font-medium text-indigo-600 hover:underline"
                >
                  {part.number}
                </Link>
              </Td>
              <Td>{part.description ?? "—"}</Td>
              <Td>{part.category ?? "—"}</Td>
              <Td>{part.manufacturer ?? "—"}</Td>
              <Td>{money(part.unitCost)}</Td>
              <Td
                className={
                  outOfStock
                    ? "font-semibold text-red-600"
                    : belowReorder
                      ? "font-semibold text-orange-600"
                      : "font-medium text-slate-900"
                }
              >
                {num(totalQty)}
              </Td>
              <Td className="text-slate-500">
                {part.stocks.length > 0
                  ? part.stocks
                      .map((st) => `${st.location.name}: ${num(st.quantity)}`)
                      .join(" · ")
                  : "—"}
              </Td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}
