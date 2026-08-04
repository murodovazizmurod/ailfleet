import {
  csvResponse,
  getOperatingCosts,
  parseFilters,
  spFromRequest,
  toCsv,
} from "../../lib";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const f = parseFilters(spFromRequest(req));
  const { rows, totals } = await getOperatingCosts(f);
  const csv = toCsv(
    [
      "Vehicle",
      "Details",
      "Fuel Cost",
      "Service Cost",
      "Other Expenses",
      "Total",
      "Meter Delta",
      "Meter Unit",
      "Cost Per Meter",
    ],
    [
      ...rows.map((r) => [
        r.name,
        r.title === "—" ? "" : r.title,
        r.fuelCost,
        r.serviceCost,
        r.otherCost,
        r.total,
        r.meterDelta,
        r.meterUnit,
        r.costPerMeter,
      ]),
      ["Fleet total", "", totals.fuelCost, totals.serviceCost, totals.otherCost, totals.total, "", "", ""],
    ]
  );
  return csvResponse("operating-costs.csv", csv);
}
