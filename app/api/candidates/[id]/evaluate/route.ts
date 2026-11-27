import type { NextRequest } from "next/server";
import { getCandidate, updateCandidate } from "@/lib/db";
import { AIError } from "@/lib/gemini";
import { evaluate } from "@/lib/pipeline";

export const maxDuration = 300;

export async function POST(req: NextRequest, ctx: RouteContext<"/api/candidates/[id]/evaluate">) {
  const { id } = await ctx.params;
  const { runs = 1 } = (await req.json().catch(() => ({}))) as { runs?: number };
  const c = getCandidate(id);
  if (!c?.kit) return Response.json({ error: "Candidate isn't ready yet." }, { status: 400 });
  try {
    const scorecard = await evaluate(c, runs);
    updateCandidate(id, { scorecard });
    return Response.json(scorecard);
  } catch (e) {
    if (!(e instanceof AIError)) console.error(e);
    return Response.json({ error: e instanceof AIError ? e.message : "Something went wrong." }, { status: 500 });
  }
}
