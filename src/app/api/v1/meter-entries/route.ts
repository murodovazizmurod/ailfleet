import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireToken, unauthorized, paginationParams, listResponse } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  vehicleId: z.string().min(1),
  value: z.number(),
  date: z.coerce.date().optional(),
  meterType: z.enum(["primary", "secondary"]).optional(),
  source: z.enum(["manual", "fuel_entry", "work_order", "inspection", "telematics"]).optional(),
});

export async function GET(req: Request) {
  if (!(await requireToken(req))) return unauthorized();
  const { perPage, startCursor } = paginationParams(req);
  const records = await db.meterEntry.findMany({
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

  const vehicle = await db.vehicle.findUnique({ where: { id: parsed.data.vehicleId } });
  if (!vehicle) {
    return NextResponse.json(
      { error: "Validation failed", issues: [{ path: ["vehicleId"], message: "Unknown vehicle" }] },
      { status: 422 }
    );
  }

  const entry = await db.meterEntry.create({ data: parsed.data });

  // keep the vehicle's rolling meter current for primary readings
  if ((parsed.data.meterType ?? "primary") === "primary" && parsed.data.value > vehicle.currentMeter) {
    await db.vehicle.update({
      where: { id: vehicle.id },
      data: { currentMeter: parsed.data.value },
    });
  }

  return NextResponse.json(entry, { status: 201 });
}
