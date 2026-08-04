import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireToken, unauthorized } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  summary: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z.enum(["open", "overdue", "resolved", "closed"]).optional(),
  priority: z.enum(["none", "low", "medium", "high", "critical"]).optional(),
  assignedToId: z.string().nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  dueMeter: z.number().nullable().optional(),
  resolvedNote: z.string().nullable().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  if (!(await requireToken(req))) return unauthorized();
  const { id } = await params;
  const issue = await db.issue.findUnique({
    where: { id },
    include: { vehicle: true, faultCode: true },
  });
  if (!issue) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(issue);
}

export async function PATCH(req: Request, { params }: Params) {
  if (!(await requireToken(req))) return unauthorized();
  const { id } = await params;
  const existing = await db.issue.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body: unknown = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  const data = {
    ...parsed.data,
    ...(parsed.data.status === "resolved" && existing.resolvedAt == null
      ? { resolvedAt: new Date() }
      : {}),
  };

  const issue = await db.issue.update({ where: { id }, data });
  return NextResponse.json(issue);
}
