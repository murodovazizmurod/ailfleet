import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireToken, unauthorized } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  vin: z.string().nullable().optional(),
  licensePlate: z.string().nullable().optional(),
  year: z.number().int().nullable().optional(),
  make: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  trim: z.string().nullable().optional(),
  status: z.enum(["active", "inactive", "in_shop", "out_of_service", "sold"]).optional(),
  ownership: z.enum(["owned", "leased", "rented"]).optional(),
  fuelType: z
    .enum(["gasoline", "diesel", "electric", "hybrid", "cng", "propane"])
    .nullable()
    .optional(),
  meterUnit: z.enum(["mi", "km", "hr"]).optional(),
  currentMeter: z.number().optional(),
  archived: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  if (!(await requireToken(req))) return unauthorized();
  const { id } = await params;
  const vehicle = await db.vehicle.findUnique({
    where: { id },
    include: { group: true },
  });
  if (!vehicle) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(vehicle);
}

export async function PATCH(req: Request, { params }: Params) {
  if (!(await requireToken(req))) return unauthorized();
  const { id } = await params;
  const existing = await db.vehicle.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body: unknown = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }
  const vehicle = await db.vehicle.update({ where: { id }, data: parsed.data });
  return NextResponse.json(vehicle);
}
