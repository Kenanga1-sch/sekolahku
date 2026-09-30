#!/usr/bin/env node
// Thin wrapper around Kenari's System One endpoint (Jev).
// Usage:
//   KENARI_API_KEY=kn-... node scripts/jev.mjs <request.json>
//   cat request.json | KENARI_API_KEY=kn-... node scripts/jev.mjs
// Request JSON: { model?, state, questions } — same contract as TypeSafe System One.
// Prints the answers JSON to stdout; appends a log line to /tmp/opencode/jev-log.jsonl.

import { readFileSync, appendFileSync } from "node:fs";
import { createHash } from "node:crypto";

const ENDPOINT = process.env.KENARI_BASE_URL
  ? `${process.env.KENARI_BASE_URL.replace(/\/$/, "")}/v1/systemone`
  : "https://kenari.id/v1/systemone";
const KEY = process.env.KENARI_API_KEY;
const MODEL = process.env.KENARI_MODEL || "jev-1-13-free";
const LOG = process.env.JEV_LOG || "/tmp/opencode/jev-log.jsonl";

if (!KEY) {
  console.error("KENARI_API_KEY belum diset.");
  process.exit(2);
}

const arg = process.argv[2];
const raw = arg ? readFileSync(arg, "utf8") : readFileSync(0, "utf8");

let body;
try {
  body = JSON.parse(raw);
} catch (e) {
  console.error("Request bukan JSON valid:", e.message);
  process.exit(2);
}
if (!body.state || !body.questions) {
  console.error("Request harus punya 'state' dan 'questions'.");
  process.exit(2);
}
body.model = body.model || MODEL;

const started = Date.now();
const res = await fetch(ENDPOINT, {
  method: "POST",
  headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const text = await res.text();
let json;
try {
  json = JSON.parse(text);
} catch {
  json = { raw: text };
}

const ms = Date.now() - started;
console.log(JSON.stringify(json, null, 2));

try {
  appendFileSync(
    LOG,
    JSON.stringify({
      ts: new Date().toISOString(),
      ms,
      status: res.status,
      model: json.model || body.model,
      state_sha: createHash("sha256").update(JSON.stringify(body.state)).digest("hex").slice(0, 12),
      questions: Object.keys(body.questions),
      answers: json.answers || null,
      usage: json.usage || null,
    }) + "\n",
  );
} catch {
  /* logging is best-effort */
}

process.exit(res.ok ? 0 : 1);
