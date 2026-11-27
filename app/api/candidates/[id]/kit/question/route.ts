import type { NextRequest } from "next/server";
import { getCandidate, updateCandidate } from "@/lib/db";
import { AIError } from "@/lib/gemini";
import { regenerateQuestion } from "@/lib/pipeline";

export const maxDuration = 120;

/** Replace one question with a fresh one measuring the same thing. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/candidates/[id]/kit/question">) {
  const { id } = await ctx.params;
  const { questionId } = (await req.json()) as { questionId?: string };
  const c = getCandidate(id);
  if (!c?.kit || !questionId) return Response.json({ error: "Nothing to regenerate." }, { status: 400 });
  try {
    const fresh = await regenerateQuestion(c, questionId);
    const latest = getCandidate(id)!;
    const kit = { ...latest.kit!, questions: latest.kit!.questions.map((q) => (q.id === questionId ? fresh : q)) };
    // Notes for the old question no longer apply.
    const notes = latest.notes;
    if (notes?.perQuestion[questionId]) delete notes.perQuestion[questionId];
    updateCandidate(id, { kit, notes });
    return Response.json(fresh);
  } catch (e) {
    return Response.json({ error: e instanceof AIError ? e.message : "Something went wrong." }, { status: 500 });
  }
}
