import "server-only";
import { AIError, generateJSON } from "./gemini";
import {
  getBlueprint,
  getCandidate,
  roleKeyFor,
  saveBlueprint,
  updateCandidate,
  type Candidate,
} from "./db";
import { resumeToParts } from "./parse";
import { makeScrubber, redactResume } from "./redact";
import * as P from "./prompts";
import {
  CandidateSummary,
  DIMENSIONS,
  InterviewKit,
  InterviewQuestion,
  ResumeData,
  RoleBlueprint,
  ScorecardAI,
  emptyNotes,
  type Dimension,
  type Recommendation,
  type Scorecard,
} from "./schemas";

const running = new Set<string>();

/**
 * Pre-interview pipeline: extract → role blueprint → summary → interview kit.
 * Each step is saved, so a retry resumes from the step that failed.
 */
export async function runPipeline(id: string): Promise<void> {
  if (running.has(id)) return;
  running.add(id);
  try {
    let c = must(getCandidate(id));

    if (!c.resume) {
      updateCandidate(id, { status: "extracting", error: "" });
      const resume = await generateJSON({
        schema: ResumeData,
        system: P.EXTRACT_SYSTEM,
        parts: [...(await resumeToParts(c.filePath, c.mimeType)), { text: P.EXTRACT_USER }],
        temperature: 0,
      });
      updateCandidate(id, { resume, name: resume.name || c.fileName });
      c = must(getCandidate(id));
    }

    const blueprint = await ensureBlueprint(c);

    const resume = redactResume(c.resume!);
    if (!c.summary) {
      updateCandidate(id, { status: "summary", error: "" });
      const summary = await generateJSON({
        schema: CandidateSummary,
        system: P.SUMMARY_SYSTEM,
        parts: [{ text: P.summaryUser(blueprint, resume, c.companyContext) }],
        temperature: 0.2,
      });
      updateCandidate(id, { summary });
      c = must(getCandidate(id));
    }

    if (!c.kit) {
      updateCandidate(id, { status: "kit", error: "" });
      const kit = await generateKit(c, blueprint);
      updateCandidate(id, { kit, notes: c.notes ?? emptyNotes() });
    }

    updateCandidate(id, { status: "ready", error: "" });
  } catch (err) {
    updateCandidate(id, {
      status: "error",
      error: err instanceof AIError ? err.message : `Unexpected error: ${(err as Error).message}`,
    });
    if (!(err instanceof AIError)) console.error(err);
  } finally {
    running.delete(id);
  }
}

async function ensureBlueprint(c: Candidate): Promise<RoleBlueprint> {
  const key = c.roleKey || roleKeyFor(c.designation, c.jobDescription);
  const cached = getBlueprint(key);
  if (cached) {
    if (!c.roleKey) updateCandidate(c.id, { roleKey: key });
    return cached;
  }
  updateCandidate(c.id, { status: "blueprint", error: "" });
  const bp = await generateJSON({
    schema: RoleBlueprint,
    system: P.BLUEPRINT_SYSTEM,
    parts: [{ text: P.blueprintUser(c.designation, c.jobDescription, c.companyContext) }],
    temperature: 0.2,
  });
  saveBlueprint(key, c.designation, bp);
  updateCandidate(c.id, { roleKey: key });
  return bp;
}

export async function generateKit(c: Candidate, blueprint?: RoleBlueprint): Promise<InterviewKit> {
  const bp = blueprint ?? (await ensureBlueprint(c));
  const kit = await generateJSON({
    schema: InterviewKit,
    system: P.KIT_SYSTEM,
    parts: [{ text: P.kitUser(bp, c.summary, redactResume(c.resume!), c.companyContext) }],
    temperature: 0.6,
  });
  // Guarantee unique, stable ids regardless of what the model returned.
  kit.questions = kit.questions.map((q, i) => ({ ...q, id: `q${i + 1}` }));
  return kit;
}

export async function regenerateQuestion(c: Candidate, questionId: string): Promise<InterviewQuestion> {
  const kit = must(c.kit);
  const q = kit.questions.find((x) => x.id === questionId);
  if (!q) throw new AIError("That question no longer exists.");
  const bp = await ensureBlueprint(c);
  const fresh = await generateJSON({
    schema: InterviewQuestion,
    system: P.REGEN_SYSTEM,
    parts: [{ text: P.regenUser(kit, q, bp, redactResume(c.resume!)) }],
    temperature: 0.8,
  });
  return { ...fresh, id: q.id, section: q.section };
}

/* ------------------------------------------------------------------ */
/* Evaluation                                                          */
/* ------------------------------------------------------------------ */

export async function evaluate(c: Candidate, runs: number): Promise<Scorecard> {
  const kit = must(c.kit);
  const notes = c.notes ?? emptyNotes();
  const bp = await ensureBlueprint(c);
  const scrub = makeScrubber(c.resume!);

  const questionsWithNotes = kit.questions.map((q) => {
    const n = notes.perQuestion[q.id];
    return {
      section: q.section,
      dimension: q.dimension,
      question: q.question,
      interviewerRating: n?.rating ?? "not rated",
      goodSignalsHeard: (n?.heardGreen ?? []).map((i) => q.listenFor[i]).filter(Boolean),
      goodSignalsNotHeard: q.listenFor.filter((_, i) => !(n?.heardGreen ?? []).includes(i)),
      redFlagsHeard: (n?.heardRed ?? []).map((i) => q.redFlags[i]).filter(Boolean),
      interviewerNotes: scrub(n?.notes ?? ""),
      rubric: q.rubric,
    };
  });

  const anyEvidence =
    questionsWithNotes.some((q) => q.interviewerRating !== "not rated" || q.interviewerNotes || q.goodSignalsHeard.length || q.redFlagsHeard.length) ||
    notes.transcript.trim() ||
    notes.generalNotes.trim();
  if (!anyEvidence) {
    throw new AIError("There are no interview notes yet. Fill in the Live Interview tab (ratings, ticks or notes), then generate the scorecard.");
  }

  const input = {
    schema: ScorecardAI,
    system: P.EVAL_SYSTEM,
    parts: [
      {
        text: P.evalUser({
          blueprint: bp,
          resume: redactResume(c.resume!),
          claimsToVerify: c.summary?.claimsToVerify ?? [],
          questionsWithNotes,
          transcript: scrub(notes.transcript),
          generalNotes: scrub(notes.generalNotes),
          gutFeel: notes.gutFeel,
        }),
      },
    ],
    temperature: 0.2,
  };

  // Self-consistency: independent passes in parallel (free-tier calls are slow, not tightly rate-limited).
  // Keep whichever passes succeed; fail only if all of them fail.
  const n = Math.max(1, Math.min(runs, 3));
  const settled = await Promise.allSettled(Array.from({ length: n }, () => generateJSON(input)));
  const results = settled.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  if (!results.length) throw (settled[0] as PromiseRejectedResult).reason;
  return { ...mergeRuns(results), requestedRuns: n };
}

const REC_ORDER: Recommendation[] = ["no", "lean_no", "hire", "strong_hire"];

function mergeRuns(results: ScorecardAI[]): Omit<Scorecard, "requestedRuns"> {
  // Majority-vote recommendation; ties go to the more conservative option.
  const votes = new Map<Recommendation, number>();
  for (const r of results) votes.set(r.recommendation, (votes.get(r.recommendation) ?? 0) + 1);
  const finalRec = [...votes.entries()].sort(
    (a, b) => b[1] - a[1] || REC_ORDER.indexOf(a[0]) - REC_ORDER.indexOf(b[0]),
  )[0][0];

  const base = structuredClone(results.find((r) => r.recommendation === finalRec) ?? results[0]);
  const disagreements: Dimension[] = [];

  base.dimensions = DIMENSIONS.map((dim) => {
    const all = results.map((r) => r.dimensions.find((d) => d.dimension === dim)).filter((d) => !!d);
    const scored = all.filter((d) => !d.insufficientEvidence && d.score > 0);
    const baseDim = base.dimensions.find((d) => d.dimension === dim) ?? all[0];
    if (!baseDim) {
      return { dimension: dim, insufficientEvidence: true, score: 0, confidence: "low" as const, summary: "Not assessed.", evidence: [] };
    }
    if (scored.length === 0) return { ...baseDim, insufficientEvidence: true, score: 0 };
    const scores = scored.map((d) => d.score);
    if (Math.max(...scores) - Math.min(...scores) > 1 || (scored.length && scored.length < all.length)) disagreements.push(dim);
    const avg = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
    return { ...baseDim, insufficientEvidence: false, score: avg };
  });

  return { ...base, recommendation: finalRec, runs: results.length, disagreements, generatedAt: new Date().toISOString() };
}

function must<T>(v: T | null | undefined): T {
  if (v == null) throw new AIError("Candidate data is missing. Try deleting and re-adding this candidate.");
  return v;
}
