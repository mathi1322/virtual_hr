"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ClientCandidate } from "./types";
import {
  DIMENSION_LABELS,
  SECTIONS,
  SECTION_LABELS,
  emptyNotes,
  type InterviewNotes,
  type QuestionNote,
  type Rating,
} from "@/lib/schemas";
import { Badge, Button, Card } from "./ui";

const RATINGS: { key: Rating; label: string; cls: string }[] = [
  { key: "strong", label: "💪 Strong", cls: "bg-emerald-600 text-white ring-emerald-600" },
  { key: "ok", label: "👌 OK", cls: "bg-amber-500 text-white ring-amber-500" },
  { key: "weak", label: "👎 Weak", cls: "bg-rose-600 text-white ring-rose-600" },
  { key: "skipped", label: "Skipped", cls: "bg-stone-500 text-white ring-stone-500" },
];

const GUT: { key: InterviewNotes["gutFeel"]; label: string }[] = [
  { key: "excited", label: "🤩 Excited" },
  { key: "positive", label: "🙂 Positive" },
  { key: "unsure", label: "🤔 Unsure" },
  { key: "negative", label: "😕 Negative" },
];

const blankNote = (): QuestionNote => ({ rating: null, heardGreen: [], heardRed: [], notes: "" });

export default function LiveTab({
  c,
  setNotes,
  onFinish,
}: {
  c: ClientCandidate;
  setNotes: (n: InterviewNotes) => void;
  onFinish: () => void;
}) {
  const questions = useMemo(
    () => SECTIONS.flatMap((s) => c.kit!.questions.filter((q) => q.section === s)),
    [c.kit],
  );
  const [notes, setLocal] = useState<InterviewNotes>(c.notes ?? emptyNotes());
  const [idx, setIdx] = useState(0);
  const [saved, setSaved] = useState<"saved" | "saving" | "error">("saved");
  const [showGuide, setShowGuide] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isWrapUp = idx === questions.length;
  const q = questions[idx];
  const note = q ? (notes.perQuestion[q.id] ?? blankNote()) : blankNote();

  function update(next: InterviewNotes) {
    setLocal(next);
    setNotes(next);
    setSaved("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const res = await fetch(`/api/candidates/${c.id}/notes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      }).catch(() => null);
      setSaved(res?.ok ? "saved" : "error");
    }, 700);
  }

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function updateNote(patch: Partial<QuestionNote>) {
    update({ ...notes, perQuestion: { ...notes.perQuestion, [q.id]: { ...note, ...patch } } });
  }

  function toggle(list: "heardGreen" | "heardRed", i: number) {
    const cur = note[list];
    updateNote({ [list]: cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i] });
  }

  const answered = questions.filter((x) => notes.perQuestion[x.id]?.rating).length;

  return (
    <div className="space-y-5">
      {/* progress */}
      <div className="flex flex-wrap items-center gap-1.5">
        {questions.map((x, i) => {
          const r = notes.perQuestion[x.id]?.rating;
          const color = r === "strong" ? "bg-emerald-500" : r === "ok" ? "bg-amber-400" : r === "weak" ? "bg-rose-500" : r === "skipped" ? "bg-stone-400" : "bg-stone-200";
          return (
            <button
              key={x.id}
              onClick={() => setIdx(i)}
              title={`Question ${i + 1}`}
              className={`h-2.5 flex-1 min-w-4 rounded-full ${color} ${i === idx ? "ring-2 ring-indigo-500 ring-offset-2" : ""}`}
            />
          );
        })}
        <button
          onClick={() => setIdx(questions.length)}
          className={`ml-2 rounded-full px-2 text-xs ${isWrapUp ? "bg-indigo-600 text-white" : "bg-stone-200 text-stone-600"}`}
        >
          Wrap-up
        </button>
        <span className="ml-auto pl-3 text-xs text-stone-500">
          {answered}/{questions.length} rated ·{" "}
          {saved === "saving" ? "saving…" : saved === "error" ? <span className="text-rose-600">not saved, check connection</span> : "saved ✓"}
        </span>
      </div>

      {!isWrapUp && q && (
        <>
          <Card className="p-6">
            <div className="mb-3 flex items-center gap-2 text-xs text-stone-500">
              <span>Question {idx + 1} of {questions.length}</span>·<span>{SECTION_LABELS[q.section]}</span>
              <Badge tone="blue">{DIMENSION_LABELS[q.dimension]}</Badge>
              <span className="ml-auto">~{q.timeMinutes} min</span>
            </div>
            <p className="text-xl font-medium leading-relaxed">{q.question}</p>
            <p className="mt-3 rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-900">💡 {q.interviewerTip}</p>
          </Card>

          <div className="grid gap-5 md:grid-cols-5">
            <div className="space-y-5 md:col-span-3">
              <Card>
                <p className="mb-2 text-sm font-medium">Tick what you heard</p>
                <div className="space-y-1.5">
                  {q.listenFor.map((x, i) => (
                    <label key={`g${i}`} className="flex cursor-pointer items-start gap-2 rounded-md p-1.5 text-sm hover:bg-emerald-50">
                      <input type="checkbox" className="mt-0.5 accent-emerald-600" checked={note.heardGreen.includes(i)} onChange={() => toggle("heardGreen", i)} />
                      <span><span className="text-emerald-700">✅</span> {x}</span>
                    </label>
                  ))}
                  <div className="my-2 border-t border-stone-100" />
                  {q.redFlags.map((x, i) => (
                    <label key={`r${i}`} className="flex cursor-pointer items-start gap-2 rounded-md p-1.5 text-sm hover:bg-rose-50">
                      <input type="checkbox" className="mt-0.5 accent-rose-600" checked={note.heardRed.includes(i)} onChange={() => toggle("heardRed", i)} />
                      <span><span className="text-rose-700">🚩</span> {x}</span>
                    </label>
                  ))}
                </div>
              </Card>

              <Card>
                <label className="mb-2 block text-sm font-medium" htmlFor="qnotes">
                  Notes <span className="font-normal text-stone-400">(write their exact words when you can)</span>
                </label>
                <textarea
                  id="qnotes"
                  rows={5}
                  value={note.notes}
                  onChange={(e) => updateNote({ notes: e.target.value })}
                  placeholder="e.g. Said they 'personally rewrote the caching layer'. Couldn't explain why latency dropped when I asked a follow-up."
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </Card>
            </div>

            <div className="space-y-5 md:col-span-2">
              <Card>
                <p className="mb-2 text-sm font-medium">↳ Follow-ups (go deeper)</p>
                <ol className="list-decimal space-y-1.5 pl-5 text-sm">
                  {q.followUps.map((x, i) => <li key={i}>{x}</li>)}
                </ol>
              </Card>
              <Card>
                <button onClick={() => setShowGuide(!showGuide)} className="flex w-full justify-between text-sm font-medium">
                  Scoring guide <span className="text-stone-400">{showGuide ? "hide" : "show"}</span>
                </button>
                {showGuide && (
                  <div className="mt-2 space-y-2 text-xs">
                    <p><span className="font-semibold text-emerald-700">5:</span> {q.rubric.score5}</p>
                    <p><span className="font-semibold text-amber-700">3:</span> {q.rubric.score3}</p>
                    <p><span className="font-semibold text-rose-700">1:</span> {q.rubric.score1}</p>
                  </div>
                )}
              </Card>
            </div>
          </div>

          <Card>
            <p className="mb-2 text-sm font-medium">Overall, how was this answer?</p>
            <div className="flex flex-wrap gap-2">
              {RATINGS.map((r) => (
                <button
                  key={r.key}
                  onClick={() => updateNote({ rating: note.rating === r.key ? null : r.key })}
                  className={`rounded-lg px-4 py-2 text-sm font-medium ring-1 transition ${
                    note.rating === r.key ? r.cls : "bg-white text-stone-700 ring-stone-300 hover:bg-stone-50"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </Card>
        </>
      )}

      {isWrapUp && (
        <div className="space-y-5">
          <Card>
            <p className="mb-2 text-sm font-medium">Your gut feeling about this person</p>
            <div className="flex flex-wrap gap-2">
              {GUT.map((g) => (
                <button
                  key={g.key}
                  onClick={() => update({ ...notes, gutFeel: notes.gutFeel === g.key ? "" : g.key })}
                  className={`rounded-lg px-4 py-2 text-sm ring-1 ${notes.gutFeel === g.key ? "bg-indigo-600 text-white ring-indigo-600" : "ring-stone-300 hover:bg-stone-50"}`}
                >
                  {g.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-stone-500">The AI treats this as a weak signal and will point out if it conflicts with the evidence.</p>
          </Card>
          <Card>
            <label className="mb-2 block text-sm font-medium" htmlFor="gnotes">General notes</label>
            <textarea
              id="gnotes"
              rows={4}
              value={notes.generalNotes}
              onChange={(e) => update({ ...notes, generalNotes: e.target.value })}
              placeholder="Energy, how they handled pushback, questions they asked you, anything else."
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </Card>
          <Card>
            <label className="mb-1 block text-sm font-medium" htmlFor="transcript">
              Call transcript <span className="font-normal text-stone-400">(optional, greatly improves accuracy)</span>
            </label>
            <p className="mb-2 text-xs text-stone-500">
              If the call was on Zoom, Google Meet or Teams with transcription on, paste it here. Get the candidate&apos;s consent before recording.
            </p>
            <textarea
              id="transcript"
              rows={8}
              value={notes.transcript}
              onChange={(e) => update({ ...notes, transcript: e.target.value })}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 font-mono text-xs focus:border-indigo-500 focus:outline-none"
            />
          </Card>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button variant="secondary" onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0}>
          ← Previous
        </Button>
        {isWrapUp ? (
          <Button onClick={onFinish}>Get the scorecard →</Button>
        ) : (
          <Button onClick={() => setIdx(idx + 1)}>{idx === questions.length - 1 ? "Wrap-up →" : "Next question →"}</Button>
        )}
      </div>
    </div>
  );
}
