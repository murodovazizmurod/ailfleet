import { ASSET_TYPE, OWNERSHIP, VEHICLE_STATUS, enumLabel } from "@/lib/enums";
import { vehicleTitle } from "@/lib/format";
import {
  csvResponse,
  getVehicleStatusReport,
  parseVehicleStatusFilters,
  spFromRequest,
  toCsv,
} from "../../lib";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const f = parseVehicleStatusFilters(spFromRequest(req));
  const { rows } = await getVehicleStatusReport(f);
  const csv = toCsv(
    ["Vehicle", "Details", "VIN", "License Plate", "Type", "Group", "Status", "Ownership", "Current Meter", "Meter Unit"],
    rows.map((v) => [
      v.name,
      vehicleTitle(v) === "—" ? "" : vehicleTitle(v),
      v.vin,
      v.licensePlate,
      enumLabel(ASSET_TYPE, v.assetType),
      v.group?.name,
      enumLabel(VEHICLE_STATUS, v.status),
      enumLabel(OWNERSHIP, v.ownership),
      v.currentMeter,
      v.meterUnit,
    ])
  );
  return csvResponse("vehicle-status.csv", csv);
}
