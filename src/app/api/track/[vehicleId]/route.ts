import { NextRequest, NextResponse } from "next/server";
import { fetchLiveVehicleData } from "@/lib/integrations/samsara";

export const dynamic = "force-dynamic";

// Internal endpoint for the vehicle-page tracking map (same-origin UI polling;
// hits Samsara for one vehicle and falls back to the last stored point).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ vehicleId: string }> }
) {
  const { vehicleId } = await params;
  const data = await fetchLiveVehicleData(vehicleId);
  if (!data) {
    return NextResponse.json({ error: "No location data for this vehicle" }, { status: 404 });
  }
  return NextResponse.json(data);
}
