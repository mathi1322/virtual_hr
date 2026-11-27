"use client";

import { useState } from "react";
import type { ClientCandidate } from "./types";
import {
  DIMENSION_HELP,
  DIMENSION_LABELS,
  RECOMMENDATION_LABELS,
  type Scorecard,
} from "@/lib/schemas";
import { Badge, Bullets, Button, Card, ErrorBox, H2, Spinner, type Tone } from "./ui";

const REC_STYLE: Record<string, { bg: string; tone: Tone }> = {
  strong_hire: { bg: "bg-emerald-600", tone: "green" },
  hire: { bg: "bg-emerald-500", tone: "green" },
  lean_no: { bg: "bg-amber-500", tone: "amber" },
  no: { bg: "bg-rose-600", tone: "red" },
};

function ScoreBar({ score }: { score: number }) {
  const color = score >= 4 ? "bg-emerald-500" : score >= 3 ? "bg-amber-400" : "bg-rose-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`h-2.5 w-7 rounded-sm ${score >= i ? color : score >= i - 0.5 ? `${color} opacity-50` : "bg-stone-200"}`}
          />
        ))}
      </div>
      <span className="w-8 text-sm font-semibold tabular-nums">{score.toFixed(1)}</span>
    </div>
  );
}

export default function ScorecardTab({
  c,
  setScorecard,
  goLive,
}: {
  c: ClientCandidate;
  setScorecard: (s: Scorecard | null) => void;
  goLive: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [doubleCheck, setDoubleCheck] = useState(false);
  const sc = c.scorecard;
  const rated = Object.values(c.notes?.perQuestion ?? {}).filter((n) => n.rating || n.notes || n.heardGreen.length || n.heardRed.length).length;
  const total = c.kit?.questions.length ?? 0;

  async function generate() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/candidates/${c.id}/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runs: doubleCheck ? 3 : 1 }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error);
    setScorecard(data);
  }

  const controls = (
    <div className="no-print flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-sm text-stone-600">
        <input type="checkbox" checked={doubleCheck} onChange={(e) => setDoubleCheck(e.target.checked)} className="accent-indigo-600" />
        Double-check (scores 3× and compares; uses 3 of your ~20 free daily AI requests)
      </label>
      <Button onClick={generate} disabled={busy}>
        {busy ? (
          <>
            <Spinner /> Analysing{doubleCheck ? " (3 passes)" : ""}… usually 2–4 min on the free AI
          </>
        ) : sc ? (
          "↻ Re-score with latest notes"
        ) : (
          "Generate scorecard"
        )}
      </Button>
    </div>
  );

  if (!sc) {
    return (
      <div className="space-y-5">
        <Card className="text-center">
          <H2>Ready to predict?</H2>
          <p className="mx-auto max-w-lg text-sm text-stone-600">
            The AI compares your interview notes, ticks and transcript against the role&apos;s bar and gives a hire / no-hire
            recommendation, with the evidence for every score.
          </p>
          <p className="mt-3 text-sm">
            You&apos;ve captured notes on <span className="font-semibold">{rated}</span> of {total} questions.
            {rated < total / 2 && (
              <>
                {" "}
                <button className="text-indigo-700 underline" onClick={goLive}>Add more</button> for a more reliable result.
              </>
            )}
          </p>
          <div className="mt-5 flex justify-center">{controls}</div>
        </Card>
        {error && <ErrorBox>{error}</ErrorBox>}
      </div>
    );
  }

  const rec = REC_STYLE[sc.recommendation];

  return (
    <div className="space-y-6">
      <div className="hidden print:block">
        <h1 className="text-xl font-semibold">Interview scorecard: {c.name}</h1>
        <p className="text-sm text-stone-500">{c.designation} · {new Date(sc.generatedAt).toLocaleString()}</p>
      </div>

      <div className={`print-avoid rounded-xl ${rec.bg} p-6 text-white`}>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-3xl font-bold">{RECOMMENDATION_LABELS[sc.recommendation]}</span>
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium">{sc.recommendationConfidence} confidence</span>
          {sc.runs > 1 && <span className="rounded-full bg-white/20 px-3 py-1 text-xs">checked {sc.runs}×</span>}
          {(sc.requestedRuns ?? sc.runs) > sc.runs && (
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs">
              only {sc.runs} of {sc.requestedRuns} checks finished (AI busy)
            </span>
          )}
        </div>
        <p className="mt-2 text-lg leading-snug">{sc.headline}</p>
      </div>

      <Card className="border-indigo-200">
        <H2>🔥 Will they get it done, no matter what?</H2>
        <p className="text-[15px] leading-relaxed">{sc.driveVerdict}</p>
      </Card>

      <Card>
        <H2 hint="1 = clear concern · 3 = meets the bar · 5 = exceptional">Scores</H2>
        <div className="divide-y divide-stone-100">
          {sc.dimensions.map((d) => (
            <details key={d.dimension} className="group py-3">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1">
                <div className="w-36">
                  <p className="font-medium">{DIMENSION_LABELS[d.dimension]}</p>
                  <p className="text-xs text-stone-400">{d.confidence} confidence</p>
                </div>
                {d.insufficientEvidence ? (
                  <Badge>Not enough evidence</Badge>
                ) : (
                  <ScoreBar score={d.score} />
                )}
                {sc.disagreements.includes(d.dimension) && <Badge tone="amber">AI passes disagreed: treat with care</Badge>}
                <span className="ml-auto text-xs text-stone-400 no-print group-open:hidden">evidence ›</span>
              </summary>
              <div className="mt-2 pl-0 text-sm sm:pl-40">
                <p className="text-xs text-stone-400">{DIMENSION_HELP[d.dimension]}</p>
                <p className="mt-1">{d.summary}</p>
                {d.evidence.length > 0 && (
                  <ul className="mt-2 space-y-1 border-l-2 border-stone-200 pl-3 text-stone-600">
                    {d.evidence.map((e, i) => <li key={i}>“{e}”</li>)}
                  </ul>
                )}
              </div>
            </details>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <H2>👍 Top strengths</H2>
          <Bullets items={sc.topStrengths} />
        </Card>
        <Card>
          <H2>⚠️ Top concerns</H2>
          <Bullets items={sc.topConcerns} />
        </Card>
      </div>

      {sc.resumeContradictions.length > 0 && (
        <Card>
          <H2 hint="Where what they said didn't match what the resume claims.">🧩 Resume vs. interview</H2>
          <div className="divide-y divide-stone-100 text-sm">
            {sc.resumeContradictions.map((x, i) => (
              <div key={i} className="grid gap-2 py-2 sm:grid-cols-2">
                <p><span className="text-stone-400">Resume:</span> {x.resumeClaim}</p>
                <p><span className="text-stone-400">Interview:</span> {x.whatInterviewShowed}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <H2>Why this recommendation</H2>
        <p className="text-sm leading-relaxed">{sc.reasoning}</p>
      </Card>

      <Card>
        <H2>➡️ Next steps before deciding</H2>
        <Bullets items={sc.nextSteps} />
      </Card>

      <p className="text-xs text-stone-500">
        This is an AI-assisted, advisory assessment based on the interviewer&apos;s notes. It can be wrong. Use it alongside your own
        judgement, references and, where needed, an expert technical check. Generated {new Date(sc.generatedAt).toLocaleString()}.
      </p>

      {error && <ErrorBox>{error}</ErrorBox>}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-4">
        <Button variant="secondary" onClick={() => window.print()}>🖨️ Print / Save PDF</Button>
        {controls}
      </div>
    </div>
  );
}
