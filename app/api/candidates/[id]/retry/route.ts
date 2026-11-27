import { after, type NextRequest } from "next/server";
import { getCandidate, updateCandidate } from "@/lib/db";
import { runPipeline } from "@/lib/pipeline";

export const maxDuration = 300;

export async function POST(_req: NextRequest, ctx: RouteContext<"/api/candidates/[id]/retry">) {
  const { id } = await ctx.params;
  if (!getCandidate(id)) return Response.json({ error: "Not found" }, { status: 404 });
  updateCandidate(id, { status: "queued", error: "" });
  after(() => runPipeline(id));
  return Response.json({ ok: true });
}
