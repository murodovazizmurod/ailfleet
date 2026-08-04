import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireToken, unauthorized } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  if (!(await requireToken(req))) return unauthorized();
  const { id } = await params;
  const workOrder = await db.workOrder.findUnique({
    where: { id },
    include: {
      vehicle: true,
      issues: true,
      lines: { include: { laborLines: true, partLines: true } },
    },
  });
  if (!workOrder) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(workOrder);
}
