import {
  csvResponse,
  getFuelSummary,
  parseFilters,
  spFromRequest,
  toCsv,
} from "../../lib";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const f = parseFilters(spFromRequest(req));
  const rows = await getFuelSummary(f);
  const csv = toCsv(
    [
      "Vehicle",
      "Details",
      "Fuel Type",
      "Entries",
      "Total Volume",
      "Total Cost",
      "Avg Fuel Economy",
      "Avg Price Per Unit",
    ],
    rows.map((r) => [
      r.name,
      r.title === "—" ? "" : r.title,
      r.fuelType,
      r.entries,
      r.volume,
      r.cost,
      r.avgEconomy,
      r.avgPrice,
    ])
  );
  return csvResponse("fuel-summary.csv", csv);
}
