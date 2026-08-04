import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireToken, unauthorized } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  if (!(await requireToken(req))) return unauthorized();
  const { id } = await params;
  const entry = await db.serviceEntry.findUnique({
    where: { id },
    include: { vehicle: true, vendor: true, lines: { include: { task: true } } },
  });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(entry);
}
