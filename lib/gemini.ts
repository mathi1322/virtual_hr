import "server-only";
import { GoogleGenAI, ApiError, type Part } from "@google/genai";
import type { z } from "zod";
import { toGeminiSchema } from "./schemas";

/** Friendly error that the UI can show to a non-technical user as-is. */
export class AIError extends Error {}

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AIError(
      "The AI isn't set up yet. Add your free Gemini API key to the .env file in the project folder (GEMINI_API_KEY=...) and restart the app.",
    );
  }
  // Free-tier requests can queue for a while; allow up to 4 minutes per call.
  client ??= new GoogleGenAI({ apiKey, httpOptions: { timeout: 240_000 } });
  return client;
}

export const MODEL = () => process.env.GEMINI_MODEL || "gemini-3.8-flash";

/**
 * The free tier allows only ~20 requests per day PER MODEL. When the main model's daily
 * quota is used up we fall back to the next-best free model, which has its own quota.
 */
const DEFAULT_FALLBACKS = "gemini-3.7-flash,gemini-3.6-flash,gemini-3.5-flash";
function modelChain(): string[] {
  const fallbacks = (process.env.GEMINI_FALLBACK_MODELS ?? DEFAULT_FALLBACKS)
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  return [...new Set([MODEL(), ...fallbacks])];
}

// model -> day (Pacific time, when Google resets free quotas) it ran out of quota
const exhausted = new Map<string, string>();
const quotaDay = () => new Date().toLocaleDateString("en-US", { timeZone: "America/Los_Angeles" });
const isExhausted = (m: string) => exhausted.get(m) === quotaDay();

function isDailyQuotaError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 429 && /PerDay/i.test(err.message);
}

const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const BACKOFF_MS = [3_000, 8_000, 20_000, 40_000];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type GenerateOpts<T extends z.ZodType> = {
  schema: T;
  system: string;
  parts: Part[];
  temperature?: number;
};

/**
 * Call Gemini and get back data that is guaranteed to match `schema`.
 * - Uses Gemini's structured output (JSON schema) so the response shape is enforced.
 * - Validates again with Zod; if invalid, retries once telling the model what was wrong.
 * - Retries with backoff on free-tier rate limits and transient server errors.
 */
export async function generateJSON<T extends z.ZodType>({
  schema,
  system,
  parts,
  temperature = 0.3,
}: GenerateOpts<T>): Promise<z.infer<T>> {
  const ai = getClient();
  const jsonSchema = toGeminiSchema(schema);
  let contents: Part[] = parts;

  for (let validationAttempt = 0; validationAttempt < 2; validationAttempt++) {
    const text = await callWithFallback((model) =>
      ai.models
        .generateContent({
          model,
          contents: [{ role: "user", parts: contents }],
          config: {
            systemInstruction: system,
            temperature,
            responseMimeType: "application/json",
            responseJsonSchema: jsonSchema,
          },
        })
        .then((r) => r.text ?? ""),
    );

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = undefined;
    }
    const result = schema.safeParse(parsed);
    if (result.success) return result.data;

    contents = [
      ...parts,
      {
        text:
          "\n\nYour previous answer did not match the required JSON schema. " +
          `Problems: ${result.error?.message ?? "invalid JSON"}. Return valid JSON only.`,
      },
    ];
  }
  throw new AIError("The AI returned an unexpected answer twice. Please click retry.");
}

async function callWithFallback(fn: (model: string) => Promise<string>): Promise<string> {
  const chain = modelChain();
  const available = chain.filter((m) => !isExhausted(m));
  if (!available.length) throw dailyLimitError(chain);
  let lastErr: unknown;
  for (const model of available) {
    try {
      return await callWithRetry(() => fn(model));
    } catch (err) {
      const cause = err instanceof FallbackSignal ? err.cause : err;
      lastErr = cause;
      if (isDailyQuotaError(cause)) {
        exhausted.set(model, quotaDay());
        console.warn(`[gemini] daily free quota used up for ${model}; falling back`);
        continue;
      }
      // Model not available to this key: try the next one.
      if (cause instanceof ApiError && cause.status === 404 && model !== available.at(-1)) continue;
      throw toFriendly(cause, cause instanceof ApiError ? cause.status : undefined);
    }
  }
  if (isDailyQuotaError(lastErr)) throw dailyLimitError(chain);
  throw toFriendly(lastErr, lastErr instanceof ApiError ? lastErr.status : undefined);
}

class FallbackSignal extends Error {
  constructor(public cause: unknown) {
    super("fallback");
  }
}

function dailyLimitError(chain: string[]): AIError {
  return new AIError(
    `Today's free AI allowance is used up (about 20 requests per model per day; tried ${chain.join(", ")}). ` +
      "It resets at midnight US Pacific time. To lift the limit, enable billing on your key in Google AI Studio.",
  );
}

async function callWithRetry(fn: () => Promise<string>): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = err instanceof ApiError ? err.status : undefined;
      // A daily quota won't recover by waiting: hand it to the fallback logic immediately.
      if (isDailyQuotaError(err) || status === 404) throw new FallbackSignal(err);
      if (status && RETRYABLE.has(status) && attempt < BACKOFF_MS.length) {
        await sleep(BACKOFF_MS[attempt]);
        continue;
      }
      throw new FallbackSignal(err);
    }
  }
}

function toFriendly(err: unknown, status?: number): AIError {
  if (err instanceof AIError) return err;
  const raw = err instanceof Error ? err.message : String(err);
  console.error("[gemini]", status, raw);
  if (status === 429)
    return new AIError("The free AI is getting too many requests right now. Wait a minute or two, then click retry.");
  if (status === 400 && /api key/i.test(raw))
    return new AIError("The Gemini API key looks invalid. Check GEMINI_API_KEY in your .env file.");
  if (status === 403)
    return new AIError("The Gemini API key doesn't have access. Check it in Google AI Studio.");
  if (status === 404)
    return new AIError(
      `The AI model "${MODEL()}" wasn't found. Set GEMINI_MODEL in your .env file to a model listed by 'npm run check-ai'.`,
    );
  if (status && status >= 500)
    return new AIError("Google's AI service is busy right now. Please click retry in a minute.");
  return new AIError(`Something went wrong talking to the AI: ${raw.slice(0, 200)}`);
}
