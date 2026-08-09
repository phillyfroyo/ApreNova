// A/B harness: runs the SAME validated prompt (points.mjs) through gpt-4o and
// claude-sonnet-5, scores both with the SAME scorer (score.mjs), and writes a
// comparison report.
//
//   node dev/syllabus-matching/spike/ab-run.mjs [--pages 1,2,3,4] [--models both]
//
// Claude path uses prompt caching: the syllabus block (~1,800 tokens) is
// identical on every call, so it is split into its own cached content block.
// HANDOFF.md step 5 — cuts input cost ~90% after the first page.

import fs from "fs";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";

// .env has OPENAI_API_KEY; .env.local additionally has ANTHROPIC_API_KEY.
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { POINTS, POINT_IDS, SCHEMA, SYSTEM, buildUserMessage } from "./points.mjs";
import { score } from "./score.mjs";

const DIR = "dev/syllabus-matching/spike";
const lines = JSON.parse(fs.readFileSync(`${DIR}/ch1-l3.json`, "utf8"));

const argv = process.argv.slice(2);
const argOf = (flag, dflt) => {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const PAGES = argOf("--pages", "1,2,3,4").split(",").map(Number);
const WHICH = argOf("--models", "both");

const OPENAI_MODEL = "gpt-4o";
const CLAUDE_MODEL = "claude-sonnet-5";

/** The syllabus block is byte-identical across pages — the cacheable prefix. */
function syllabusBlock() {
  return `SYLLABUS GRAMMAR POINTS (B2, units 1-3). Each has a worked example showing exactly what to mark:

${POINTS.map((p) => `- ${p.id} [Unit ${p.unit}] ${p.name}\n    EXAMPLE: ${p.ex}`).join("\n")}`;
}

function pageBlock(page, pageLines) {
  const rendered = pageLines.map((l) => `LINE ${l.lineIndex}:\n${l.en}`).join("\n\n");
  return `STORY PAGE ${page} — The Adventures of Sherlock Holmes, ch1 (B1 level):

${rendered}`;
}

async function runOpenAI(pages) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const out = [];
  for (const page of pages) {
    const hit = cached(OPENAI_MODEL, page);
    if (hit) {
      console.error(`  [gpt-4o]  page ${page}: ${hit.matches.length} matches (cached)`);
      out.push(hit);
      continue;
    }
    const pageLines = lines.filter((l) => l.page === page);
    const t0 = Date.now();
    const resp = await client.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: buildUserMessage(page, pageLines) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "syllabus_matches", strict: true, schema: SCHEMA },
      },
    });
    const parsed = JSON.parse(resp.choices[0].message.content);
    const secs = (Date.now() - t0) / 1000;
    console.error(
      `  [gpt-4o]  page ${page}: ${parsed.matches.length} matches, ${secs.toFixed(1)}s, ` +
        `in ${resp.usage.prompt_tokens} out ${resp.usage.completion_tokens}`
    );
    const rec = { page, matches: parsed.matches, usage: resp.usage, seconds: secs };
    putCache(OPENAI_MODEL, page, rec);
    out.push(rec);
  }
  return out;
}

/** Per-page result cache so a mid-run connection drop doesn't discard finished pages. */
const CACHE = `${DIR}/.ab-cache`;
function cached(model, page) {
  const f = `${CACHE}/${model}-p${page}.json`;
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null;
}
function putCache(model, page, val) {
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(`${CACHE}/${model}-p${page}.json`, JSON.stringify(val));
}

async function runClaude(pages) {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    maxRetries: 4, // long streams occasionally drop; SDK retries with backoff
    timeout: 15 * 60 * 1000,
  });
  const out = [];
  for (const page of pages) {
    const hit = cached(CLAUDE_MODEL, page);
    if (hit) {
      console.error(`  [sonnet-5] page ${page}: ${hit.matches.length} matches (cached)`);
      out.push(hit);
      continue;
    }
    const pageLines = lines.filter((l) => l.page === page);
    const t0 = Date.now();
    // Claude emits 3-5x more matches per page than gpt-4o, so 16k truncates the
    // JSON mid-object. Stream at 64k: streaming is required at this max_tokens
    // to avoid SDK HTTP timeouts.
    const stream = client.messages.stream({
      model: CLAUDE_MODEL,
      max_tokens: 64000,
      // System carries the instructions AND the syllabus, both stable across
      // pages. The cache breakpoint on the last system block caches tools+system.
      system: [
        { type: "text", text: SYSTEM },
        {
          type: "text",
          text: syllabusBlock(),
          cache_control: { type: "ephemeral" },
        },
      ],
      // Only the page text varies — it sits after the breakpoint.
      messages: [{ role: "user", content: pageBlock(page, pageLines) }],
      // Structured output: same JSON Schema both models are held to.
      output_config: {
        format: { type: "json_schema", schema: SCHEMA },
      },
    });
    const resp = await stream.finalMessage();
    // A max_tokens stop truncates the JSON mid-object; fail loudly rather than
    // scoring a truncated page as a low match count.
    if (resp.stop_reason === "max_tokens") {
      throw new Error(
        `page ${page}: hit max_tokens (${resp.usage.output_tokens} out) — raise the ceiling`
      );
    }
    const textBlock = resp.content.find((b) => b.type === "text");
    const parsed = JSON.parse(textBlock.text);
    const secs = (Date.now() - t0) / 1000;
    const u = resp.usage;
    console.error(
      `  [sonnet-5] page ${page}: ${parsed.matches.length} matches, ${secs.toFixed(1)}s, ` +
        `in ${u.input_tokens} out ${u.output_tokens} ` +
        `cache(w ${u.cache_creation_input_tokens ?? 0} / r ${u.cache_read_input_tokens ?? 0})`
    );
    const rec = {
      page,
      matches: parsed.matches,
      usage: {
        prompt_tokens: u.input_tokens,
        completion_tokens: u.output_tokens,
        cache_creation_input_tokens: u.cache_creation_input_tokens ?? 0,
        cache_read_input_tokens: u.cache_read_input_tokens ?? 0,
      },
      seconds: secs,
      stop_reason: resp.stop_reason,
    };
    putCache(CLAUDE_MODEL, page, rec);
    out.push(rec);
  }
  return out;
}

function report(name, pages) {
  const s = score(pages, lines, POINT_IDS);
  const cacheRead = pages.reduce((a, p) => a + (p.usage.cache_read_input_tokens || 0), 0);
  const secs = pages.reduce((a, p) => a + p.seconds, 0);
  return { model: name, ...s, cacheReadTokens: cacheRead, totalSeconds: +secs.toFixed(1) };
}

async function main() {
  console.error(`A/B on pages [${PAGES.join(", ")}] — identical prompt, identical scorer\n`);
  const results = {};

  if (WHICH === "both" || WHICH === "openai") {
    console.error(`Running ${OPENAI_MODEL}...`);
    results.openai = await runOpenAI(PAGES);
  }
  if (WHICH === "both" || WHICH === "claude") {
    console.error(`\nRunning ${CLAUDE_MODEL}...`);
    results.claude = await runClaude(PAGES);
  }

  const summary = [];
  if (results.openai) summary.push(report(OPENAI_MODEL, results.openai));
  if (results.claude) summary.push(report(CLAUDE_MODEL, results.claude));

  fs.writeFileSync(
    `${DIR}/ab-results.json`,
    JSON.stringify({ pages: PAGES, summary, raw: results }, null, 1)
  );

  console.error("\n=== COMPARISON ===");
  const cols = [
    ["matches", (r) => r.total],
    ["anchored", (r) => `${r.anchored}/${r.total} (${r.anchorRate}%)`],
    ["high-conf", (r) => r.highConfidence],
    ["points covered", (r) => `${r.pointsCovered}/22`],
    ["avg span (tokens)", (r) => r.avgSpanTokens],
    ["bad pointId", (r) => r.badPointId],
    ["bad lineIndex", (r) => r.badLineIndex],
    ["input tokens", (r) => r.promptTokens],
    ["cached reads", (r) => r.cacheReadTokens],
    ["output tokens", (r) => r.completionTokens],
    ["seconds", (r) => r.totalSeconds],
  ];
  const pad = (s, n) => String(s).padEnd(n);
  console.error(pad("metric", 20) + summary.map((r) => pad(r.model, 22)).join(""));
  for (const [label, fn] of cols) {
    console.error(pad(label, 20) + summary.map((r) => pad(fn(r), 22)).join(""));
  }

  for (const r of summary) {
    if (r.failures.length) {
      console.error(`\n${r.model} anchor failures (${r.failures.length}):`);
      for (const f of r.failures.slice(0, 8)) {
        console.error(`  p${f.page} L${f.lineIndex} [${f.reason}] ${JSON.stringify(f.matchedText)}`);
      }
    }
  }
  console.error("\nwrote ab-results.json");
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
