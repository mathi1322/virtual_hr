"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, ErrorBox, Spinner } from "@/components/ui";

const EXAMPLES = ["Senior AI/ML Full-Stack Engineer", "Sales Manager", "Product Designer", "Finance Controller"];

export default function NewCandidate() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [designation, setDesignation] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [companyContext, setCompanyContext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!file) return setError("Please choose a resume file.");
    if (!designation.trim()) return setError("Please enter the position you're hiring for.");
    setBusy(true);
    const fd = new FormData();
    fd.set("resume", file);
    fd.set("designation", designation);
    fd.set("jobDescription", jobDescription);
    fd.set("companyContext", companyContext);
    try {
      const res = await fetch("/api/candidates", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      router.push(`/candidates/${data.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New candidate</h1>
        <p className="text-sm text-stone-500">Takes about a minute. You&apos;ll see each step as the AI works.</p>
      </div>

      <Card>
        <label className="mb-2 block text-sm font-medium">1. Resume</label>
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition ${
            drag ? "border-indigo-400 bg-indigo-50" : "border-stone-300 hover:border-indigo-300"
          }`}
        >
          <input
            type="file"
            accept=".pdf,.docx,.txt"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <>
              <span className="font-medium">{file.name}</span>
              <span className="text-xs text-stone-500">{(file.size / 1024).toFixed(0)} KB · click to change</span>
            </>
          ) : (
            <>
              <span className="font-medium">Drop the resume here or click to choose</span>
              <span className="text-xs text-stone-500">PDF (incl. scanned), Word .docx or .txt</span>
            </>
          )}
        </label>
      </Card>

      <Card>
        <label className="mb-2 block text-sm font-medium" htmlFor="designation">
          2. Position you&apos;re hiring for
        </label>
        <input
          id="designation"
          value={designation}
          onChange={(e) => setDesignation(e.target.value)}
          placeholder="e.g. Senior AI/ML Full-Stack Engineer"
          className="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-indigo-500 focus:outline-none"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setDesignation(ex)}
              className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-600 hover:bg-stone-200"
            >
              {ex}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <label className="mb-1 block text-sm font-medium" htmlFor="jd">
          3. Job description <span className="font-normal text-stone-400">(optional, improves accuracy)</span>
        </label>
        <textarea
          id="jd"
          rows={5}
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          placeholder="Paste the job post or a few lines on responsibilities and must-have skills."
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
        <label className="mb-1 mt-4 block text-sm font-medium" htmlFor="ctx">
          4. About your company / team <span className="font-normal text-stone-400">(optional)</span>
        </label>
        <textarea
          id="ctx"
          rows={3}
          value={companyContext}
          onChange={(e) => setCompanyContext(e.target.value)}
          placeholder="e.g. 15-person startup, very fast pace, small team, they'll own features end to end, tight deadlines with clients."
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
      </Card>

      {error && <ErrorBox>{error}</ErrorBox>}

      <Button type="submit" disabled={busy} className="w-full py-3 text-base">
        {busy ? (
          <>
            <Spinner /> Uploading…
          </>
        ) : (
          "Analyse candidate"
        )}
      </Button>
    </form>
  );
}
