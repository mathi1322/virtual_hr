import type { NextRequest } from "next/server";
import { getCandidate, updateCandidate } from "@/lib/db";
import { AIError } from "@/lib/gemini";
import { generateKit } from "@/lib/pipeline";
import { InterviewKit, emptyNotes } from "@/lib/schemas";

export const maxDuration = 300;

/** Save an edited kit (reordered / deleted questions). */
export async function PUT(req: NextRequest, ctx: RouteContext<"/api/candidates/[id]/kit">) {
  const { id } = await ctx.params;
  if (!getCandidate(id)) return Response.json({ error: "Not found" }, { status: 404 });
  const parsed = InterviewKit.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: "Invalid kit" }, { status: 400 });
  updateCandidate(id, { kit: parsed.data });
  return Response.json({ ok: true });
}

/** Regenerate the whole kit. */
export async function POST(_req: NextRequest, ctx: RouteContext<"/api/candidates/[id]/kit">) {
  const { id } = await ctx.params;
  const c = getCandidate(id);
  if (!c?.resume || !c.summary) return Response.json({ error: "Candidate isn't ready yet." }, { status: 400 });
  try {
    const kit = await generateKit(c);
    // New questions get new ids, so old notes no longer apply.
    updateCandidate(id, { kit, notes: emptyNotes(), scorecard: null });
    return Response.json(kit);
  } catch (e) {
    return Response.json({ error: e instanceof AIError ? e.message : "Something went wrong." }, { status: 500 });
  }
}
