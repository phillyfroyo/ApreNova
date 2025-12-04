// src/lib/admin/cefr-prompts.ts

export interface CEFRLevel {
  level: number;
  cefr: string;
  name: string;
  targetReader: string;
  sentenceLength: string;
  vocabularySize: string;
  allowed: string[];
  forbidden: string[];
  englishGrammar: string[];
  spanishGrammar: string[];
  examples: { en: string; es: string };
}

/**
 * Sharply defined CEFR levels with clear boundaries.
 * Each level specifies exactly what IS and ISN'T allowed.
 */
export const CEFR_LEVELS: Record<number, CEFRLevel> = {
  1: {
    level: 1,
    cefr: "A1",
    name: "Beginner",
    targetReader: "First-week language learner with ~500 word vocabulary",
    sentenceLength: "3-7 words per sentence",
    vocabularySize: "500 most common words only",
    allowed: [
      "Simple present tense only (I walk, she eats)",
      "Basic pronouns: I, you, he, she, it, we, they",
      "Common nouns: family, food, colors, numbers 1-20, days, basic animals",
      "Basic verbs: be, have, go, eat, drink, see, like, want, need",
      "Simple adjectives: big, small, good, bad, happy, sad, hot, cold",
      "Basic connectors: and, but",
      "Questions with: what, where, who (simple)",
    ],
    forbidden: [
      "NO past tense",
      "NO future tense",
      "NO perfect tenses",
      "NO passive voice",
      "NO conditionals",
      "NO relative clauses (who, which, that)",
      "NO idioms or figurative language",
      "NO abstract nouns (happiness, freedom, etc.)",
      "NO subordinate clauses",
      "NO adverbs except: very, now, today",
    ],
    englishGrammar: [
      "Subject + verb + object (I eat food)",
      "Subject + be + adjective (She is happy)",
      "There is/are for existence",
      "This/that, these/those for pointing",
    ],
    spanishGrammar: [
      "Present indicative only (-ar, -er, -ir regular verbs)",
      "Ser/estar in present only",
      "Hay for existence",
      "Gender agreement (el/la, -o/-a)",
    ],
    examples: {
      en: "I have a cat. The cat is small. It is black. I like my cat.",
      es: "Tengo un gato. El gato es pequeño. Es negro. Me gusta mi gato.",
    },
  },
  2: {
    level: 2,
    cefr: "A2",
    name: "Elementary",
    targetReader: "3-6 month learner with ~1,000 word vocabulary",
    sentenceLength: "6-10 words per sentence",
    vocabularySize: "1,000 most common words",
    allowed: [
      "Simple present and simple past tense",
      "Present continuous (is walking, are eating)",
      "Going to for near future",
      "Common irregular past forms (went, ate, saw, had)",
      "Basic connectors: and, but, because, so, then",
      "Time words: yesterday, tomorrow, last week, next week",
      "Frequency adverbs: always, sometimes, never, often",
      "Comparative adjectives: bigger, smaller, better",
    ],
    forbidden: [
      "NO present perfect",
      "NO past perfect",
      "NO will future (use 'going to' instead)",
      "NO passive voice",
      "NO conditionals (if...would)",
      "NO complex relative clauses",
      "NO subjunctive",
      "NO abstract concepts",
      "NO idioms (except very common: 'break a leg' type)",
    ],
    englishGrammar: [
      "Simple past: I walked, she ate, they went",
      "Present continuous: I am walking, she is eating",
      "Going to future: I am going to eat",
      "Object pronouns: me, him, her, us, them",
      "Possessives: my, your, his, her, mine, yours",
    ],
    spanishGrammar: [
      "Preterite (pretérito indefinido): caminé, comió, fueron",
      "Present progressive: estoy caminando",
      "Ir + a + infinitive for future: voy a comer",
      "Direct object pronouns: lo, la, los, las",
      "Reflexive verbs basic: me llamo, se levanta",
    ],
    examples: {
      en: "Yesterday I went to the park. I saw my friend there. We played together. It was fun because the weather was nice.",
      es: "Ayer fui al parque. Vi a mi amigo allí. Jugamos juntos. Fue divertido porque el tiempo estaba bueno.",
    },
  },
  3: {
    level: 3,
    cefr: "B1",
    name: "Intermediate",
    targetReader: "1-2 year learner with ~2,500 word vocabulary",
    sentenceLength: "8-15 words per sentence",
    vocabularySize: "2,500 words including some abstract terms",
    allowed: [
      "All simple tenses (present, past, future with 'will')",
      "Present perfect for recent/relevant past",
      "Basic conditionals (if + present, will + verb)",
      "Modal verbs: can, could, should, must, might, may",
      "Relative clauses with who, which, that",
      "Compound sentences with multiple clauses",
      "Common idioms and expressions",
      "Abstract nouns: happiness, freedom, success",
      "Connectors: however, although, while, unless",
    ],
    forbidden: [
      "NO past perfect (had + past participle)",
      "NO third conditional (if had... would have)",
      "NO passive voice in complex tenses",
      "NO subjunctive (except basic Spanish)",
      "NO literary/poetic language",
      "NO rare vocabulary or archaic words",
      "NO very long complex sentences (>20 words)",
    ],
    englishGrammar: [
      "Present perfect: I have seen, she has eaten",
      "Will future: I will go, she will help",
      "First conditional: If it rains, I will stay home",
      "Relative clauses: The man who lives here...",
      "Modal perfects avoided (would have, could have)",
    ],
    spanishGrammar: [
      "Present perfect: he visto, ha comido",
      "Simple future: iré, comerá",
      "Conditional basic: iría, comería",
      "Imperfect vs preterite: era/fue, estaba/estuvo",
      "Basic subjunctive after querer que, esperar que",
      "Indirect object pronouns: me, te, le, nos, les",
    ],
    examples: {
      en: "I have lived in this city for three years. Although I miss my hometown sometimes, I enjoy the opportunities here. If I save enough money, I will visit my family next summer.",
      es: "He vivido en esta ciudad por tres años. Aunque a veces extraño mi pueblo, disfruto las oportunidades aquí. Si ahorro suficiente dinero, visitaré a mi familia el próximo verano.",
    },
  },
  4: {
    level: 4,
    cefr: "B2",
    name: "Upper Intermediate",
    targetReader: "2-4 year learner with ~5,000 word vocabulary",
    sentenceLength: "10-20 words per sentence, varied rhythm",
    vocabularySize: "5,000 words including nuanced vocabulary",
    allowed: [
      "All tenses including past perfect",
      "Second conditional (if + past, would + verb)",
      "Passive voice in all common tenses",
      "Subjunctive mood (basic uses)",
      "Nuanced vocabulary with near-synonyms",
      "Idiomatic expressions freely",
      "Abstract and philosophical concepts",
      "Complex sentence structures with multiple clauses",
      "Discourse markers: nevertheless, furthermore, in contrast",
    ],
    forbidden: [
      "NO third conditional (if had... would have) - save for L5",
      "NO obscure literary vocabulary",
      "NO archaic constructions",
      "NO dialect-specific expressions",
      "NO very rare subjunctive uses",
    ],
    englishGrammar: [
      "Past perfect: I had eaten before she arrived",
      "Second conditional: If I were rich, I would travel",
      "Passive voice: The book was written by...",
      "Reported speech: She said that she had...",
      "Wish + past: I wish I knew the answer",
    ],
    spanishGrammar: [
      "Past perfect: había comido antes de que llegara",
      "Conditional perfect: habría ido si...",
      "Subjunctive in noun clauses: Dudo que sea verdad",
      "Subjunctive in adjective clauses: Busco alguien que sepa",
      "Subjunctive with emotions: Me alegra que vengas",
      "Passive with ser: El libro fue escrito por...",
    ],
    examples: {
      en: "Had I known about the consequences, I would have made a different decision. Nevertheless, the experience taught me valuable lessons that I might not have learned otherwise.",
      es: "Si hubiera sabido las consecuencias, habría tomado una decisión diferente. Sin embargo, la experiencia me enseñó lecciones valiosas que quizás no habría aprendido de otra manera.",
    },
  },
  5: {
    level: 5,
    cefr: "C1/C2",
    name: "Advanced",
    targetReader: "4+ year learner or heritage speaker with ~10,000+ word vocabulary",
    sentenceLength: "No restrictions - native-like variation",
    vocabularySize: "10,000+ words, including literary and specialized terms",
    allowed: [
      "All grammatical structures without restriction",
      "Third conditional and mixed conditionals",
      "All subjunctive uses including hypotheticals",
      "Literary devices: metaphor, simile, irony, allusion",
      "Sophisticated vocabulary and register shifts",
      "Cultural references and wordplay",
      "Complex embedded clauses",
      "Ellipsis and implied meaning",
      "Rhetorical devices and persuasive language",
    ],
    forbidden: [
      "Nothing forbidden - full native expression",
    ],
    englishGrammar: [
      "Third conditional: If I had known, I would have acted",
      "Mixed conditionals: If I had studied, I would be fluent now",
      "Inverted conditionals: Had I known, Were it not for...",
      "Cleft sentences: It was John who..., What I mean is...",
      "All perfect aspects: will have been doing",
    ],
    spanishGrammar: [
      "Pluperfect subjunctive: si hubiera sabido",
      "Future perfect: habré terminado para entonces",
      "Advanced subjunctive: como si fuera, aunque hubiera",
      "Literary past (pretérito anterior): hubo terminado",
      "Vosotros forms (Spain) if appropriate",
      "Regional expressions where fitting",
    ],
    examples: {
      en: "Were it not for the serendipitous encounter that autumn afternoon, I might never have discovered the passion that would come to define the subsequent chapters of my existence—a reminder that fate often masquerades as coincidence.",
      es: "De no haber sido por aquel encuentro fortuito aquella tarde de otoño, quizás nunca habría descubierto la pasión que llegaría a definir los capítulos subsiguientes de mi existencia—un recordatorio de que el destino suele disfrazarse de coincidencia.",
    },
  },
};

/**
 * Generate a prompt for rewriting text at a specific CEFR level
 */
export function generateRewritePrompt(
  targetLevel: number,
  sourceText: string,
  sourceLanguage: "en" | "es"
): string {
  const level = CEFR_LEVELS[targetLevel];
  const langName = sourceLanguage === "es" ? "Spanish" : "English";
  const grammarRules = sourceLanguage === "es" ? level.spanishGrammar : level.englishGrammar;

  return `You are a CEFR-specialized content writer. Rewrite this ${langName} story for level ${level.cefr} (${level.name}).

TARGET READER: ${level.targetReader}

SENTENCE LENGTH: ${level.sentenceLength}

VOCABULARY: ${level.vocabularySize}

ALLOWED at this level:
${level.allowed.map(item => `✓ ${item}`).join("\n")}

FORBIDDEN at this level (DO NOT USE):
${level.forbidden.map(item => `✗ ${item}`).join("\n")}

${langName.toUpperCase()} GRAMMAR RULES:
${grammarRules.map(item => `• ${item}`).join("\n")}

EXAMPLE of Level ${level.level} ${langName}:
"${sourceLanguage === "es" ? level.examples.es : level.examples.en}"

REWRITING RULES:
1. Preserve the EXACT story meaning, plot, and all character names
2. Keep approximately the same number of lines (±2 lines)
3. Each line should be one complete thought/sentence
4. STRICTLY follow the allowed/forbidden grammar rules above
5. Use ONLY vocabulary appropriate for this level

SOURCE TEXT TO REWRITE:
"""
${sourceText}
"""

Return ONLY the rewritten ${langName} text. No explanations, notes, or commentary.`;
}

/**
 * Generate a prompt for translating text while maintaining level-appropriate language
 */
export function generateTranslationPrompt(
  text: string,
  fromLang: "en" | "es",
  level: number
): string {
  const toLangName = fromLang === "en" ? "Spanish" : "English";
  const fromLangName = fromLang === "en" ? "English" : "Spanish";
  const cefrLevel = CEFR_LEVELS[level];
  const targetGrammar = fromLang === "en" ? cefrLevel.spanishGrammar : cefrLevel.englishGrammar;

  return `Translate this ${fromLangName} text to ${toLangName}, maintaining CEFR level ${cefrLevel.cefr} (${cefrLevel.name}).

TARGET READER: ${cefrLevel.targetReader}

VOCABULARY: ${cefrLevel.vocabularySize}

${toLangName.toUpperCase()} GRAMMAR TO USE:
${targetGrammar.map(item => `• ${item}`).join("\n")}

FORBIDDEN (DO NOT USE in translation):
${cefrLevel.forbidden.map(item => `✗ ${item}`).join("\n")}

EXAMPLE of Level ${level} ${toLangName}:
"${fromLang === "en" ? cefrLevel.examples.es : cefrLevel.examples.en}"

TRANSLATION RULES:
1. Translate line-by-line, maintaining the exact same number of lines
2. Preserve the meaning exactly - do not simplify or embellish
3. Use grammar appropriate for level ${level} in ${toLangName}
4. Each translated line should match its source line in meaning

SOURCE ${fromLangName.toUpperCase()} TEXT:
"""
${text}
"""

Return ONLY the ${toLangName} translation, one line per source line. No notes or explanations.`;
}

/**
 * Generate a prompt for detecting the CEFR level of text
 */
export function generateDetectionPrompt(
  text: string,
  language: "en" | "es"
): string {
  const langName = language === "es" ? "Spanish" : "English";

  // Build level reference for the AI
  const levelReference = Object.values(CEFR_LEVELS).map(l =>
    `Level ${l.level} (${l.cefr}): ${l.sentenceLength}, ${l.vocabularySize}, grammar includes: ${(language === "es" ? l.spanishGrammar : l.englishGrammar).slice(0, 2).join(", ")}`
  ).join("\n");

  return `Analyze this ${langName} text and determine its CEFR level.

LEVEL REFERENCE:
${levelReference}

TEXT TO ANALYZE:
"""
${text}
"""

ANALYZE:
1. Average sentence length (count words per sentence)
2. Vocabulary: common vs rare words
3. Grammar structures: which tenses, conditionals, subjunctive?
4. Idioms or figurative language present?
5. Complexity of clause structures

Return ONLY a JSON object:
{
  "level": 1-5,
  "cefr": "A1/A2/B1/B2/C1",
  "confidence": "high/medium/low",
  "reasoning": "1-2 sentence explanation citing specific grammar/vocab observed"
}`;
}
