import type { Candidate } from "@/lib/db";
import type { RoleBlueprint } from "@/lib/schemas";

export type ClientCandidate = Omit<Candidate, "filePath"> & { blueprint: RoleBlueprint | null };
