import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { DataTable, Td } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ISSUE_SOURCE, ISSUE_STATUS, PRIORITY, enumKeys } from "@/lib/enums";
import { num, shortDate } from "@/lib/format";
import { FilterBar, FilterField, filterInputCls } from "../FilterBar";
import {
  filterQuery,
  getIssuesList,
  getVehicleOptions,
  parseIssueFilters,
  type SearchParams,
} from "../lib";

export const dynamic = "force-dynamic";

export default async function IssuesListReport({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const f = parseIssueFilters(sp);
  const [issues, vehicles] = await Promise.all([getIssuesList(f), getVehicleOptions()]);
  const query = filterQuery({
    from: f.from,
    to: f.to,
    vehicleId: f.vehicleId,
    status: f.status,
    priority: f.priority,
    source: f.source,
  });

  const openCount = issues.filter((i) => i.status === "open").length;
  const overdueCount = issues.filter((i) => i.status === "overdue").length;
  const resolvedCount = issues.filter(
    (i) => i.status === "resolved" || i.status === "closed"
  ).length;

  return (
    <>
      <PageHeader
        title="Issues List"
        subtitle="Reported issues filterable by status, priority, source, vehicle and date reported."
        actions={<ButtonLink href="/reports" variant="secondary">All reports</ButtonLink>}
      />

      <FilterBar
        action="/reports/issues-list"
        from={f.from}
        to={f.to}
        vehicleId={f.vehicleId}
        vehicles={vehicles}
        csvHref={`/reports/issues-list/csv${query}`}
      >
        <FilterField label="Status">
          <select name="status" defaultValue={f.status ?? ""} className={filterInputCls}>
            <option value="">All statuses</option>
            {enumKeys(ISSUE_STATUS).map((k) => (
              <option key={k} value={k}>
                {ISSUE_STATUS[k].label}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Priority">
          <select name="priority" defaultValue={f.priority ?? ""} className={filterInputCls}>
            <option value="">All priorities</option>
            {enumKeys(PRIORITY).map((k) => (
              <option key={k} value={k}>
                {PRIORITY[k].label}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Source">
          <select name="source" defaultValue={f.source ?? ""} className={filterInputCls}>
            <option value="">All sources</option>
            {enumKeys(ISSUE_SOURCE).map((k) => (
              <option key={k} value={k}>
                {ISSUE_SOURCE[k].label}
              </option>
            ))}
          </select>
        </FilterField>
      </FilterBar>

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Matching Issues" value={num(issues.length)} />
        <StatCard label="Open" value={num(openCount)} />
        <StatCard
          label="Overdue"
          value={num(overdueCount)}
          accent={overdueCount > 0 ? "text-red-600" : "text-slate-900"}
        />
        <StatCard label="Resolved / Closed" value={num(resolvedCount)} />
      </div>

      {issues.length === 0 ? (
        <EmptyState title="No issues match these filters" hint="Try clearing some filters." />
      ) : (
        <DataTable
          headers={["#", "Summary", "Vehicle", "Status", "Priority", "Source", "Assigned To", "Reported", "Due"]}
        >
          {issues.map((i) => (
            <tr key={i.id} className="hover:bg-slate-50/60">
              <Td className="whitespace-nowrap text-slate-500">#{i.number}</Td>
              <Td className="max-w-72">
                <Link href={`/issues/${i.id}`} className="font-medium text-indigo-600 hover:underline">
                  <span className="line-clamp-2">{i.summary}</span>
                </Link>
              </Td>
              <Td>
                <Link href={`/vehicles/${i.vehicle.id}`} className="text-indigo-600 hover:underline">
                  {i.vehicle.name}
                </Link>
              </Td>
              <Td>
                <StatusBadge def={ISSUE_STATUS} value={i.status} />
              </Td>
              <Td>
                <StatusBadge def={PRIORITY} value={i.priority} />
              </Td>
              <Td>
                <StatusBadge def={ISSUE_SOURCE} value={i.source} />
              </Td>
              <Td>
                {i.assignedTo ? `${i.assignedTo.firstName} ${i.assignedTo.lastName}` : "—"}
              </Td>
              <Td className="whitespace-nowrap">{shortDate(i.reportedAt)}</Td>
              <Td className="whitespace-nowrap">{shortDate(i.dueDate)}</Td>
            </tr>
          ))}
        </DataTable>
      )}
    </>
  );
}
