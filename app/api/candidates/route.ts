import { after, type NextRequest } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { createCandidate, newId, UPLOAD_DIR } from "@/lib/db";
import { ACCEPTED, mimeFromName } from "@/lib/parse";
import { runPipeline } from "@/lib/pipeline";

export const maxDuration = 300;

const MAX_BYTES = 15 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("resume");
  const designation = String(form.get("designation") ?? "").trim();
  const jobDescription = String(form.get("jobDescription") ?? "").trim();
  const companyContext = String(form.get("companyContext") ?? "").trim();

  if (!(file instanceof File) || file.size === 0) return bad("Please choose a resume file.");
  if (!designation) return bad("Please enter the position you're hiring for.");
  if (file.size > MAX_BYTES) return bad("That file is too large (max 15 MB).");
  const mimeType = mimeFromName(file.name, file.type);
  if (!(mimeType in ACCEPTED)) return bad("Please upload a PDF, Word (.docx) or text file.");

  const id = newId();
  const ext = ACCEPTED[mimeType as keyof typeof ACCEPTED];
  const filePath = path.join(UPLOAD_DIR, `${id}${ext}`);
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(filePath, Buffer.from(await file.arrayBuffer()));

  createCandidate({ id, designation, jobDescription, companyContext, fileName: file.name, filePath, mimeType });
  after(() => runPipeline(id));
  return Response.json({ id });
}

function bad(message: string) {
  return Response.json({ error: message }, { status: 400 });
}
