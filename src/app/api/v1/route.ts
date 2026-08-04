import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    name: "AIlFleet API",
    version: "v1",
    authentication: "Pass `Authorization: Token <your_token>` on every request.",
    pagination:
      "Lists accept ?per_page= (default 50, max 100) and ?start_cursor=; responses include next_cursor.",
    resources: [
      "/api/v1/vehicles",
      "/api/v1/issues",
      "/api/v1/work-orders",
      "/api/v1/fuel-entries",
      "/api/v1/parts",
      "/api/v1/service-entries",
      "/api/v1/contacts",
      "/api/v1/vendors",
      "/api/v1/meter-entries",
    ],
    docs: "See /settings/api-docs for the full reference.",
  });
}
