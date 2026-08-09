// Spike v2: example-driven prompt, single pass, no token indices requested.
// Model returns exact story strings; we compute indices algorithmically.
import fs from "fs";
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config({ path: ".env" });

const DIR = "dev/syllabus-matching/spike";
const lines = JSON.parse(fs.readFileSync(`${DIR}/ch1-l3.json`, "utf8"));

// Each point carries a worked example drawn from THIS chapter (or a minimal
// canonical one where the chapter's instance is on a page we're not testing).
const POINTS = [
  { id: "u1-active-passive", unit: 1, name: "Active vs Passive verb forms",
    ex: `"He was buried in his books" -> mark "was buried". Passive: subject receives the action. Do NOT mark active past tenses here.` },
  { id: "u1-tenses-time-clauses", unit: 1, name: "Identifying tenses in time clauses",
    ex: `"As I passed the familiar door, I felt a strong desire" -> mark "As I passed". Time clause introduced by as/when/while/before/after.` },
  { id: "u1-pronouns", unit: 1, name: "Pronouns: personal, reflexive, indefinite, reciprocal, relative",
    ex: `"He laughed to himself" -> mark "himself" (reflexive). "Holmes, who hated all forms of society" -> mark "who" (relative). Mark ONLY reflexive, relative, indefinite and reciprocal pronouns. Do NOT mark ordinary personal pronouns (I, he, she, it) — they are everywhere and carry no teaching value here.` },
  { id: "u1-determiners", unit: 1, name: "Articles, quantifiers, demonstratives, distributives, some/any, too/enough",
    ex: `"this is too much" -> mark "too much". Mark only teachable instances: too/enough, some/any contrasts, quantifiers, demonstratives. Do NOT mark every "the" or "a".` },
  { id: "u2-reported-speech", unit: 2, name: "Reported speech",
    ex: `"his manner told me he was working again" -> mark "told me he was working". Backshifted reported clause.` },
  { id: "u2-present-simple", unit: 2, name: "Present Simple",
    ex: `"it always seems so simple" -> mark "seems".` },
  { id: "u2-present-continuous", unit: 2, name: "Present Continuous",
    ex: `"you are practicing again" -> mark "are practicing".` },
  { id: "u2-present-perfect", unit: 2, name: "Present Perfect Simple",
    ex: `"the world has seen" -> mark "has seen". NOTE: "had given up" is PAST perfect, not present perfect — do not mark it here.` },
  { id: "u2-past-simple", unit: 2, name: "Past Simple",
    ex: `"I rarely heard him call her" -> mark "heard". Mark the verb only, not surrounding adverbs or objects.` },
  { id: "u2-modals", unit: 2, name: "Modals (can>could, will>would, may>might, should)",
    ex: `"I could do it myself" -> mark "could do".` },
  { id: "u2-commands", unit: 2, name: "Commands and instructions",
    ex: `Imperative verb forms addressed to someone, e.g. "Come in", "Look at this". Mark the imperative verb.` },
  { id: "u2-rv-clause", unit: 2, name: "Reporting verb + clause",
    ex: `"he said that it was simple" -> mark "said that it was simple". Reporting verb followed directly by a clause.` },
  { id: "u2-rv-do-clause", unit: 2, name: "Reporting verb + direct object + clause",
    ex: `"his manner told me he was working again" -> mark "told me he was working again". Reporting verb + object (me) + clause.` },
  { id: "u2-rv-inf", unit: 2, name: "Reporting verb + infinitive",
    ex: `"He promised to return" -> mark "promised to return".` },
  { id: "u2-rv-do-inf", unit: 2, name: "Reporting verb + direct object + infinitive",
    ex: `"He asked me to wait" -> mark "asked me to wait".` },
  { id: "u2-rv-ing", unit: 2, name: "Reporting verb + verb+ing",
    ex: `"He suggested leaving early" -> mark "suggested leaving".` },
  { id: "u2-rv-prep-ing", unit: 2, name: "Reporting verb + preposition + verb+ing",
    ex: `"He insisted on paying" -> mark "insisted on paying".` },
  { id: "u2-rv-do-prep-ing", unit: 2, name: "Reporting verb + direct object + preposition + verb+ing",
    ex: `"He congratulated me on winning" -> mark "congratulated me on winning".` },
  { id: "u3-conditionals", unit: 3, name: "Real, unreal and mixed conditionals",
    ex: `"You would have been burned as a witch a few centuries ago" -> mark "would have been burned" (third conditional, implied if-clause). "if a man comes into my rooms ... I must be very dull" -> mark "if a man comes" (first conditional).` },
  { id: "u3-alt-if", unit: 3, name: "Alternatives to 'if' in conditionals",
    ex: `"provided that you agree", "as long as he stays", "unless you object" -> mark the connector plus its clause opening.` },
  { id: "u3-inverted-cond", unit: 3, name: "Conditionals without if (inverted conditionals)",
    ex: `"Had I known, I would have gone" -> mark "Had I known". Inversion replacing if.` },
  { id: "u3-word-building", unit: 3, name: "Word building: prefixes and suffixes",
    ex: `"unpleasant" -> mark "unpleasant" (un- prefix). "questionable" -> mark "questionable" (-able suffix). Mark words whose meaning is built from a visible prefix or suffix.` },
];

const SCHEMA = {
  type: "object", additionalProperties: false, required: ["matches"],
  properties: {
    matches: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["lineIndex", "matchedText", "sentence", "pointId", "confidence", "note"],
        properties: {
          lineIndex: { type: "integer" },
          matchedText: { type: "string" },
          sentence: { type: "string" },
          pointId: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          note: { type: "string" },
        },
      },
    },
  },
};

const SYSTEM = `You mark instances of syllabus grammar points in an English story for Spanish-speaking students (B2 course, B1-level text). Your output is reviewed by the teacher, then shown to students as highlights in a reading app.

You are given story lines. Each line is a PARAGRAPH and may contain many sentences.

For each genuine instance of a listed grammar point, emit a match with:
- lineIndex: the LINE number the instance appears in
- matchedText: the exact substring of that line covered by the construction, copied VERBATIM including punctuation and capitalization exactly as it appears. Copy character-for-character. Do not paraphrase, normalize, reorder or clean it up.
- sentence: the full sentence containing it, copied verbatim from the line
- pointId, confidence (high/medium/low), note (one short sentence useful to a student about THIS instance)

CRITICAL RULES:
1. matchedText must appear EXACTLY in the line, character for character. If you cannot copy it exactly, do not emit the match.
2. Mark the construction itself, tightly. Do not pad the span with adverbs, objects or articles that are not part of the grammar point.
3. Work through EVERY point in the list, including the reporting-verb patterns, conditionals, passives and word-building. These are the points the course cares most about. Do not stop after the easy tenses.
4. Accuracy over volume: only mark a point if the construction genuinely is that point. A past perfect is not a present perfect. A past participle in a reduced clause is not a past simple.
5. A sentence may contain several different points. Emit one match per point.
6. If a point genuinely does not occur, emit nothing for it.`;

async function run() {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const all = [];
  for (const page of [1, 2]) {
    const pageLines = lines.filter((l) => l.page === page);
    const rendered = pageLines.map((l) => `LINE ${l.lineIndex}:\n${l.en}`).join("\n\n");
    const userMsg = `SYLLABUS GRAMMAR POINTS (B2, units 1-3). Each has a worked example showing exactly what to mark:

${POINTS.map((p) => `- ${p.id} [Unit ${p.unit}] ${p.name}\n    EXAMPLE: ${p.ex}`).join("\n")}

STORY PAGE ${page} — The Adventures of Sherlock Holmes, ch1 (B1 level):

${rendered}`;

    console.error(`  -> page ${page}: calling model...`);
    const t0 = Date.now();
    const resp = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "system", content: SYSTEM }, { role: "user", content: userMsg }],
      response_format: { type: "json_schema", json_schema: { name: "syllabus_matches", strict: true, schema: SCHEMA } },
    });
    const parsed = JSON.parse(resp.choices[0].message.content);
    console.error(`     ${parsed.matches.length} matches, ${((Date.now() - t0) / 1000).toFixed(1)}s, tokens ${resp.usage.prompt_tokens}/${resp.usage.completion_tokens}`);
    all.push({ page, matches: parsed.matches, usage: resp.usage });
  }
  fs.writeFileSync(`${DIR}/spike-v2-results.json`, JSON.stringify(all, null, 1));
  console.error("wrote spike-v2-results.json");
}
run().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
