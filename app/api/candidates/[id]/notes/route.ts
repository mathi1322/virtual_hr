import type { NextRequest } from "next/server";
import { getCandidate, updateCandidate } from "@/lib/db";
import { InterviewNotes } from "@/lib/schemas";

export async function PUT(req: NextRequest, ctx: RouteContext<"/api/candidates/[id]/notes">) {
  const { id } = await ctx.params;
  if (!getCandidate(id)) return Response.json({ error: "Not found" }, { status: 404 });
  const parsed = InterviewNotes.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: "Invalid notes" }, { status: 400 });
  updateCandidate(id, { notes: parsed.data });
  return Response.json({ ok: true });
}
