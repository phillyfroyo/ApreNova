# Chapter-Detection Fix — `<numeral>. ALLCAPS TITLE` headings (Sherlock Holmes)

> STATUS: ✅ IMPLEMENTED & VERIFIED (2026-05-31). See "What actually shipped"
> at the bottom — the real body-heading format differed from the initial
> hypothesis (ALL-CAPS with a frequently-dropped space, not Title Case), and
> a second change (bare-numeral suppression) was required.


## Problem (confirmed by running the real pipeline on the uploaded file)

"The Adventures of Sherlock Holmes" is 12 short stories with headings like:

```
I. A Scandal in Bohemia
II. The Red-Headed League
...
XII. The Adventure of the Copper Beeches
```

i.e. **Roman numeral + period + space + Title-Case title, all on one line.**

`detectChapterMarkers()` in `src/lib/text-processing/shared/chapter-detection.ts`
has three explicit patterns:

1. `^CHAPTER\s+(\d+|[IVXLC]+)...` — needs the literal word "CHAPTER"
2. `^([IVXLC]+)\.?$` — Roman numeral **alone** on a line (the `$` rejects a trailing title)
3. `^(BOOK|PART|CANTO|ACT|SCENE)\s*...`

**None of them match `I. A Scandal in Bohemia`.** So the 12 real story
headings are invisible. The only thing that *does* match is three bare
`I.` / `II.` / `III.` lines at lines 90/542/984 — the **internal section
dividers of the first story** ("A Scandal in Bohemia" is split into parts
I–III). The detector grabs those 3, hits `if (explicitMarkers.length > 0)
return explicitMarkers`, and never looks further → **3 "chapters," stories
2–12 absorbed into chapter 3.** Matches the reported symptom exactly.

Note: there is also a TOC at extracted lines 47–80 listing all 12 stories in
the identical `Roman. Title` format (3 lines apart, no body between). Any new
pattern WILL match those 12 TOC lines too, so TOC handling matters (below).

## Regression baseline (what currently works, and via which pattern)

Verified by running `detectChapterMarkers` on every stored prose test file:

| Book          | Heading format          | Pattern | Markers |
|---------------|-------------------------|---------|---------|
| Moby Dick     | `CHAPTER 1. Loomings.`  | 1       | 151     |
| Dracula       | `CHAPTER I`             | 1       | 27      |
| Frankenstein  | `Chapter 1`             | 1       | 24      |
| Gatsby        | `I`, `II` (bare)        | 2       | 9       |
| Tom Sawyer    | `CHAPTER I`             | 1       | 35      |
| Wizard of Oz  | `Chapter I`             | 1       | 24      |
| **Sherlock**  | `I. A Scandal in Bohemia` | none  | 3 (bug) |

**Critical constraint:** Gatsby's real chapters ARE bare `I`/`II` (Pattern 2).
So the fix must not change bare-numeral behavior, and must not make Moby
Dick's `CHAPTER 1. Loomings.` (Pattern 1, has the word CHAPTER) get
double-matched.

## Proposed fix

### Change 1 — add Pattern 2b: `Roman. Title` on one line

In `detectChapterMarkers`, **after** Pattern 1 (CHAPTER) and **before** the
bare-numeral Pattern 2, add a pattern for a Roman numeral + period + a
Title-Case (mixed-case) title on the same line:

```
^([IVXLC]+)\.\s+([A-Z][^\n]{2,80})$
```

Guards to avoid false positives:
- Require the part after the period to be **mixed case**, NOT all-caps —
  all-caps `I. LIFE.` is the *anthology thematic* pattern (Dickinson), which
  is handled separately upstream (`structureType === "anthology"` returns
  early before this code). Since we only reach here for non-anthology, an
  all-caps `I. SOMETHING` is unlikely, but requiring at least one lowercase
  letter in the title keeps us clear of thematic/section-header territory.
- Title length 3–80 chars (same spirit as the existing `hasTitle` check).
- Must NOT start with CHAPTER/BOOK/PART (already excluded by the earlier
  patterns `continue`-ing first).

This produces markers for BOTH the 12 TOC lines (47–80) AND any real
`Roman. Title` headings in the body. For Sherlock the body headings are the
same 12 — so we rely on TOC filtering (Change 2) to drop the front cluster.

Why this is safe for the table:
- Moby Dick / Dracula / Frankenstein / Tom Sawyer / Oz → matched by Pattern 1
  first (they contain "CHAPTER"/"Chapter"), `continue` before reaching 2b.
- Gatsby → bare `I`/`II`, no period+title, falls through 2b to Pattern 2
  unchanged.
- Sherlock → newly matched by 2b. ✓

### Change 2 — make TOC filtering catch the Sherlock shape

The current `filterOutTOCMarkers` has 3 strategies. The Sherlock TOC is 12
markers at lines 47–80 with **~0 chars between them** (titles only), followed
by the real story #1 starting deeper in the doc. The existing **Strategy 1
(duplicate-number detection)** should already handle this: the TOC has
markers numbered 1..12, and the body has markers numbered 1..12 again →
the first duplicate triggers, and because the TOC markers have <500 chars
between them, it filters to the first real (substantial-content) occurrence.

**Action:** verify Strategy 1 fires correctly once Change 1 produces the
duplicated 1..12 / 1..12 sequence. If it does, no filter change is needed.
If the body headings do NOT re-list (i.e. the TOC `Roman. Title` lines are
the ONLY occurrences and the bodies follow directly), then there's no
duplication and the 12 TOC lines ARE effectively the chapter starts — which
is actually fine (each "TOC" line is immediately followed by that story's
body). **This needs empirical confirmation on the extracted text** before
finalizing — see Verification.

### Change 3 — (only if needed) bare-numeral sub-section guard

If, after Change 1, the bare `I.`/`II.`/`III.` internal dividers of story #1
still get added as markers and pollute results, add a guard: when
`Roman. Title` markers (2b) exist, ignore bare-numeral (Pattern 2) markers
that fall *between* them (they're sub-sections, not chapters). Likely
unnecessary once 2b dominates, but noted as a contingency.

## Verification plan (before declaring done)

1. **Sherlock:** `detectChapterMarkers` → 12 markers, titles = the 12 story
   names; `processText` → 12 chapters each with real body content (not 0 chars).
2. **Regression — all 6 other classics:** re-run the marker survey; counts must
   stay exactly 151 / 27 / 24 / 9 / 35 / 24. Gatsby staying at 9 (bare numerals)
   is the most important check.
3. **Dickinson (anthology):** unchanged — it returns early on the anthology
   path; confirm still treated as thematic sections.
4. `tsc --noEmit` clean.
5. Re-run via the dev SU TP tool path (`processText`) to confirm the user-facing
   stats now show 12 chapters for Sherlock.

## Open question for Philip

The fix is mechanical and well-scoped. One judgment call: the new 2b pattern
keys on "Roman numeral + period + Title-Case title." Do we also want the
**Arabic** equivalent (`1. Title`, `2. Title`) in the same change? Some
collections number stories with arabic + title on one line. It's a one-line
addition but slightly widens the blast radius (arabic `1.` is more likely to
appear mid-prose, e.g. lists), so flagging rather than assuming.

---

## What actually shipped (post-implementation)

Running the real pipeline on the extracted text revealed the body-heading
format differed from the TOC, and from the initial hypothesis:

- **TOC (extracted lines 47–80):** `I. A Scandal in Bohemia` — period + space +
  **Title Case**. These have 0 chars between them (titles only) — a real TOC.
- **Body headings (lines 85, 1136, 2146, …):** `I.A SCANDAL IN BOHEMIA` —
  period + **(usually) NO space** + **ALL CAPS**. HTML extraction collapsed the
  space. These are the true chapter starts, each followed by a full story body.
- The bare `I.`/`II.`/`III.` at lines 90/542/984 are story 1's **internal**
  section dividers — what the old detector wrongly grabbed.

### Change 1 — Pattern 2b (titled heading), `chapter-detection.ts`
Added between Pattern 1 (CHAPTER) and Pattern 2 (bare numeral):
`/^([IVXLC]+|\d+)\.\s*(.+)$/` with guards: title must be ALL CAPS (no lowercase),
3–80 chars, ≥3 uppercase letters; numeral is Roman or Arabic 1–200. `\s*` (not
`\s+`) catches the no-space `I.A SCANDAL`. ALL-CAPS guard excludes the Title-Case
TOC, prose sentences starting "I. The…", and all-caps quotes beginning with
punctuation.

### Change 3 — bare-numeral suppression (was contingency, turned out necessary)
Bare-numeral Pattern 2 markers now collect into a separate `bareNumeralMarkers`
array. Merge rule at the end of `detectChapterMarkers`:
- titled/explicit markers exist → return those (sorted by line); bare numerals
  are internal sub-sections, dropped. (Sherlock.)
- no titled markers → bare numerals ARE the chapters, return them. (Gatsby.)

Change 2 (TOC filter) needed no edits — the TOC is removed upstream by HTML
extraction / front-matter handling, so only body headings reach detection.

### Verification (all green)
- Sherlock: **12 chapters**, titles correct, bodies 37K–53K chars each
  (was: 3 chapters, 0-char phantoms + a 539K blob).
- Regression, unchanged: Moby Dick 151, Dracula 27, Frankenstein 24,
  **Gatsby 9** (bare-numeral canary), Tom Sawyer 35, Oz 24.
- Dickinson anthology: 12 thematic sections (separate path), unchanged.
- `tsc --noEmit` clean.

### Decision taken
Roman **and** Arabic numerals supported in Pattern 2b (per Philip).
