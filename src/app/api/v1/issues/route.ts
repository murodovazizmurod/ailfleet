import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireToken, unauthorized, paginationParams, listResponse } from "@/lib/api-auth";
import { dispatchEvent } from "@/lib/webhooks";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  vehicleId: z.string().min(1),
  summary: z.string().min(1),
  description: z.string().optional(),
  priority: z.enum(["none", "low", "medium", "high", "critical"]).optional(),
  source: z.enum(["manual", "inspection", "fault_code", "telematics"]).optional(),
  assignedToId: z.string().optional(),
  reportedById: z.string().optional(),
  dueDate: z.coerce.date().optional(),
  dueMeter: z.number().optional(),
});

export async function GET(req: Request) {
  if (!(await requireToken(req))) return unauthorized();
  const { perPage, startCursor } = paginationParams(req);
  const records = await db.issue.findMany({
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

  const { _max } = await db.issue.aggregate({ _max: { number: true } });
  const issue = await db.issue.create({
    data: { ...parsed.data, number: (_max.number ?? 0) + 1 },
  });

  void dispatchEvent("issue.created", {
    id: issue.id,
    number: issue.number,
    vehicle_id: issue.vehicleId,
    summary: issue.summary,
    priority: issue.priority,
    source: issue.source,
    status: issue.status,
  });

  return NextResponse.json(issue, { status: 201 });
}
