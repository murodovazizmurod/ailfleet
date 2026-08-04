import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireToken, unauthorized, paginationParams, listResponse } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  vehicleId: z.string().min(1),
  date: z.coerce.date().optional(),
  meter: z.number().optional(),
  vendorId: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  laborTotal: z.number().optional(),
  partsTotal: z.number().optional(),
  total: z.number().optional(),
});

export async function GET(req: Request) {
  if (!(await requireToken(req))) return unauthorized();
  const { perPage, startCursor } = paginationParams(req);
  const records = await db.serviceEntry.findMany({
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

  const data = { ...parsed.data };
  if (data.total == null) {
    data.total = (data.laborTotal ?? 0) + (data.partsTotal ?? 0);
  }

  const entry = await db.serviceEntry.create({ data });
  return NextResponse.json(entry, { status: 201 });
}
