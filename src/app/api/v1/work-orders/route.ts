import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireToken, unauthorized, paginationParams, listResponse } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  vehicleId: z.string().min(1),
  status: z
    .enum(["open", "pending", "in_progress", "waiting_on_parts", "completed", "closed"])
    .optional(),
  priority: z.enum(["none", "low", "medium", "high", "critical"]).optional(),
  repairClass: z.enum(["scheduled", "non_scheduled", "emergency"]).optional(),
  description: z.string().optional(),
  scheduledFor: z.coerce.date().optional(),
  assignedToId: z.string().optional(),
  vendorId: z.string().optional(),
  meterAtService: z.number().optional(),
});

export async function GET(req: Request) {
  if (!(await requireToken(req))) return unauthorized();
  const { perPage, startCursor } = paginationParams(req);
  const records = await db.workOrder.findMany({
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

  const { _max } = await db.workOrder.aggregate({ _max: { number: true } });
  const workOrder = await db.workOrder.create({
    data: { ...parsed.data, number: (_max.number ?? 0) + 1 },
  });
  return NextResponse.json(workOrder, { status: 201 });
}
