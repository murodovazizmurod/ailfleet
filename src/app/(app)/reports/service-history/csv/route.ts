import { shortDate } from "@/lib/format";
import {
  csvResponse,
  getServiceHistory,
  parseFilters,
  serviceEntryTasks,
  spFromRequest,
  toCsv,
} from "../../lib";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const f = parseFilters(spFromRequest(req));
  const entries = await getServiceHistory(f);
  const csv = toCsv(
    ["Date", "Vehicle", "Tasks", "Vendor", "Meter", "Meter Unit", "Labor", "Parts", "Total", "Reference", "Notes"],
    entries.map((e) => [
      shortDate(e.date),
      e.vehicle.name,
      serviceEntryTasks(e),
      e.vendor?.name,
      e.meter,
      e.vehicle.meterUnit,
      e.laborTotal,
      e.partsTotal,
      e.total,
      e.reference,
      e.notes,
    ])
  );
  return csvResponse("service-history.csv", csv);
}
