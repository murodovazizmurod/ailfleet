import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireToken, unauthorized, paginationParams, listResponse } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1),
  assetType: z.enum(["vehicle", "equipment", "trailer"]).optional(),
  vin: z.string().optional(),
  licensePlate: z.string().optional(),
  year: z.number().int().optional(),
  make: z.string().optional(),
  model: z.string().optional(),
  trim: z.string().optional(),
  status: z.enum(["active", "inactive", "in_shop", "out_of_service", "sold"]).optional(),
  ownership: z.enum(["owned", "leased", "rented"]).optional(),
  fuelType: z.enum(["gasoline", "diesel", "electric", "hybrid", "cng", "propane"]).optional(),
  meterUnit: z.enum(["mi", "km", "hr"]).optional(),
  currentMeter: z.number().optional(),
});

export async function GET(req: Request) {
  if (!(await requireToken(req))) return unauthorized();
  const { perPage, startCursor } = paginationParams(req);
  const records = await db.vehicle.findMany({
    where: startCursor ? { id: { gt: startCursor } } : undefined,
    orderBy: { id: "asc" },
    take: perPage + 1,
  });
  return listResponse(records, perPage);
}

export async function POST(req: Request) {
  if (!(await requireToken(req))) return unauthorized();
  const body: unknown = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }
  const vehicle = await db.vehicle.create({ data: parsed.data });
  return NextResponse.json(vehicle, { status: 201 });
}
