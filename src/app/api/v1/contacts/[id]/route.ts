import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireToken, unauthorized } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  if (!(await requireToken(req))) return unauthorized();
  const { id } = await params;
  const contact = await db.contact.findUnique({
    where: { id },
    include: { renewals: true },
  });
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(contact);
}
