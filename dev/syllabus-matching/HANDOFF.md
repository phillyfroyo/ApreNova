# Syllabus Matching v1 — Design Handoff

**Branch:** `syllabus-matching-v1.0` (branched from `42981d7`, no code changes yet)
**Status:** Discovery/spike complete. No production code written. Ready to design schema + admin UI.
**Date:** 2026-08-07

---

## The feature

Teachers at Universidad Anáhuac CDMX (English classes, Spanish-native students) send their
syllabus. Admin uploads it, AI extracts grammar/vocab points, then AI reads a chapter and marks
every place a syllabus point is used. Students in that class see those spans highlighted while
reading; hover shows a card; a click can send the span to the existing story tutor.

**v1 scope:** no teacher portal (admin-side only), Sherlock ch1, grammar only, one level.
Pilot is ~5-6 teachers, different levels, different syllabi, this bimester.

---

## Four validated findings (real `gpt-4o` calls, real content)

### 1. Vocabulary matching does NOT work for this pairing — dropped from v1
Of the syllabus's 53 concrete vocab terms, **7 appear anywhere in the 6,765-word chapter**, and
all 7 are false positives in context:

| Term | Actual usage | Verdict |
|---|---|---|
| broke | "a fight **broke** out" | phrasal verb, not "penniless" |
| interest | "I was of **interest** to Holmes" | curiosity, not interest rate |
| pacing | "**pacing** and talking" | walking, not narrative pacing |
| character | "a man of strong **character**" | personality, not the Pop-Culture sense |
| expenses | "for current **expenses**?" | the one real hit |

Root cause is a **domain mismatch**: the syllabus is Personal Banking / Pop Culture /
Entrepreneurship; the story is Victorian detective fiction. Decision: **grammar-only for v1.**
Before promising a story to a teacher, run a story↔syllabus *fit check* — Gatsby would likely
score far better on Unit 1 vocab than Holmes.

### 2. The model CANNOT produce reliable word indices — do not ask it to
Asking for `wordIndices` gave **4/19 correct (21%)**. It claimed `"was always"` at `[4,7]`, which
actually resolves to `"was woman."`. It drifts worse on long paragraphs — which is what the
content is made of.

**Fix (validated):** remove indices from the schema entirely. Ask only for **verbatim story text**.
Compute indices in code by scanning the tokenized line for that string. Result: **43/43 (100%)**
anchored, zero hallucinations.

This also becomes the hallucination filter: a match whose text isn't found in the line is
*dropped*, never misplaced. Failure mode is "a highlight is missing," never "a highlight is on the
wrong words" — the right way for this to fail in a classroom.

> Normalization gotcha: the content uses **curly apostrophes** (`’`). Normalize `’ → '` plus
> case and punctuation, or real matches silently fail to anchor.

### 3. Worked examples in the prompt are what unlock the hard grammar points
v1 prompt (bare point names) found only the 4 easiest tenses. I verified against the chapter
directly: **65 lines contain reporting verbs, 27 contain passives, 23 contain conditionals.** They
were abundantly present — the prompt just wasn't looking.

Adding **one worked example per point**:

| | v1 (no examples) | v2 (worked examples) |
|---|---|---|
| Anchor fidelity | 4/19 (21%) | **43/43 (100%)** |
| Points covered | 5 / 22 | **12 / 22** |
| Total matches (2 pages) | 19 | 43 |

The newly-found hard points are *correct*: `"would have been burned"` (3rd conditional),
`"if a man comes"` (1st conditional), `"was buried"` / `"they were made"` (passive),
`"told me he was working again"` (reporting verb + object + clause), `"who hated"` (relative
pronoun), `"to himself"` (reflexive), `"As I passed"` (time clause).

### 4. Density is controllable by instruction; bad matches self-announce
Telling it "do NOT mark ordinary personal pronouns" cut the predicted function-word flood —
pronouns came back as 4 targeted marks, not hundreds. **~21 matches/page is readable.**

3 matches were wrong, and **the model flagged its own errors in the note field** (e.g. marked
`"girl"` as a pronoun with the note *"isn't actually a pronoun but a mistake"*). All 3 were
**medium** confidence, never high.

**Filter: keep `confidence === "high"`, and reject notes matching self-doubt language**
(`/isn't actually|not a|mistake|error|should have/i`). That removes all 3 bad matches, leaving
**35 high-confidence matches with only minor span-padding issues.** Reviewable quality.

---

## Architecture decisions (settled)

**Content lives in TypeScript modules, compiled into the build:**
`src/content/{slug}/{level}/ch{N}.ts`, loaded via dynamic `import()` in `src/lib/getStoryContent.ts:12-17`.
`stories-json/` is stale scratch — ignore it. Scale: **447 chapter files**; Sherlock is 13 chapters × 5 levels.

**Matches go in Postgres, NOT in the content files:**
1. Content files are build artifacts — writing matches there means a redeploy per highlight tweak.
2. Roster/class scoping is relational anyway.
3. Per-point toggles become `WHERE pointId IN (...)`, not a regeneration.

**Reader stays unchanged; overlay is strictly additive.** Page content loads as today; matches are
fetched separately for `(class, slug, level, chapter, page)`. Empty fetch ⇒ today's reader exactly.
That satisfies "non-pilot users see nothing" *by construction*, not by a conditional.

**Proposed record shape:**
```
{ storySlug, level, chapter, page, lineIndex,
  wordIndices: number[],     // computed server-side via re-anchoring
  matchedText: string,       // model's verbatim output = source of truth + drift checksum
  sentence: string,          // for the hover card (see "line = paragraph" below)
  syllabusPointId: FK,       // per-point toggles work retroactively
  confidence, note }
```
`wordIndices` as an **array** (not start/end) is required — grammar spans are genuinely
discontinuous, and one token can belong to several overlapping matches.

**Cost model — the key structural decision, still open:** if matches are computed against a
**stable superset** of grammar points that each semester's syllabus *selects from*, syllabus churn
costs **zero** recomputation (just toggle `pointId`s). If computed per-syllabus, every semester
re-runs the library. Strongly prefer the superset. Per-point toggles already give the mechanism.

---

## Reader internals (verified, with file:line)

- **Word-level rendering already exists.** `src/components/unified-translator/UnifiedTranslator.tsx:147-160`
  renders every token as `<button data-word-index={i}>`. Tokenization is
  `sentence.trimStart().split(" ")` (line 18-20) — **punctuation stays attached**
  (`Holmes,` `woman.` `wasn't`). Any matcher MUST tokenize identically or indices drift.
- **Tutor handoff is free.** `setTutorContext({ lineIndex, fullLine, selectedText })` + `openStoryTutor()`
  — see `src/components/story-reader/EmojiRow.tsx:75-82`. Exactly the contract this feature needs.
- **A "line" is a PARAGRAPH, up to 153 tokens** (ch1 l3 p1 L0). Not a sentence. So:
  - the hover card must show the **sentence**, not the line (hence `sentence` in the record);
  - the tutor handoff should send the sentence + point name, not a 153-word paragraph.
- **Selection model is contiguous** (`useWordSelection.ts` uses `start`/`end`). The syllabus overlay
  does its own highlighting, so `number[]` is fine — additive, not a refactor of translation logic.
- Ch1 l3: **32 pages, 256 lines, 6,765 words.**

---

## Deferred / explicitly out of scope for v1

- Vocabulary matching (finding 1)
- Mobile/tablet interaction — desktop hover only; later, add an icon to the existing word-icon row
- Teacher portal — teachers email syllabus + class list; admin does it manually
- Teacher feedback loop — word of mouth (they're colleagues)
- Overlap/nesting **UI** — data layer must support it now; visual design deferred
- Index drift: content edits shift stored indices silently. Mitigation = `matchedText` checksum
  validated on load; mismatch ⇒ hide the mark rather than misplace it.

---

## Artifacts (in `dev/syllabus-matching/spike/`)

| File | What |
|---|---|
| `extract.mjs` | Parses `src/content/.../ch1.ts` → flat `{page, lineIndex, en, es}` |
| `ch1-l3.json` | Extracted Sherlock ch1 level-3 text (32 pages, 256 lines) |
| `match-spike-v2.mjs` | **The validated prompt** — 22 points w/ worked examples, no indices requested |
| `spike-results.json` | v1 output (bad — kept for comparison) |
| `spike-v2-results.json` | v2 output (43 matches, 100% anchor) |
| `points.mjs` | **Prompt single source of truth** — points + schema + system, shared by both models |
| `score.mjs` | **Scorer** — reader-identical tokenization, apostrophe normalization, anchoring, high-conf filter |
| `ab-run.mjs` | A/B harness (gpt-4o vs claude-sonnet-5), prompt caching, per-page result cache |
| `ab-results.json` | A/B output + summary |

Run from repo root:
```
node dev/syllabus-matching/spike/match-spike-v2.mjs                      # original v2 spike
node dev/syllabus-matching/spike/ab-run.mjs --pages 1,2,3,4 --models both
```
Any prompt change goes in `points.mjs` only — never in a model-specific runner, or the A/B
stops being apples-to-apples.

**Provider note:** spike used `gpt-4o` because `match-spike-v2.mjs` loads only `.env`, which has
just `OPENAI_API_KEY`. **`ANTHROPIC_API_KEY` *is* available locally — it's in `.env.local`**
(the earlier "Vercel-only" note was wrong). Load both files and either provider works.
The spike tested *whether a model can do this*, not which model is best — see the A/B below.

---

### 5. Model A/B: `claude-sonnet-5` wins on coverage, loses on density (2026-08-07)

4 pages, byte-identical prompt (`spike/points.mjs`), identical scorer (`spike/score.mjs`).
The scorer was validated first by reproducing the hand-scored v2 numbers exactly (43/43, 12/22, 35 high).

| | gpt-4o | claude-sonnet-5 |
|---|---|---|
| Matches | 49 | **162** |
| Anchor rate | 47/49 (95.9%) | **161/162 (99.4%)** |
| High-confidence | 44 | 115 |
| Points covered (all) | 13/22 | **15/22** |
| Points covered (high-conf only) | 11/22 | **15/22** |
| Avg span | 3.96 tokens | **1.77 tokens** |
| Wall clock | 33.5s | 342s |
| Input tokens | 8,234 | 2,654 (+8,349 cached) |
| Output tokens | 4,070 | 43,177 |

**Claude finds the reporting-verb patterns gpt-4o misses entirely** — `u2-rv-clause`,
`u2-rv-do-clause`, `u2-rv-inf`, `u2-commands` are all high-confidence in Claude and absent
from gpt-4o. That was finding 3's open question (which of the 10 empty points are genuinely
absent vs. still being missed): **at least 4 were being missed, not absent.**

Claude's spans are also tighter (1.77 vs 3.96 tokens) — less of the "span padding" noted in finding 4.

**But density is now the problem, not coverage.** Claude averages **29 high-confidence
matches/page** (44/32/16/23) against the handoff's ~21/page readability bar; page 1 is 44.
gpt-4o averages 11. Before the full run, retune the density instruction for Claude —
the prompt's "do NOT mark ordinary personal pronouns" lever already proved density is
instruction-controllable.

**Prompt caching works** (step 5 done): 2,783-token syllabus block written once, read on every
later page. Claude's input cost is ~⅓ of gpt-4o's despite the larger output.

**Recommendation: `claude-sonnet-5`, after a density-retuning pass.** Its failure mode
(too many correct marks) is fixable by prompt; gpt-4o's (whole grammar points invisible)
is not. Speed is irrelevant for a batch admin job — 32 pages ≈ 45 min.

---

## Next steps (in order)

1. **Retune density for Claude, then run the full 32-page chapter.** Target ~21 high-conf
   matches/page. Use `ab-run.mjs` — it caches per page in `spike/.ab-cache/`, so a dropped
   stream costs one page, not the run. Set `max_tokens` ≥ 64k and stream: Claude emits
   ~10k output tokens/page and silently truncated mid-JSON at 16k.
2. ~~Check the **10 points that returned nothing**.~~ **Partly answered by the A/B (finding 5).**
   Commands and 3 reporting-verb patterns were *being missed*, not absent — Claude finds them.
   Still unconfirmed: `u2-rv-ing`, `u2-rv-prep-ing`, `u2-rv-do-prep-ing`, `u3-alt-if`,
   `u3-inverted-cond` (inverted conditionals confirmed 0 in chapter). Re-check against the
   full 32-page Claude run.
3. Design **schema + admin review modal** against that real dataset (reuse the admin upload modal
   design language per the original ask).
4. Decide **superset vs per-syllabus** point model (cost structure, above).
5. Add **prompt caching** — the ~1,800-token syllabus block is identical across every call (~90%
   input cost cut).

## Open questions for Philip

- ~~Superset vs per-syllabus grammar points?~~ **Decided 2026-08-07: stable superset.**
  Schema gets a `GrammarPoint` table + a syllabus↔point join; syllabus churn is a toggle, not a
  recompute.
- ~~A/B Claude vs GPT-4o?~~ **Done — see finding 5. `claude-sonnet-5`, pending density retune.**
- Which story/chapter/level combination do the pilot teachers actually commit to? *(still open —
  blocks nothing right now, but decides which chapters get the first real run)*
- What is the right density target? ~21/page was eyeballed from the v2 sample, not validated with
  a teacher. Worth confirming with one pilot teacher before tuning the prompt to hit it.
