// Usage: npm run check-ai
// Verifies your Gemini key works and lists the models it can use.
import { GoogleGenAI } from "@google/genai";

const key = process.env.GEMINI_API_KEY;
if (!key) {
  console.error("✗ GEMINI_API_KEY is not set. Add it to the .env file (get one free at https://aistudio.google.com/apikey).");
  process.exit(1);
}
const ai = new GoogleGenAI({ apiKey: key, httpOptions: { timeout: 120_000 } });
const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";

const names = [];
for await (const m of await ai.models.list()) {
  if (m.supportedActions?.includes("generateContent") && /gemini/.test(m.name ?? "")) names.push(m.name.replace("models/", ""));
}
console.log("Models your key can call (best ones usually contain 'pro' or the newest 'flash'):");
for (const n of names.sort()) console.log("  -", n);

console.log(`\nTesting "${model}" (free-tier calls can take ~30-60s)…`);
try {
  const r = await ai.models.generateContent({ model, contents: "Reply with exactly: OK" });
  console.log(`\n✓ Test call to "${model}" worked: ${r.text?.trim()}`);
} catch (e) {
  console.error(`\n✗ Test call to "${model}" failed: ${e.message}`);
  console.error("  Set GEMINI_MODEL in your .env file to one of the models above.");
  process.exit(1);
}
