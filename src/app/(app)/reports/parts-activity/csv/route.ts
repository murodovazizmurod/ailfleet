import { ADJUSTMENT_REASON, enumLabel } from "@/lib/enums";
import { dateTime } from "@/lib/format";
import {
  csvResponse,
  getPartsActivity,
  parsePartsActivityFilters,
  spFromRequest,
  toCsv,
} from "../../lib";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const f = parsePartsActivityFilters(spFromRequest(req));
  const adjustments = await getPartsActivity(f);
  const csv = toCsv(
    ["Date", "Part Number", "Part Description", "Reason", "Qty Change", "Note"],
    adjustments.map((a) => [
      dateTime(a.createdAt),
      a.part.number,
      a.part.description,
      enumLabel(ADJUSTMENT_REASON, a.reason),
      a.delta,
      a.note,
    ])
  );
  return csvResponse("parts-activity.csv", csv);
}
