import Link from "next/link";
import { connection } from "next/server";
import { listCandidates } from "@/lib/db";
import { RECOMMENDATION_LABELS } from "@/lib/schemas";
import { Badge, type Tone } from "@/components/ui";

const REC_TONE: Record<string, Tone> = { strong_hire: "green", hire: "green", lean_no: "amber", no: "red" };
const FIT_TONE: Record<string, Tone> = { strong: "green", promising: "blue", mixed: "amber", weak: "red" };

export default async function Home() {
  await connection();
  const candidates = listCandidates();

  if (!candidates.length) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Hire with confidence, even for roles you can&apos;t judge yourself.</h1>
        <p className="mt-4 text-stone-600">
          Upload a resume and the position. You get a plain-English read of the candidate, a tailored interview kit that tells you
          what good and bad answers sound like, and an evidence-based hire / no-hire prediction after the interview.
        </p>
        <ol className="mx-auto mt-8 grid max-w-xl gap-3 text-left text-sm sm:grid-cols-4">
          {["Upload resume + role", "Read the summary", "Run the interview with the kit", "Get the scorecard"].map((s, i) => (
            <li key={s} className="rounded-lg border border-stone-200 bg-white p-3">
              <span className="font-semibold text-indigo-600">{i + 1}.</span> {s}
            </li>
          ))}
        </ol>
        <Link
          href="/candidates/new"
          className="mt-10 inline-block rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-700"
        >
          Add your first candidate
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Candidates</h1>
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3">Candidate</th>
              <th className="px-4 py-3">Position</th>
              <th className="px-4 py-3">Resume fit</th>
              <th className="px-4 py-3">Interview verdict</th>
              <th className="px-4 py-3">Added</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {candidates.map((c) => (
              <tr key={c.id} className="hover:bg-stone-50">
                <td className="px-4 py-3 font-medium">
                  <Link href={`/candidates/${c.id}`} className="hover:text-indigo-700">
                    {c.name || c.fileName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-stone-600">{c.designation}</td>
                <td className="px-4 py-3">
                  {c.status === "error" ? (
                    <Badge tone="red">Needs retry</Badge>
                  ) : c.summary ? (
                    <Badge tone={FIT_TONE[c.summary.overallFit]}>{c.summary.overallFit}</Badge>
                  ) : (
                    <Badge tone="blue">Analysing…</Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  {c.scorecard ? (
                    <Badge tone={REC_TONE[c.scorecard.recommendation]}>{RECOMMENDATION_LABELS[c.scorecard.recommendation]}</Badge>
                  ) : (
                    <span className="text-stone-400">Not interviewed</span>
                  )}
                </td>
                <td className="px-4 py-3 text-stone-500">{new Date(c.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
