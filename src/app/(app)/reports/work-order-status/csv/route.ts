import { REPAIR_CLASS, WORK_ORDER_STATUS, enumLabel } from "@/lib/enums";
import { shortDate } from "@/lib/format";
import {
  csvResponse,
  getWorkOrderStatus,
  parseWorkOrderFilters,
  spFromRequest,
  toCsv,
} from "../../lib";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const f = parseWorkOrderFilters(spFromRequest(req));
  const { rows } = await getWorkOrderStatus(f);
  const csv = toCsv(
    ["Number", "Vehicle", "Status", "Repair Class", "Issued", "Completed", "Assigned To", "Vendor", "Labor", "Parts", "Total"],
    rows.map((w) => [
      w.number,
      w.vehicle.name,
      enumLabel(WORK_ORDER_STATUS, w.status),
      enumLabel(REPAIR_CLASS, w.repairClass),
      shortDate(w.issuedAt),
      w.completedAt ? shortDate(w.completedAt) : "",
      w.assignedTo ? `${w.assignedTo.firstName} ${w.assignedTo.lastName}` : "",
      w.vendor?.name,
      w.laborTotal,
      w.partsTotal,
      w.total,
    ])
  );
  return csvResponse("work-order-status.csv", csv);
}
