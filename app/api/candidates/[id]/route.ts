import type { NextRequest } from "next/server";
import { deleteCandidate, getBlueprint, getCandidate } from "@/lib/db";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/candidates/[id]">) {
  const { id } = await ctx.params;
  const c = getCandidate(id);
  if (!c) return Response.json({ error: "Not found" }, { status: 404 });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { filePath, ...safe } = c;
  return Response.json({ ...safe, blueprint: c.roleKey ? getBlueprint(c.roleKey) : null });
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/candidates/[id]">) {
  const { id } = await ctx.params;
  deleteCandidate(id);
  return Response.json({ ok: true });
}
