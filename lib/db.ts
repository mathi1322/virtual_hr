import "server-only";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type {
  CandidateSummary,
  InterviewKit,
  InterviewNotes,
  ResumeData,
  RoleBlueprint,
  Scorecard,
} from "./schemas";

export const DATA_DIR = path.join(process.cwd(), "data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

export type PipelineStatus = "queued" | "extracting" | "blueprint" | "summary" | "kit" | "ready" | "error";

export type Candidate = {
  id: string;
  createdAt: string;
  name: string;
  designation: string;
  jobDescription: string;
  companyContext: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  status: PipelineStatus;
  error: string;
  roleKey: string;
  resume: ResumeData | null;
  summary: CandidateSummary | null;
  kit: InterviewKit | null;
  notes: InterviewNotes | null;
  scorecard: Scorecard | null;
};

const g = globalThis as unknown as { __vhrDb?: DatabaseSync };

function db(): DatabaseSync {
  if (g.__vhrDb) return g.__vhrDb;
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const d = new DatabaseSync(path.join(DATA_DIR, "app.db"));
  d.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS candidates (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      designation TEXT NOT NULL,
      job_description TEXT NOT NULL DEFAULT '',
      company_context TEXT NOT NULL DEFAULT '',
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT NOT NULL DEFAULT '',
      role_key TEXT NOT NULL DEFAULT '',
      resume_json TEXT,
      summary_json TEXT,
      kit_json TEXT,
      notes_json TEXT,
      scorecard_json TEXT
    );
    CREATE TABLE IF NOT EXISTS roles (
      key TEXT PRIMARY KEY,
      designation TEXT NOT NULL,
      blueprint_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  g.__vhrDb = d;
  return d;
}

type Row = Record<string, string | null>;
const parse = <T>(s: string | null | undefined): T | null => (s ? (JSON.parse(s) as T) : null);

function rowToCandidate(r: Row): Candidate {
  return {
    id: r.id!,
    createdAt: r.created_at!,
    name: r.name ?? "",
    designation: r.designation!,
    jobDescription: r.job_description ?? "",
    companyContext: r.company_context ?? "",
    fileName: r.file_name!,
    filePath: r.file_path!,
    mimeType: r.mime_type!,
    status: r.status as PipelineStatus,
    error: r.error ?? "",
    roleKey: r.role_key ?? "",
    resume: parse(r.resume_json),
    summary: parse(r.summary_json),
    kit: parse(r.kit_json),
    notes: parse(r.notes_json),
    scorecard: parse(r.scorecard_json),
  };
}

export function newId(): string {
  return crypto.randomUUID().slice(0, 8);
}

export function createCandidate(c: {
  id: string;
  designation: string;
  jobDescription: string;
  companyContext: string;
  fileName: string;
  filePath: string;
  mimeType: string;
}): void {
  db()
    .prepare(
      `INSERT INTO candidates (id, created_at, designation, job_description, company_context, file_name, file_path, mime_type, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued')`,
    )
    .run(c.id, new Date().toISOString(), c.designation, c.jobDescription, c.companyContext, c.fileName, c.filePath, c.mimeType);
}

export function getCandidate(id: string): Candidate | null {
  const r = db().prepare("SELECT * FROM candidates WHERE id = ?").get(id) as Row | undefined;
  return r ? rowToCandidate(r) : null;
}

export function listCandidates(): Candidate[] {
  const rows = db().prepare("SELECT * FROM candidates ORDER BY created_at DESC").all() as Row[];
  return rows.map(rowToCandidate);
}

const COLUMN: Record<string, string> = {
  name: "name",
  status: "status",
  error: "error",
  roleKey: "role_key",
  resume: "resume_json",
  summary: "summary_json",
  kit: "kit_json",
  notes: "notes_json",
  scorecard: "scorecard_json",
};

type Updatable = Partial<Pick<Candidate, "name" | "status" | "error" | "roleKey" | "resume" | "summary" | "kit" | "notes" | "scorecard">>;

export function updateCandidate(id: string, patch: Updatable): void {
  const sets: string[] = [];
  const vals: (string | null)[] = [];
  for (const [k, v] of Object.entries(patch)) {
    const col = COLUMN[k];
    if (!col) continue;
    sets.push(`${col} = ?`);
    vals.push(col.endsWith("_json") ? (v == null ? null : JSON.stringify(v)) : (v as string));
  }
  if (!sets.length) return;
  db().prepare(`UPDATE candidates SET ${sets.join(", ")} WHERE id = ?`).run(...vals, id);
}

export function deleteCandidate(id: string): void {
  const c = getCandidate(id);
  if (c?.filePath && c.filePath.startsWith(UPLOAD_DIR)) fs.rmSync(c.filePath, { force: true });
  db().prepare("DELETE FROM candidates WHERE id = ?").run(id);
}

/* ---------------- Role blueprints (shared across candidates) -------- */

export function roleKeyFor(designation: string, jobDescription: string): string {
  const norm = designation.trim().toLowerCase().replace(/\s+/g, " ");
  const jd = jobDescription.trim();
  return jd ? `${norm}#${crypto.createHash("sha1").update(jd).digest("hex").slice(0, 10)}` : norm;
}

export function getBlueprint(key: string): RoleBlueprint | null {
  const r = db().prepare("SELECT blueprint_json FROM roles WHERE key = ?").get(key) as Row | undefined;
  return parse<RoleBlueprint>(r?.blueprint_json);
}

export function saveBlueprint(key: string, designation: string, bp: RoleBlueprint): void {
  db()
    .prepare(
      `INSERT INTO roles (key, designation, blueprint_json, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET blueprint_json = excluded.blueprint_json`,
    )
    .run(key, designation, JSON.stringify(bp), new Date().toISOString());
}
