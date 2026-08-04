import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireToken, unauthorized, paginationParams, listResponse } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  vehicleId: z.string().min(1),
  volume: z.number().positive(),
  date: z.coerce.date().optional(),
  meter: z.number().optional(),
  pricePerUnit: z.number().optional(),
  total: z.number().optional(),
  vendorId: z.string().optional(),
  partial: z.boolean().optional(),
  personal: z.boolean().optional(),
  reference: z.string().optional(),
});

export async function GET(req: Request) {
  if (!(await requireToken(req))) return unauthorized();
  const { perPage, startCursor } = paginationParams(req);
  const records = await db.fuelEntry.findMany({
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

  const { total, pricePerUnit, ...rest } = parsed.data;
  const entry = await db.fuelEntry.create({
    data: {
      ...rest,
      pricePerUnit: pricePerUnit ?? 0,
      total: total ?? Math.round(parsed.data.volume * (pricePerUnit ?? 0) * 100) / 100,
    },
  });
  return NextResponse.json(entry, { status: 201 });
}
