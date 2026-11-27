import "server-only";
import fs from "node:fs/promises";
import mammoth from "mammoth";
import type { Part } from "@google/genai";

export const ACCEPTED = {
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "text/plain": ".txt",
} as const;

export function mimeFromName(name: string, fallback: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".txt") || lower.endsWith(".md")) return "text/plain";
  return fallback;
}

/**
 * Turn the uploaded resume into Gemini input parts.
 * PDFs go in natively (Gemini reads layout and scanned pages via vision);
 * DOCX is converted to text; TXT is passed as-is.
 */
export async function resumeToParts(filePath: string, mimeType: string): Promise<Part[]> {
  const buf = await fs.readFile(filePath);
  if (mimeType === "application/pdf") {
    return [{ inlineData: { mimeType, data: buf.toString("base64") } }];
  }
  if (mimeType.includes("wordprocessingml")) {
    const { value } = await mammoth.extractRawText({ buffer: buf });
    return [{ text: `RESUME (converted from Word):\n\n${value}` }];
  }
  return [{ text: `RESUME:\n\n${buf.toString("utf8")}` }];
}
