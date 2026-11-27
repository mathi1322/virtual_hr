"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ClientCandidate } from "./types";
import type { InterviewKit, InterviewNotes, Scorecard } from "@/lib/schemas";
import { Badge, Button, ErrorBox, Spinner } from "./ui";
import SummaryTab from "./SummaryTab";
import KitTab from "./KitTab";
import LiveTab from "./LiveTab";
import ScorecardTab from "./ScorecardTab";

const STEPS = [
  { key: "extracting", label: "Reading the resume" },
  { key: "blueprint", label: "Defining what “great” looks like for this role" },
  { key: "summary", label: "Assessing the candidate against the role" },
  { key: "kit", label: "Building a tailored interview kit" },
] as const;

const TABS = [
  { key: "summary", label: "1 · Summary" },
  { key: "kit", label: "2 · Interview kit" },
  { key: "live", label: "3 · Live interview" },
  { key: "scorecard", label: "4 · Scorecard" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default function CandidateView({ initial }: { initial: ClientCandidate }) {
  const router = useRouter();
  const [c, setC] = useState(initial);
  const [tab, setTab] = useState<TabKey>(initial.scorecard ? "scorecard" : "summary");
  const busy = c.status !== "ready" && c.status !== "error";

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/candidates/${c.id}`, { cache: "no-store" });
    if (res.ok) setC(await res.json());
  }, [c.id]);

  // Expand every collapsible section when printing so the PDF contains everything.
  useEffect(() => {
    const open = () => document.querySelectorAll("details").forEach((d) => (d.open = true));
    window.addEventListener("beforeprint", open);
    return () => window.removeEventListener("beforeprint", open);
  }, []);

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(refresh, 2500);
    return () => clearInterval(t);
  }, [busy, refresh]);

  async function retry() {
    await fetch(`/api/candidates/${c.id}/retry`, { method: "POST" });
    setC({ ...c, status: "queued", error: "" });
  }

  async function remove() {
    if (!confirm("Delete this candidate and their resume? This can't be undone.")) return;
    await fetch(`/api/candidates/${c.id}`, { method: "DELETE" });
    router.push("/");
    router.refresh();
  }

  const setKit = (kit: InterviewKit) => setC((p) => ({ ...p, kit }));
  const setNotes = (notes: InterviewNotes) => setC((p) => ({ ...p, notes }));
  const setScorecard = (scorecard: Scorecard | null) => setC((p) => ({ ...p, scorecard }));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{c.name || c.fileName}</h1>
          <p className="text-stone-600">
            for <span className="font-medium">{c.designation}</span>
            {c.resume?.headline && <span className="text-stone-400"> · {c.resume.headline}</span>}
          </p>
        </div>
        <div className="no-print flex items-center gap-2">
          {c.resume && <Badge>{c.resume.totalYearsExperience} yrs experience</Badge>}
          <Button variant="danger" onClick={remove}>
            Delete
          </Button>
        </div>
      </div>

      {(busy || c.status === "error") && (
        <div className="mb-8 rounded-xl border border-stone-200 bg-white p-6">
          <ol className="space-y-3">
            {STEPS.map((s, i) => {
              const current = STEPS.findIndex((x) => x.key === c.status);
              const doneByData = [c.resume, c.blueprint, c.summary, c.kit][i];
              const state = doneByData ? "done" : c.status === s.key ? "active" : current > i ? "done" : "todo";
              return (
                <li key={s.key} className="flex items-center gap-3 text-sm">
                  <span className="grid h-6 w-6 place-items-center">
                    {state === "done" ? (
                      <span className="text-emerald-600">✓</span>
                    ) : state === "active" ? (
                      <Spinner className="h-4 w-4 text-indigo-600" />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-stone-300" />
                    )}
                  </span>
                  <span className={state === "todo" ? "text-stone-400" : ""}>{s.label}</span>
                </li>
              );
            })}
          </ol>
          {busy && (
            <p className="mt-4 text-sm text-stone-500">
              This usually takes 3–6 minutes on the free AI tier. You can leave this page and come back; it keeps working.
            </p>
          )}
          {c.status === "error" && (
            <div className="mt-4 space-y-3">
              <ErrorBox>{c.error}</ErrorBox>
              <Button onClick={retry}>Retry from where it stopped</Button>
            </div>
          )}
        </div>
      )}

      {c.status === "ready" && c.summary && c.kit && (
        <>
          <nav className="no-print mb-6 flex gap-1 overflow-x-auto rounded-xl bg-stone-200/60 p-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${
                  tab === t.key ? "bg-white shadow-sm" : "text-stone-600 hover:text-stone-900"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {tab === "summary" && <SummaryTab c={c} onNext={() => setTab("kit")} />}
          {tab === "kit" && <KitTab c={c} setKit={setKit} onReset={() => { refresh(); }} onStart={() => setTab("live")} />}
          {tab === "live" && <LiveTab c={c} setNotes={setNotes} onFinish={() => setTab("scorecard")} />}
          {tab === "scorecard" && <ScorecardTab c={c} setScorecard={setScorecard} goLive={() => setTab("live")} />}
        </>
      )}
    </div>
  );
}
