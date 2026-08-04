import { ISSUE_SOURCE, ISSUE_STATUS, PRIORITY, enumLabel } from "@/lib/enums";
import { shortDate } from "@/lib/format";
import {
  csvResponse,
  getIssuesList,
  parseIssueFilters,
  spFromRequest,
  toCsv,
} from "../../lib";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const f = parseIssueFilters(spFromRequest(req));
  const issues = await getIssuesList(f);
  const csv = toCsv(
    ["Number", "Summary", "Vehicle", "Status", "Priority", "Source", "Assigned To", "Reported", "Due Date"],
    issues.map((i) => [
      i.number,
      i.summary,
      i.vehicle.name,
      enumLabel(ISSUE_STATUS, i.status),
      enumLabel(PRIORITY, i.priority),
      enumLabel(ISSUE_SOURCE, i.source),
      i.assignedTo ? `${i.assignedTo.firstName} ${i.assignedTo.lastName}` : "",
      shortDate(i.reportedAt),
      i.dueDate ? shortDate(i.dueDate) : "",
    ])
  );
  return csvResponse("issues-list.csv", csv);
}
