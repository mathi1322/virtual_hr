import type { ResumeData } from "./schemas";

/**
 * Remove personal identifiers before the AI judges the candidate,
 * so scoring is based on what they did, not who they are.
 * (The extraction step has to see the raw resume; every later step uses this.)
 */
export function redactResume(r: ResumeData): Omit<ResumeData, "name" | "email" | "phone" | "links" | "location"> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { name, email, phone, links, location, ...rest } = r;
  const scrub = makeScrubber(r);
  return JSON.parse(scrub(JSON.stringify(rest)));
}

/** Returns a function that replaces the candidate's name/email/phone in free text. */
export function makeScrubber(r: Pick<ResumeData, "name" | "email" | "phone">): (s: string) => string {
  const tokens = [
    r.email,
    r.phone,
    r.name,
    ...r.name.split(/\s+/).filter((t) => t.length > 2),
  ]
    .map((t) => t?.trim())
    .filter((t): t is string => !!t && t.length > 2)
    .sort((a, b) => b.length - a.length)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!tokens.length) return (s) => s;
  const re = new RegExp(`(?<!\\w)(${tokens.join("|")})(?!\\w)`, "gi");
  return (s) => s.replace(re, "[Candidate]");
}
