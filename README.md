# Virtual HR: an interview co-pilot

Lets a non-technical CEO or HR person interview for roles they can't judge themselves (e.g. *Senior AI/ML Full-Stack Engineer*) and get an evidence-based hire / no-hire prediction.

## How it works

1. **Upload a resume + the position** (and optionally the job description and a line about your company).
2. **Summary**: a plain-English read: strengths, gaps, must-have coverage, **claims to verify**, red flags and a jargon decoder.
3. **Interview kit**: 13–15 tailored questions in six sections (resume deep-dive, capability, drive & grit, pressure test, attitude & integrity, their questions). Every question comes with:
   - ✅ what a strong answer includes, in words a non-expert can recognise
   - 🚩 red flags
   - ↳ drill-down follow-ups (people who really did the work can go 3 levels deep; people who exaggerated stall)
   - a 1 / 3 / 5 scoring guide and a delivery tip
   Print it or save it as a PDF for in-person interviews.
4. **Live interview**: one question at a time. Tick the signals you hear, rate the answer, take notes, and optionally paste the call transcript. Everything autosaves.
5. **Scorecard**: scores for Capability, Drive & Grit, Attitude, Genuineness and Role Fit, **each backed by evidence from your notes**, plus a "will they get it done no matter what?" verdict, resume-vs-interview contradictions, a recommendation and next steps. With *Double-check* on, the AI scores 3 times and flags any dimension where the passes disagree.

The AI never sees the candidate's name or contact details when judging them, and it is told to ignore age, gender, background and college prestige. It's advisory: the decision is yours.

## Setup (once)

Requires Node.js 22.5+ (uses the built-in SQLite).

```bash
npm install
cp .env.example .env      # then paste your key into .env
npm run check-ai          # confirms the key works and lists the models you can use
npm run dev               # open http://localhost:3000
```

Get a free Gemini API key at <https://aistudio.google.com/apikey>.
`GEMINI_MODEL` in `.env` picks the model (default `gemini-3.8-flash`). Free-tier calls can take 30–60 s each, so analysing a new candidate takes a few minutes.

**Privacy note:** on Gemini's free tier, Google may use submitted data to improve its models. Tell candidates their resume is processed by AI, or use a paid key (same setup, just a different key).

Data (database + uploaded resumes) is stored locally in `./data/`.

## Try it

`samples/` has three test resumes for *Senior AI/ML Full-Stack Engineer*: a strong & genuine one, an inflated buzzword-heavy one, and a junior one.

## AI quality check

After changing `lib/prompts.ts` or `GEMINI_MODEL`, run the sample resumes through the app and check the AI still judges them correctly:

```bash
npm run dev     # terminal 1
npm run eval    # terminal 2   (options: --only=2-inflated.txt  --keep  --url=http://localhost:3000)
```

It checks that the inflated resume gets flagged, the strong one is rated well, the junior one isn't rated as senior, every question card is complete, and no names or inappropriate questions leak in. Expectations live in `samples/expectations.json`. Each run uses about 9 of your free daily AI requests.

## Code map

| Path | What |
|---|---|
| `lib/prompts.ts` | All AI instructions; tune quality here |
| `lib/schemas.ts` | Structured output shapes (Zod → JSON schema for Gemini) |
| `lib/pipeline.ts` | Extract → role blueprint → summary → kit; evaluation + self-consistency |
| `lib/gemini.ts` | Gemini client, retries, friendly errors |
| `lib/db.ts` | SQLite storage (`node:sqlite`) |
| `lib/redact.ts` | Removes identifiers before judging |
| `components/` | Summary, Kit, Live interview, Scorecard tabs |
