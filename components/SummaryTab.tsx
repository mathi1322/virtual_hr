"use client";

import type { ClientCandidate } from "./types";
import { Badge, Button, Card, H2, type Tone } from "./ui";

const FIT: Record<string, { tone: Tone; label: string }> = {
  strong: { tone: "green", label: "Strong fit on paper" },
  promising: { tone: "blue", label: "Promising" },
  mixed: { tone: "amber", label: "Mixed" },
  weak: { tone: "red", label: "Weak fit on paper" },
};
const COVER: Record<string, { tone: Tone; label: string }> = {
  met: { tone: "green", label: "Met" },
  partial: { tone: "amber", label: "Partial" },
  missing: { tone: "red", label: "Missing" },
  unclear: { tone: "gray", label: "Unclear" },
};
const SEV: Record<string, Tone> = { high: "red", medium: "amber", low: "gray" };

export default function SummaryTab({ c, onNext }: { c: ClientCandidate; onNext: () => void }) {
  const s = c.summary!;
  const bp = c.blueprint;
  const fit = FIT[s.overallFit];

  return (
    <div className="space-y-6">
      <Card className="border-indigo-200 bg-indigo-50/40">
        <div className="mb-2 flex items-center gap-2">
          <Badge tone={fit.tone}>{fit.label}</Badge>
          <span className="text-xs text-stone-500">Based on the resume only; the interview decides.</span>
        </div>
        <p className="text-[15px] leading-relaxed">{s.fitSnapshot}</p>
        <p className="mt-3 text-sm text-stone-600">{s.experienceSummary}</p>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <H2>💪 Strengths</H2>
          <ul className="space-y-3 text-sm">
            {s.strengths.map((x, i) => (
              <li key={i}>
                <p className="font-medium">{x.point}</p>
                <p className="text-stone-500">{x.evidence}</p>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <H2>🕳️ Gaps</H2>
          <ul className="space-y-3 text-sm">
            {s.gaps.length ? (
              s.gaps.map((x, i) => (
                <li key={i}>
                  <p className="font-medium">{x.point}</p>
                  <p className="text-stone-500">{x.whyItMatters}</p>
                </li>
              ))
            ) : (
              <li className="text-stone-400">No significant gaps found.</li>
            )}
          </ul>
        </Card>
      </div>

      <Card>
        <H2 hint="The things the interview must test. Each one is already turned into questions in your kit.">
          🔍 Claims to verify
        </H2>
        <div className="divide-y divide-stone-100">
          {s.claimsToVerify.map((x, i) => (
            <div key={i} className="py-3 text-sm first:pt-0">
              <p className="font-medium">“{x.claim}”</p>
              <p className="text-stone-500">{x.whyVerify}</p>
              <p className="mt-1 text-indigo-700">
                <span className="font-medium">Ask:</span> {x.howToProbe}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {s.redFlags.length > 0 && (
        <Card>
          <H2>🚩 Resume red flags</H2>
          <ul className="space-y-3 text-sm">
            {s.redFlags.map((x, i) => (
              <li key={i} className="flex gap-3">
                <Badge tone={SEV[x.severity]}>{x.severity}</Badge>
                <div>
                  <p className="font-medium">{x.flag}</p>
                  <p className="text-stone-500">{x.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <H2 hint={bp ? bp.roleSummaryPlain : undefined}>✅ Must-haves for this role</H2>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-stone-100">
            {s.mustHaveCoverage.map((m, i) => (
              <tr key={i}>
                <td className="py-2 pr-4 align-top font-medium">{m.requirement}</td>
                <td className="py-2 pr-4 align-top">
                  <Badge tone={COVER[m.status].tone}>{COVER[m.status].label}</Badge>
                </td>
                <td className="py-2 align-top text-stone-500">{m.evidence}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {s.jargonExplained.length > 0 && (
        <Card>
          <H2 hint="Terms from this resume, in plain English.">📖 Jargon decoder</H2>
          <dl className="grid gap-x-6 gap-y-2 text-sm md:grid-cols-2">
            {s.jargonExplained.map((j, i) => (
              <div key={i}>
                <dt className="font-medium">{j.term}</dt>
                <dd className="text-stone-500">{j.meaning}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={onNext}>See the interview kit →</Button>
      </div>
    </div>
  );
}
