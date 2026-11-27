import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Shared enums                                                        */
/* ------------------------------------------------------------------ */

export const DIMENSIONS = ["capability", "drive", "attitude", "genuineness", "role_fit"] as const;
export const Dimension = z.enum(DIMENSIONS);
export type Dimension = z.infer<typeof Dimension>;

export const DIMENSION_LABELS: Record<Dimension, string> = {
  capability: "Capability",
  drive: "Drive & Grit",
  attitude: "Attitude",
  genuineness: "Genuineness",
  role_fit: "Role Fit",
};

export const DIMENSION_HELP: Record<Dimension, string> = {
  capability: "Can they actually do the work this role needs?",
  drive: "Will they push through obstacles and get it done, no matter what?",
  attitude: "Ownership, coachability, how they talk about others and failure.",
  genuineness: "Are their claims real? Can they go deep on what they say they did?",
  role_fit: "Does their experience and level match what this specific role needs?",
};

export const SECTIONS = [
  "resume_deep_dive",
  "capability",
  "drive_grit",
  "pressure_test",
  "attitude_integrity",
  "candidate_questions",
] as const;
export const Section = z.enum(SECTIONS);
export type Section = z.infer<typeof Section>;

export const SECTION_LABELS: Record<Section, string> = {
  resume_deep_dive: "Resume deep-dive",
  capability: "Capability",
  drive_grit: "Drive & grit",
  pressure_test: "Pressure test",
  attitude_integrity: "Attitude & integrity",
  candidate_questions: "Their questions",
};

/* ------------------------------------------------------------------ */
/* 1. Resume extraction                                                */
/* ------------------------------------------------------------------ */

export const ResumeData = z.object({
  name: z.string().describe("Candidate full name, or empty string if not found"),
  email: z.string().describe("Email or empty string"),
  phone: z.string().describe("Phone or empty string"),
  links: z.array(z.string()).describe("LinkedIn/GitHub/portfolio URLs"),
  location: z.string().describe("City/country or empty string"),
  headline: z.string().describe("One-line professional headline in your own words"),
  totalYearsExperience: z.number().describe("Best estimate of total professional years"),
  roles: z.array(
    z.object({
      title: z.string(),
      company: z.string(),
      start: z.string().describe("e.g. 2021-03 or 'Mar 2021'; empty if unknown"),
      end: z.string().describe("e.g. 2023-06, or 'Present'; empty if unknown"),
      durationMonths: z.number().describe("Estimated months in role; 0 if unknown"),
      highlights: z.array(z.string()).describe("Responsibilities/achievements as written"),
    }),
  ),
  skills: z.array(z.string()),
  projects: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      technologies: z.array(z.string()),
    }),
  ),
  education: z.array(
    z.object({ degree: z.string(), institution: z.string(), year: z.string() }),
  ),
  certifications: z.array(z.string()),
  quantifiedClaims: z
    .array(z.object({ claim: z.string(), context: z.string() }))
    .describe("Every claim with a number/metric, e.g. 'reduced latency 40%'"),
});
export type ResumeData = z.infer<typeof ResumeData>;

/* ------------------------------------------------------------------ */
/* 2. Role blueprint (cached per designation + JD)                      */
/* ------------------------------------------------------------------ */

export const RoleBlueprint = z.object({
  roleTitle: z.string(),
  seniority: z.string().describe("e.g. Junior / Mid / Senior / Lead / Head"),
  roleSummaryPlain: z
    .string()
    .describe("What this person actually does day to day, in plain English for a non-technical CEO"),
  mustHaves: z.array(z.string()).describe("4-7 non-negotiable capabilities, plain English"),
  niceToHaves: z.array(z.string()),
  dealBreakers: z.array(z.string()).describe("Behaviours or gaps that should rule someone out"),
  competencies: z.array(
    z.object({
      name: z.string(),
      dimension: Dimension,
      weight: z.number().describe("Importance 1-5"),
      whatGreatLooksLike: z.string(),
      whatPoorLooksLike: z.string(),
    }),
  ),
  jargon: z
    .array(z.object({ term: z.string(), meaning: z.string() }))
    .describe("Technical terms the interviewer will likely hear, explained in one plain sentence each"),
});
export type RoleBlueprint = z.infer<typeof RoleBlueprint>;

/* ------------------------------------------------------------------ */
/* 3. Candidate summary                                                */
/* ------------------------------------------------------------------ */

export const CandidateSummary = z.object({
  fitSnapshot: z.string().describe("2-3 plain-English sentences: who this person is and how they fit"),
  overallFit: z.enum(["strong", "promising", "mixed", "weak"]),
  experienceSummary: z.string(),
  strengths: z.array(z.object({ point: z.string(), evidence: z.string() })),
  gaps: z.array(z.object({ point: z.string(), whyItMatters: z.string() })),
  mustHaveCoverage: z.array(
    z.object({
      requirement: z.string(),
      status: z.enum(["met", "partial", "missing", "unclear"]),
      evidence: z.string(),
    }),
  ),
  claimsToVerify: z.array(
    z.object({ claim: z.string(), whyVerify: z.string(), howToProbe: z.string() }),
  ),
  redFlags: z.array(
    z.object({
      flag: z.string(),
      severity: z.enum(["low", "medium", "high"]),
      detail: z.string(),
    }),
  ),
  jargonExplained: z.array(z.object({ term: z.string(), meaning: z.string() })),
});
export type CandidateSummary = z.infer<typeof CandidateSummary>;

/* ------------------------------------------------------------------ */
/* 4. Interview kit                                                    */
/* ------------------------------------------------------------------ */

export const InterviewQuestion = z.object({
  id: z.string().describe("Short unique id like q1, q2"),
  section: Section,
  dimension: Dimension.describe("The main trait this question measures"),
  question: z.string().describe("Exactly what the interviewer says, conversational"),
  whyWeAsk: z.string().describe("One sentence, plain English"),
  listenFor: z
    .array(z.string())
    .describe("3-5 concrete, observable signs of a strong answer a NON-technical person can recognise"),
  redFlags: z.array(z.string()).describe("2-4 observable signs of a weak, evasive or fake answer"),
  followUps: z
    .array(z.string())
    .describe("2-3 drill-down follow-ups, each going one level deeper"),
  interviewerTip: z.string().describe("How to deliver it, e.g. 'stay silent after asking', 'push back once'"),
  rubric: z.object({
    score1: z.string().describe("What a 1/5 answer sounds like"),
    score3: z.string().describe("What a 3/5 answer sounds like"),
    score5: z.string().describe("What a 5/5 answer sounds like"),
  }),
  timeMinutes: z.number(),
});
export type InterviewQuestion = z.infer<typeof InterviewQuestion>;

export const InterviewKit = z.object({
  interviewerBriefing: z
    .string()
    .describe("Short guide on how to run this interview well, for a non-technical interviewer"),
  questions: z.array(InterviewQuestion),
  closingTip: z.string(),
});
export type InterviewKit = z.infer<typeof InterviewKit>;

/* ------------------------------------------------------------------ */
/* 5. Interview notes (filled by the human, not the AI)                */
/* ------------------------------------------------------------------ */

export const Rating = z.enum(["strong", "ok", "weak", "skipped"]);
export type Rating = z.infer<typeof Rating>;

export const QuestionNote = z.object({
  rating: Rating.nullable(),
  heardGreen: z.array(z.number()),
  heardRed: z.array(z.number()),
  notes: z.string(),
});
export type QuestionNote = z.infer<typeof QuestionNote>;

export const InterviewNotes = z.object({
  perQuestion: z.record(z.string(), QuestionNote),
  transcript: z.string(),
  generalNotes: z.string(),
  gutFeel: z.enum(["", "excited", "positive", "unsure", "negative"]),
});
export type InterviewNotes = z.infer<typeof InterviewNotes>;

export const emptyNotes = (): InterviewNotes => ({
  perQuestion: {},
  transcript: "",
  generalNotes: "",
  gutFeel: "",
});

/* ------------------------------------------------------------------ */
/* 6. Scorecard (the prediction)                                       */
/* ------------------------------------------------------------------ */

export const RECOMMENDATIONS = ["strong_hire", "hire", "lean_no", "no"] as const;
export const Recommendation = z.enum(RECOMMENDATIONS);
export type Recommendation = z.infer<typeof Recommendation>;

export const RECOMMENDATION_LABELS: Record<Recommendation, string> = {
  strong_hire: "Strong hire",
  hire: "Hire",
  lean_no: "Lean no",
  no: "No hire",
};

export const ScorecardAI = z.object({
  dimensions: z.array(
    z.object({
      dimension: Dimension,
      insufficientEvidence: z
        .boolean()
        .describe("true if the notes don't contain enough evidence to score this fairly"),
      score: z.number().describe("1-5; use 0 only when insufficientEvidence is true"),
      confidence: z.enum(["low", "medium", "high"]),
      summary: z.string().describe("One or two plain sentences"),
      evidence: z
        .array(z.string())
        .describe("Specific notes/quotes from the interview that justify the score"),
    }),
  ),
  driveVerdict: z
    .string()
    .describe("Plain answer to: will this person get the job done no matter what we throw at them? Why?"),
  topStrengths: z.array(z.string()),
  topConcerns: z.array(z.string()),
  resumeContradictions: z.array(
    z.object({ resumeClaim: z.string(), whatInterviewShowed: z.string() }),
  ),
  recommendation: Recommendation,
  recommendationConfidence: z.enum(["low", "medium", "high"]),
  headline: z.string().describe("One sentence verdict a CEO can read in 5 seconds"),
  reasoning: z.string().describe("Short paragraph explaining the recommendation"),
  nextSteps: z
    .array(z.string())
    .describe("What to verify next: reference-check questions, a technical check by an expert, etc."),
});
export type ScorecardAI = z.infer<typeof ScorecardAI>;

/** What we store: the AI output plus consistency metadata. */
export type Scorecard = ScorecardAI & {
  runs: number; // passes that completed
  requestedRuns: number;
  disagreements: Dimension[]; // dimensions where repeated runs differed by > 1 point
  generatedAt: string;
};

/* ------------------------------------------------------------------ */
/* JSON-schema conversion for Gemini                                   */
/* ------------------------------------------------------------------ */

/** Convert a Zod schema to a JSON schema Gemini's `responseJsonSchema` accepts. */
export function toGeminiSchema(schema: z.ZodType): unknown {
  const json = z.toJSONSchema(schema, { target: "draft-7" }) as Record<string, unknown>;
  const strip = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(strip);
    if (node && typeof node === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node)) {
        if (k === "$schema" || k === "additionalProperties") continue;
        out[k] = strip(v);
      }
      return out;
    }
    return node;
  };
  return strip(json);
}
