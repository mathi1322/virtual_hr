"use client";

import { useState } from "react";
import type { ClientCandidate } from "./types";
import {
  DIMENSION_LABELS,
  SECTIONS,
  SECTION_LABELS,
  type InterviewKit,
  type InterviewQuestion,
} from "@/lib/schemas";
import { Badge, Button, Card, ErrorBox, H2, Spinner } from "./ui";

export function QuestionBody({ q }: { q: InterviewQuestion }) {
  return (
    <div className="mt-3 grid gap-4 text-sm md:grid-cols-2">
      <div className="md:col-span-2 text-stone-500">
        <span className="font-medium text-stone-700">Why we ask:</span> {q.whyWeAsk}
      </div>
      <div className="rounded-lg bg-emerald-50/60 p-3">
        <p className="mb-1 font-medium text-emerald-800">✅ Listen for</p>
        <ul className="list-disc space-y-1 pl-5">{q.listenFor.map((x, i) => <li key={i}>{x}</li>)}</ul>
      </div>
      <div className="rounded-lg bg-rose-50/60 p-3">
        <p className="mb-1 font-medium text-rose-800">🚩 Red flags</p>
        <ul className="list-disc space-y-1 pl-5">{q.redFlags.map((x, i) => <li key={i}>{x}</li>)}</ul>
      </div>
      <div className="md:col-span-2">
        <p className="mb-1 font-medium">↳ Drill-down follow-ups <span className="font-normal text-stone-400">(ask in order; real experience goes deep)</span></p>
        <ol className="list-decimal space-y-1 pl-5">{q.followUps.map((x, i) => <li key={i}>{x}</li>)}</ol>
      </div>
      <div className="md:col-span-2 grid gap-2 sm:grid-cols-3">
        {([["1", q.rubric.score1, "bg-rose-50"], ["3", q.rubric.score3, "bg-amber-50"], ["5", q.rubric.score5, "bg-emerald-50"]] as const).map(
          ([n, text, bg]) => (
            <div key={n} className={`rounded-lg p-3 ${bg}`}>
              <p className="font-semibold">{n}/5</p>
              <p className="text-stone-600">{text}</p>
            </div>
          ),
        )}
      </div>
      <div className="md:col-span-2 rounded-lg bg-indigo-50/60 p-3 text-indigo-900">
        <span className="font-medium">💡 Tip:</span> {q.interviewerTip}
      </div>
    </div>
  );
}

export default function KitTab({
  c,
  setKit,
  onReset,
  onStart,
}: {
  c: ClientCandidate;
  setKit: (k: InterviewKit) => void;
  onReset: () => void;
  onStart: () => void;
}) {
  const kit = c.kit!;
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const totalMin = kit.questions.reduce((a, q) => a + (q.timeMinutes || 0), 0);

  async function save(next: InterviewKit) {
    setKit(next);
    await fetch(`/api/candidates/${c.id}/kit`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
  }

  function move(id: string, dir: -1 | 1) {
    const qs = [...kit.questions];
    const i = qs.findIndex((q) => q.id === id);
    // Move past the nearest question in the same section (sections are displayed as groups).
    let j = i + dir;
    while (j >= 0 && j < qs.length && qs[j].section !== qs[i].section) j += dir;
    if (j < 0 || j >= qs.length) return;
    [qs[i], qs[j]] = [qs[j], qs[i]];
    save({ ...kit, questions: qs });
  }

  function remove(id: string) {
    if (!confirm("Remove this question from the kit?")) return;
    save({ ...kit, questions: kit.questions.filter((q) => q.id !== id) });
  }

  async function regenerate(id: string) {
    setBusyId(id);
    setError("");
    const res = await fetch(`/api/candidates/${c.id}/kit/question`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: id }),
    });
    const data = await res.json();
    setBusyId(null);
    if (!res.ok) return setError(data.error);
    setKit({ ...kit, questions: kit.questions.map((q) => (q.id === id ? data : q)) });
  }

  async function regenerateAll() {
    if (!confirm("Create a completely new kit? Any interview notes and the scorecard for this candidate will be cleared.")) return;
    setBusyId("all");
    setError("");
    const res = await fetch(`/api/candidates/${c.id}/kit`, { method: "POST" });
    const data = await res.json();
    setBusyId(null);
    if (!res.ok) return setError(data.error);
    setKit(data);
    onReset();
  }

  // Keep the model's order inside each section, but present sections in the standard order.
  const bySection = SECTIONS.map((s) => ({ s, qs: kit.questions.filter((q) => q.section === s) })).filter((g) => g.qs.length);
  const ordered = bySection.flatMap((g) => g.qs);
  const numberOf = (id: string) => ordered.findIndex((q) => q.id === id) + 1;

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-stone-600">
          {kit.questions.length} questions · about {totalMin} minutes
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => window.print()}>
            🖨️ Print / Save PDF
          </Button>
          <Button variant="secondary" onClick={regenerateAll} disabled={!!busyId}>
            {busyId === "all" ? <Spinner /> : "↻"} New kit
          </Button>
          <Button onClick={onStart}>Start live interview →</Button>
        </div>
      </div>
      {error && <ErrorBox>{error}</ErrorBox>}

      <div className="hidden print:block">
        <h1 className="text-xl font-semibold">Interview kit: {c.designation}</h1>
        <p className="text-sm text-stone-500">Candidate: {c.name}</p>
      </div>

      <Card className="border-indigo-200 bg-indigo-50/40">
        <H2>🎯 How to run this interview</H2>
        <p className="whitespace-pre-line text-sm leading-relaxed">{kit.interviewerBriefing}</p>
      </Card>

      {bySection.map(({ s, qs }) => (
        <section key={s}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-500">{SECTION_LABELS[s]}</h3>
          <div className="space-y-3">
            {qs.map((q) => {
              const n = numberOf(q.id);
              return (
                <Card key={q.id} className="p-0">
                  <details className="group p-5">
                    <summary className="flex cursor-pointer list-none items-start gap-3">
                      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-stone-100 text-xs font-semibold">
                        {n}
                      </span>
                      <div className="flex-1">
                        <p className="font-medium leading-snug">{q.question}</p>
                        <div className="mt-1 flex gap-2">
                          <Badge tone="blue">{DIMENSION_LABELS[q.dimension]}</Badge>
                          <Badge>{q.timeMinutes} min</Badge>
                        </div>
                      </div>
                      <span className="no-print text-stone-400 transition group-open:rotate-90">›</span>
                    </summary>
                    <QuestionBody q={q} />
                    <div className="no-print mt-4 flex gap-1 border-t border-stone-100 pt-3">
                      <Button variant="ghost" onClick={() => move(q.id, -1)}>↑</Button>
                      <Button variant="ghost" onClick={() => move(q.id, 1)}>↓</Button>
                      <Button variant="ghost" onClick={() => regenerate(q.id)} disabled={!!busyId}>
                        {busyId === q.id ? <Spinner /> : "↻"} Different question
                      </Button>
                      <Button variant="danger" onClick={() => remove(q.id)}>Remove</Button>
                    </div>
                  </details>
                </Card>
              );
            })}
          </div>
        </section>
      ))}

      <Card>
        <p className="text-sm"><span className="font-medium">Closing:</span> {kit.closingTip}</p>
      </Card>

      {c.blueprint?.jargon?.length ? (
        <Card className="print-break">
          <H2 hint="Words you may hear from candidates for this role.">📖 Role jargon decoder</H2>
          <dl className="grid gap-x-6 gap-y-2 text-sm md:grid-cols-2">
            {c.blueprint.jargon.map((j, i) => (
              <div key={i}>
                <dt className="font-medium">{j.term}</dt>
                <dd className="text-stone-500">{j.meaning}</dd>
              </div>
            ))}
          </dl>
        </Card>
      ) : null}
    </div>
  );
}
