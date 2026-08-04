import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireToken, unauthorized, paginationParams, listResponse } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1),
  classifications: z.array(z.enum(["fuel", "service", "parts", "vehicle"])).optional(),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  website: z.string().optional(),
  address: z.string().optional(),
});

export async function GET(req: Request) {
  if (!(await requireToken(req))) return unauthorized();
  const { perPage, startCursor } = paginationParams(req);
  const records = await db.vendor.findMany({
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

  const duplicate = await db.vendor.findUnique({ where: { name: parsed.data.name } });
  if (duplicate) {
    return NextResponse.json(
      {
        error: "Validation failed",
        issues: [{ path: ["name"], message: "Vendor name already exists" }],
      },
      { status: 422 }
    );
  }

  const { classifications, ...rest } = parsed.data;
  const vendor = await db.vendor.create({
    data: {
      ...rest,
      classifications: classifications ? JSON.stringify(classifications) : null,
    },
  });
  return NextResponse.json(vendor, { status: 201 });
}
