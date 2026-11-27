// AI quality check: runs the sample resumes through the running app and checks the results.
//
//   npm run dev            (in one terminal)
//   npm run eval           (in another)
//
// Options:
//   --url=http://localhost:3000   app address (default http://localhost:3000)
//   --only=2-inflated.txt         run a single sample
//   --keep                        keep the test candidates in the app (deleted by default)
//
// Cost: about 3 free AI requests per resume (plus 1 the first time a role is used).
// Run it after changing lib/prompts.ts or GEMINI_MODEL, not on every change.

import fs from "node:fs";
import path from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
);
const BASE = String(args.url ?? "http://localhost:3000").replace(/\/$/, "");
const ROOT = path.resolve(import.meta.dirname, "..");
const spec = JSON.parse(fs.readFileSync(path.join(ROOT, "samples/expectations.json"), "utf8"));
const cases = spec.cases.filter((c) => !args.only || c.file === args.only);

const SECTIONS = ["resume_deep_dive", "capability", "drive_grit", "pressure_test", "attitude_integrity", "candidate_questions"];

/* ---------------------------------------------------------------- */

async function analyse(c) {
  const fd = new FormData();
  const buf = fs.readFileSync(path.join(ROOT, "samples", c.file));
  fd.set("resume", new File([buf], c.file, { type: "text/plain" }));
  fd.set("designation", spec.designation);
  fd.set("companyContext", spec.companyContext);
  const res = await fetch(`${BASE}/api/candidates`, { method: "POST", body: fd });
  const { id, error } = await res.json();
  if (!id) throw new Error(error || `upload failed (${res.status})`);

  const started = Date.now();
  while (true) {
    await new Promise((r) => setTimeout(r, 5000));
    const cand = await (await fetch(`${BASE}/api/candidates/${id}`)).json();
    if (cand.status === "ready") return { cand, seconds: Math.round((Date.now() - started) / 1000) };
    if (cand.status === "error") throw Object.assign(new Error(cand.error), { id });
    if (Date.now() - started > 15 * 60_000) throw Object.assign(new Error("timed out after 15 min"), { id });
    process.stdout.write(`  …${cand.status}\r`);
  }
}

function check(c, cand) {
  const results = [];
  const ok = (name, pass, detail = "") => results.push({ name, pass: !!pass, detail });
  const s = cand.summary;
  const k = cand.kit;
  const highFlags = s.redFlags.filter((r) => r.severity === "high").length;

  // --- judgement checks (is the AI reading the candidate correctly?) ---
  ok(`Fit rated ${c.fitIn.join(" or ")}`, c.fitIn.includes(s.overallFit), `got "${s.overallFit}"`);
  if (c.maxHighRedFlags != null) ok(`At most ${c.maxHighRedFlags} high red flags`, highFlags <= c.maxHighRedFlags, `got ${highFlags}`);
  if (c.minHighRedFlags != null) ok(`At least ${c.minHighRedFlags} high red flag`, highFlags >= c.minHighRedFlags, `got ${highFlags}`);
  if (c.minClaimsToVerify != null)
    ok(`At least ${c.minClaimsToVerify} claims to verify`, s.claimsToVerify.length >= c.minClaimsToVerify, `got ${s.claimsToVerify.length}`);
  if (c.minGaps != null) ok(`At least ${c.minGaps} gaps found`, s.gaps.length >= c.minGaps, `got ${s.gaps.length}`);
  for (const term of c.claimsMustMention ?? []) {
    const claimsText = s.claimsToVerify.map((x) => x.claim).join(" ").toLowerCase();
    ok(`Flags the "${term}" claim`, claimsText.includes(term.toLowerCase()));
  }
  if (c.claimsMustMention?.length) {
    const deepDive = k.questions.filter((q) => q.section === "resume_deep_dive").map((q) => q.question.toLowerCase()).join(" ");
    const hit = c.claimsMustMention.filter((t) => deepDive.includes(t.toLowerCase()));
    ok("Deep-dive questions target the flagged claims", hit.length >= 1, `mentions: ${hit.join(", ") || "none"}`);
  }

  // --- kit structure checks (is it usable by a non-technical interviewer?) ---
  ok("12–16 questions", k.questions.length >= 12 && k.questions.length <= 16, `got ${k.questions.length}`);
  const missing = SECTIONS.filter((sec) => !k.questions.some((q) => q.section === sec));
  ok("All 6 sections present", !missing.length, missing.length ? `missing: ${missing.join(", ")}` : "");
  const drive = k.questions.filter((q) => q.dimension === "drive").length;
  ok("At least 3 questions measure drive", drive >= 3, `got ${drive}`);
  const incomplete = k.questions.filter(
    (q) =>
      q.listenFor.length < 3 || q.redFlags.length < 2 || q.followUps.length < 2 ||
      !q.rubric.score1 || !q.rubric.score3 || !q.rubric.score5 || !q.whyWeAsk || !q.interviewerTip,
  );
  ok("Every card is complete (✅ 🚩 follow-ups rubric tip)", !incomplete.length, incomplete.map((q) => q.id).join(", "));
  const minutes = k.questions.reduce((a, q) => a + (q.timeMinutes || 0), 0);
  ok("Fits in 40–75 minutes", minutes >= 40 && minutes <= 75, `got ${minutes} min`);
  const pressure = k.questions.filter((q) => q.section === "pressure_test");
  ok("Pressure test tells interviewer to push back", pressure.some((q) => /push|challenge|not convinced|skeptic|sceptic/i.test(q.interviewerTip)));

  // --- fairness checks ---
  const judged = JSON.stringify({ summary: s, kit: k });
  const leaked = (c.namesThatMustNotLeak ?? []).filter((n) => new RegExp(`(?<!\\w)${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!\\w)`, "i").test(judged));
  ok("Candidate's name/contact not used in judging", !leaked.length, leaked.join(", "));
  const illegal = /\b(how old|your age|married|children|kids|pregnan|religio|nationality|citizenship|disabilit|health condition)\b/i;
  const bad = k.questions.filter((q) => illegal.test([q.question, ...q.followUps].join(" ")));
  ok("No inappropriate questions (age, family, religion, health…)", !bad.length, bad.map((q) => q.id).join(", "));

  return results;
}

/* ---------------------------------------------------------------- */

try {
  await fetch(BASE);
} catch {
  console.error(`✗ The app isn't running at ${BASE}. Start it with "npm run dev" first (or pass --url=...).`);
  process.exit(1);
}

console.log(`AI quality check · ${cases.length} resume(s) · ${BASE}`);
console.log(`Note: each resume takes a few minutes and uses ~3 of your free daily AI requests.\n`);

let failed = 0;
let errored = 0;
for (const c of cases) {
  console.log(`▶ ${c.label} (${c.file})`);
  let id;
  try {
    const { cand, seconds } = await analyse(c);
    process.stdout.write("\r\x1b[K"); // clear the progress line
    id = cand.id;
    const results = check(c, cand);
    for (const r of results) console.log(`  ${r.pass ? "✓" : "✗"} ${r.name}${r.detail && !r.pass ? `: ${r.detail}` : ""}`);
    const f = results.filter((r) => !r.pass).length;
    failed += f;
    console.log(`  ${f ? `${f} check(s) failed` : "all checks passed"} · ${seconds}s · fit: ${cand.summary.overallFit}\n`);
  } catch (e) {
    id = e.id;
    errored++;
    console.log(`  ✗ Could not analyse: ${e.message}\n`);
    if (/allowance is used up/i.test(e.message)) break;
  } finally {
    if (id && !args.keep) await fetch(`${BASE}/api/candidates/${id}`, { method: "DELETE" }).catch(() => {});
  }
}

if (errored) console.log(`${errored} resume(s) couldn't be analysed (see above); those are AI/quota problems, not quality failures.`);
console.log(failed ? `✗ ${failed} quality check(s) failed. Review the prompts or model.` : errored ? "" : "✓ All quality checks passed.");
process.exit(failed || errored ? 1 : 0);
