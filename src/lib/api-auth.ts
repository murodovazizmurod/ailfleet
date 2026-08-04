import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { ApiToken } from "@prisma/client";

/**
 * Authenticate an API request via `Authorization: Token <value>` header.
 * The plaintext value is sha256-hashed and matched against ApiToken.tokenHash
 * (non-revoked only). Updates lastUsedAt on success. Returns the token row or null.
 */
export async function requireToken(req: Request): Promise<ApiToken | null> {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Token\s+(\S+)$/i);
  if (!match) return null;

  const tokenHash = createHash("sha256").update(match[1]).digest("hex");
  const token = await db.apiToken.findFirst({
    where: { tokenHash, revokedAt: null },
  });
  if (!token) return null;

  await db.apiToken.update({
    where: { id: token.id },
    data: { lastUsedAt: new Date() },
  });
  return token;
}

/** Standard 401 response for unauthenticated API requests. */
export function unauthorized() {
  return NextResponse.json(
    { error: "Unauthorized. Pass a valid API token via `Authorization: Token <token>`." },
    { status: 401 }
  );
}

/** Parse cursor-pagination params: ?per_page= (default 50, max 100) & ?start_cursor= (record id). */
export function paginationParams(req: Request): { perPage: number; startCursor: string | null } {
  const url = new URL(req.url);
  const rawPerPage = parseInt(url.searchParams.get("per_page") ?? "", 10);
  const perPage = Number.isFinite(rawPerPage) ? Math.min(Math.max(rawPerPage, 1), 100) : 50;
  const startCursor = url.searchParams.get("start_cursor");
  return { perPage, startCursor: startCursor || null };
}

/**
 * Build a paginated list response from `perPage + 1` fetched records
 * (ordered by id asc). The extra record, if present, yields next_cursor.
 */
export function listResponse<T extends { id: string }>(records: T[], perPage: number) {
  const hasMore = records.length > perPage;
  const page = hasMore ? records.slice(0, perPage) : records;
  return NextResponse.json({
    records: page,
    next_cursor: hasMore ? page[page.length - 1].id : null,
  });
}
