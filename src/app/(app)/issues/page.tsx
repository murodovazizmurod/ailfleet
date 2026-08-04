import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Tabs } from "@/components/ui/Tabs";
import { DataTable, Td } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink, Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Select, EnumSelect } from "@/components/ui/FormField";
import { ISSUE_STATUS, PRIORITY, ISSUE_SOURCE } from "@/lib/enums";
import { shortDate, vehicleTitle } from "@/lib/format";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "overdue", label: "Overdue" },
  { key: "resolved", label: "Resolved" },
  { key: "closed", label: "Closed" },
];

export default async function IssuesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; priority?: string; source?: string; vehicleId?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status ?? "all";
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [allIssues, vehicles, resolvedForAvg] = await Promise.all([
    db.issue.findMany({
      include: {
        vehicle: true,
        assignedTo: true,
      },
      orderBy: { number: "desc" },
    }),
    db.vehicle.findMany({ where: { archived: false }, orderBy: { name: "asc" } }),
    db.issue.findMany({
      where: { status: "resolved", resolvedAt: { not: null } },
      select: { reportedAt: true, resolvedAt: true },
    }),
  ]);

  const isOverdue = (i: { status: string; dueDate: Date | null }) =>
    i.status === "open" && i.dueDate != null && i.dueDate < now;

  // Stats
  const openCount = allIssues.filter((i) => i.status === "open").length;
  const overdueCount = allIssues.filter(isOverdue).length;
  const resolvedThisMonth = allIssues.filter(
    (i) => i.status === "resolved" && i.resolvedAt && i.resolvedAt >= startOfMonth
  ).length;
  const avgDays =
    resolvedForAvg.length > 0
      ? resolvedForAvg.reduce(
          (sum, i) => sum + (i.resolvedAt!.getTime() - i.reportedAt.getTime()) / 86400000,
          0
        ) / resolvedForAvg.length
      : null;

  // Filtering
  let issues = allIssues;
  if (status === "overdue") issues = issues.filter(isOverdue);
  else if (status !== "all") issues = issues.filter((i) => i.status === status);
  if (sp.priority) issues = issues.filter((i) => i.priority === sp.priority);
  if (sp.source) issues = issues.filter((i) => i.source === sp.source);
  if (sp.vehicleId) issues = issues.filter((i) => i.vehicleId === sp.vehicleId);

  const tabHref = (key: string) => {
    const params = new URLSearchParams();
    if (key !== "all") params.set("status", key);
    if (sp.priority) params.set("priority", sp.priority);
    if (sp.source) params.set("source", sp.source);
    if (sp.vehicleId) params.set("vehicleId", sp.vehicleId);
    const qs = params.toString();
    return qs ? `/issues?${qs}` : "/issues";
  };

  const tabCount = (key: string) => {
    if (key === "all") return allIssues.length;
    if (key === "overdue") return allIssues.filter(isOverdue).length;
    return allIssues.filter((i) => i.status === key).length;
  };

  return (
    <div>
      <PageHeader
        title="Issues"
        subtitle="Track defects from report to resolution"
        actions={<ButtonLink href="/issues/new">+ New Issue</ButtonLink>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Open Issues" value={openCount} href="/issues?status=open" />
        <StatCard
          label="Overdue"
          value={overdueCount}
          accent={overdueCount > 0 ? "text-red-600" : "text-slate-900"}
          href="/issues?status=overdue"
        />
        <StatCard label="Resolved This Month" value={resolvedThisMonth} accent="text-emerald-600" />
        <StatCard
          label="Avg Days to Resolve"
          value={avgDays == null ? "—" : avgDays.toFixed(1)}
          hint={avgDays == null ? "No resolved issues yet" : undefined}
        />
      </div>

      <Tabs
        tabs={TABS.map((t) => ({ ...t, href: tabHref(t.key), count: tabCount(t.key) }))}
        active={status}
      />

      <form method="get" action="/issues" className="mb-4 flex flex-wrap items-end gap-3">
        {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
        <div className="w-40">
          <EnumSelect
            def={PRIORITY}
            name="priority"
            allowEmpty
            emptyLabel="Any priority"
            defaultValue={sp.priority ?? ""}
          />
        </div>
        <div className="w-40">
          <EnumSelect
            def={ISSUE_SOURCE}
            name="source"
            allowEmpty
            emptyLabel="Any source"
            defaultValue={sp.source ?? ""}
          />
        </div>
        <div className="w-56">
          <Select name="vehicleId" defaultValue={sp.vehicleId ?? ""}>
            <option value="">Any vehicle</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="secondary">
          Apply Filters
        </Button>
      </form>

      {issues.length === 0 ? (
        <EmptyState
          title="No issues found"
          hint="Issues capture defects reported by drivers, failed inspections, and fault codes."
          action={<ButtonLink href="/issues/new">+ New Issue</ButtonLink>}
        />
      ) : (
        <DataTable
          headers={["#", "Summary", "Vehicle", "Status", "Priority", "Source", "Reported", "Assigned To"]}
        >
          {issues.map((i) => (
            <tr key={i.id} className="hover:bg-slate-50">
              <Td className="font-medium text-slate-500">#{i.number}</Td>
              <Td>
                <Link href={`/issues/${i.id}`} className="text-indigo-600 hover:underline">
                  {i.summary}
                </Link>
              </Td>
              <Td>
                <Link
                  href={`/vehicles/${i.vehicleId}`}
                  className="text-indigo-600 hover:underline"
                >
                  {i.vehicle.name}
                </Link>
                <span className="block text-xs text-slate-400">{vehicleTitle(i.vehicle)}</span>
              </Td>
              <Td>
                <StatusBadge def={ISSUE_STATUS} value={isOverdue(i) ? "overdue" : i.status} />
              </Td>
              <Td>
                <StatusBadge def={PRIORITY} value={i.priority} />
              </Td>
              <Td>
                <StatusBadge def={ISSUE_SOURCE} value={i.source} />
              </Td>
              <Td>{shortDate(i.reportedAt)}</Td>
              <Td>
                {i.assignedTo ? `${i.assignedTo.firstName} ${i.assignedTo.lastName}` : "—"}
              </Td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}
