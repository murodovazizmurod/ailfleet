import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireToken, unauthorized, paginationParams, listResponse } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  number: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  manufacturer: z.string().optional(),
  manufacturerPartNumber: z.string().optional(),
  upc: z.string().optional(),
  unitCost: z.number().optional(),
  measurementUnit: z.string().optional(),
});

export async function GET(req: Request) {
  if (!(await requireToken(req))) return unauthorized();
  const { perPage, startCursor } = paginationParams(req);
  const records = await db.part.findMany({
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

  const duplicate = await db.part.findUnique({ where: { number: parsed.data.number } });
  if (duplicate) {
    return NextResponse.json(
      {
        error: "Validation failed",
        issues: [{ path: ["number"], message: "Part number already exists" }],
      },
      { status: 422 }
    );
  }

  const part = await db.part.create({ data: parsed.data });
  return NextResponse.json(part, { status: 201 });
}
