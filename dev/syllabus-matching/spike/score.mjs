// Shared scorer for the model A/B. Both models are judged by these exact rules,
// so differences in the report are differences in the models, not the measurement.
//
// Encodes three validated decisions from HANDOFF.md:
//   - anchoring is done in CODE from verbatim matchedText (finding 2)
//   - tokenization must match the reader's, punctuation attached (reader internals)
//   - keep confidence === "high" and reject self-doubt notes (finding 4)

/** Reader tokenization: UnifiedTranslator.tsx:18-20 — punctuation stays attached. */
export function tokenize(line) {
  return line.trimStart().split(" ");
}

/** Curly apostrophes/quotes and dashes are the documented anchoring gotcha. */
export function normalize(s) {
  return s
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .toLowerCase()
    .replace(/[^a-z0-9' ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export const SELF_DOUBT = /isn't actually|is not actually|not a |mistake|error|should have|incorrect|not really/i;

/**
 * Anchors matchedText to token indices within a line.
 * Returns number[] (possibly multi-token) or null if it cannot be anchored.
 * Never guesses: failure to anchor drops the match rather than misplacing it.
 */
export function anchor(line, matchedText) {
  const tokens = tokenize(line);
  const normTokens = tokens.map(normalize);
  const target = normalize(matchedText);
  if (!target) return null;
  const targetWords = target.split(" ").filter(Boolean);
  if (!targetWords.length) return null;

  // Sliding window over token indices; tolerate tokens that normalize to "".
  for (let start = 0; start < normTokens.length; start++) {
    if (!normTokens[start]) continue;
    const picked = [];
    let wi = 0;
    let ti = start;
    while (ti < normTokens.length && wi < targetWords.length) {
      const tok = normTokens[ti];
      if (!tok) { ti++; continue; }
      if (tok === targetWords[wi]) { picked.push(ti); wi++; ti++; continue; }
      // token may fuse several target words (rare) or vice versa
      if (tok.startsWith(targetWords[wi]) && picked.length === 0) { picked.push(ti); wi++; ti++; continue; }
      break;
    }
    if (wi === targetWords.length) return picked;
  }
  // Fallback: contiguous substring of the joined line (handles intra-token spans)
  const joined = normTokens.join(" ");
  if (joined.includes(target)) {
    const before = joined.slice(0, joined.indexOf(target)).split(" ").filter(Boolean).length;
    const span = targetWords.length;
    return Array.from({ length: span }, (_, k) => before + k);
  }
  return null;
}

/** Applies the quality filter from finding 4. */
export function passesFilter(m) {
  return m.confidence === "high" && !SELF_DOUBT.test(m.note || "");
}

/**
 * Scores one model's raw output against the source lines.
 * @param {Array} pages  [{page, matches:[...], usage}]
 * @param {Array} lines  [{page, lineIndex, en, es}]
 */
export function score(pages, lines, pointIds) {
  const byKey = new Map(lines.map((l) => [`${l.page}:${l.lineIndex}`, l.en]));
  let total = 0, anchored = 0, unanchored = 0, badPoint = 0, badLine = 0;
  let highTotal = 0, highAnchored = 0, filteredOut = 0;
  const pointsCovered = new Set();
  const pointsCoveredHigh = new Set();
  const failures = [];
  const spanLengths = [];
  const perPage = [];
  let promptTokens = 0, completionTokens = 0;

  for (const p of pages) {
    let pageAnchored = 0;
    for (const m of p.matches) {
      total++;
      if (!pointIds.has(m.pointId)) { badPoint++; }
      const line = byKey.get(`${p.page}:${m.lineIndex}`);
      if (line === undefined) {
        badLine++;
        failures.push({ page: p.page, reason: "lineIndex not on page", lineIndex: m.lineIndex, matchedText: m.matchedText });
        continue;
      }
      const idx = anchor(line, m.matchedText);
      const isHigh = passesFilter(m);
      if (isHigh) highTotal++; else filteredOut++;
      if (idx && idx.length) {
        anchored++;
        pageAnchored++;
        spanLengths.push(idx.length);
        pointsCovered.add(m.pointId);
        if (isHigh) { highAnchored++; pointsCoveredHigh.add(m.pointId); }
      } else {
        unanchored++;
        failures.push({ page: p.page, reason: "not found in line", lineIndex: m.lineIndex, matchedText: m.matchedText });
      }
    }
    perPage.push({ page: p.page, matches: p.matches.length, anchored: pageAnchored });
    if (p.usage) {
      promptTokens += p.usage.prompt_tokens || p.usage.input_tokens || 0;
      completionTokens += p.usage.completion_tokens || p.usage.output_tokens || 0;
    }
  }

  return {
    total,
    anchored,
    unanchored,
    anchorRate: total ? +(anchored / total * 100).toFixed(1) : 0,
    badPointId: badPoint,
    badLineIndex: badLine,
    highConfidence: highTotal,
    highAnchored,
    filteredOut,
    pointsCovered: pointsCovered.size,
    pointsCoveredHigh: pointsCoveredHigh.size,
    pointsCoveredList: [...pointsCovered].sort(),
    avgSpanTokens: spanLengths.length ? +(spanLengths.reduce((a, b) => a + b, 0) / spanLengths.length).toFixed(2) : 0,
    perPage,
    promptTokens,
    completionTokens,
    failures,
  };
}
