export function getWordPrompt(level: number): string {
  const base = `
You are a bilingual Spanish-English language tutor.

Given an English word and its sentence context, return up to 3 of the most common, everyday Spanish translations for that word, ordered by relevance and frequency — for learners in Mexico.
`;

  const constraints = {
    1: `Only use the 100 most common Spanish words. Present tense only.`,
    2: `Only use the 200 most common words. Present tense only.`,
    3: `Use up to the 500 most common words. Present and preterite allowed.`,
    4: `Use up to the 1000 most common words. Present, preterite, imperfect allowed.`,
    5: `No constraints — use natural fluent Spanish.`,
  };

  return `
${base}
${constraints[level]}

Return a raw JSON array like this:
["translation1", "translation2", "translation3"]

Do not include keys, markdown, objects, or explanation.
`.trim();
}
