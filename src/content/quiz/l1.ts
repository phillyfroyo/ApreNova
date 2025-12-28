// /src/content/quiz/l1.ts
// Level 1 (A1) - Absolute Beginner Questions
// Sentences from "The Last Word" and "Diego Unplugged" L1 content
// Wrong answers include both meaning errors AND grammar errors

// For English speakers learning Spanish - translate English to Spanish
export const quizL1_en = [
  // From "The Last Word"
  {
    id: "l1-en-q1",
    prompt: "Translate: 'She looks at the list.'",
    choices: [
      "Ella mira la lista.",
      "Ella mirar la lista.",      // grammar: infinitive instead of conjugated
      "Ella escribe la lista.",    // meaning: writes instead of looks
      "Ella miran la lista."       // grammar: wrong conjugation
    ],
    correctIndex: 0
  },
  {
    id: "l1-en-q2",
    prompt: "Translate: 'She feels scared.'",
    choices: [
      "Ella sentir asustada.",     // grammar: infinitive
      "Se siente asustada.",
      "Ella tiene hambre.",        // meaning: hungry
      "Ella siente asustado."      // grammar: wrong gender agreement
    ],
    correctIndex: 1
  },
  {
    id: "l1-en-q3",
    prompt: "Translate: 'Maya has her paper.'",
    choices: [
      "Maya tiene su hoja.",
      "Maya tener su hoja.",        // grammar: infinitive
      "Maya tienes su hoja.",       // grammar: wrong conjugation (tú form)
      "Maya lee su libro."          // meaning: reads her book
    ],
    correctIndex: 0
  },
  {
    id: "l1-en-q4",
    prompt: "Translate: 'She is ready.'",
    choices: [
      "Ella es lista.",            // grammar: ser vs estar (means "smart")
      "Ella estar lista.",         // grammar: infinitive
      "Está lista.",
      "Ella está triste."          // meaning: sad
    ],
    correctIndex: 2
  },
  {
    id: "l1-en-q5",
    prompt: "Translate: 'Everyone claps.'",
    choices: [
      "Todos aplaudir.",           // grammar: infinitive
      "Todos aplauden.",
      "Todo aplaude.",             // grammar: singular instead of plural
      "Todos hablan."              // meaning: talks
    ],
    correctIndex: 1
  },
  // From "Diego Unplugged"
  {
    id: "l1-en-q6",
    prompt: "Translate: 'Diego has a phone.'",
    choices: [
      "Diego tiene un teléfono.",
      "Diego tener un teléfono.",   // grammar: infinitive
      "Diego tienes un teléfono.",  // grammar: wrong conjugation
      "Diego quiere un teléfono."   // meaning: wants
    ],
    correctIndex: 0
  },
  {
    id: "l1-en-q7",
    prompt: "Translate: 'He watches videos when he eats.'",
    choices: [
      "Ve videos cuando comer.",    // grammar: infinitive
      "Ve videos cuando come.",
      "Ver videos cuando come.",    // grammar: infinitive
      "Ve videos cuando duerme."    // meaning: sleeps
    ],
    correctIndex: 1
  },
  {
    id: "l1-en-q8",
    prompt: "Translate: 'The phone does not work.'",
    choices: [
      "El teléfono no funcionar.",  // grammar: infinitive
      "El teléfono es nuevo.",      // meaning: is new
      "El teléfono no funciona.",
      "El teléfono funciona no."    // grammar: wrong word order
    ],
    correctIndex: 2
  },
  {
    id: "l1-en-q9",
    prompt: "Translate: 'Diego feels very bad.'",
    choices: [
      "Diego está muy bien.",       // meaning: very well
      "Diego se siente muy mal.",
      "Diego sentir muy mal.",      // grammar: infinitive + missing se
      "Diego se sientes muy mal."   // grammar: wrong conjugation
    ],
    correctIndex: 1
  },
  {
    id: "l1-en-q10",
    prompt: "Translate: 'It makes him feel happy.'",
    choices: [
      "Lo hace sentir triste.",     // meaning: sad
      "Lo hacer sentir feliz.",     // grammar: infinitive
      "Lo hace sentir feliz.",
      "Lo hacen sentir feliz."      // grammar: wrong conjugation (plural)
    ],
    correctIndex: 2
  }
];

// For Spanish speakers learning English - translate Spanish to English
export const quizL1_es = [
  // From "The Last Word"
  {
    id: "l1-es-q1",
    prompt: "Traduce: 'Ella mira la lista.'",
    choices: [
      "She looks at the list.",
      "She look at the list.",      // grammar: missing -s
      "She looking at the list.",   // grammar: missing is
      "She writes the list."        // meaning: writes
    ],
    correctIndex: 0
  },
  {
    id: "l1-es-q2",
    prompt: "Traduce: 'Se siente asustada.'",
    choices: [
      "She feel scared.",           // grammar: missing -s
      "She feels scared.",
      "She is feel scared.",        // grammar: wrong structure
      "She is hungry."              // meaning: hungry
    ],
    correctIndex: 1
  },
  {
    id: "l1-es-q3",
    prompt: "Traduce: 'Maya tiene su hoja.'",
    choices: [
      "Maya has her paper.",
      "Maya have her paper.",       // grammar: wrong verb form
      "Maya haves her paper.",      // grammar: wrong conjugation
      "Maya reads her book."        // meaning: reads book
    ],
    correctIndex: 0
  },
  {
    id: "l1-es-q4",
    prompt: "Traduce: 'Está lista.'",
    choices: [
      "She are ready.",             // grammar: wrong verb
      "She is ready.",
      "She ready.",                 // grammar: missing verb
      "She is sad."                 // meaning: sad
    ],
    correctIndex: 1
  },
  {
    id: "l1-es-q5",
    prompt: "Traduce: 'Todos aplauden.'",
    choices: [
      "Everyone clap.",             // grammar: missing -s
      "Everyone claps.",
      "Everyone clapping.",         // grammar: missing is
      "Everyone talks."             // meaning: talks
    ],
    correctIndex: 1
  },
  // From "Diego Unplugged"
  {
    id: "l1-es-q6",
    prompt: "Traduce: 'Diego tiene un teléfono.'",
    choices: [
      "Diego has a phone.",
      "Diego have a phone.",        // grammar: wrong verb form
      "Diego haves a phone.",       // grammar: wrong conjugation
      "Diego wants a phone."        // meaning: wants
    ],
    correctIndex: 0
  },
  {
    id: "l1-es-q7",
    prompt: "Traduce: 'Ve videos cuando come.'",
    choices: [
      "He watch videos when he eats.",   // grammar: missing -es
      "He watches videos when he eats.",
      "He watches videos when he eat.",  // grammar: missing -s
      "He watches videos when he sleeps." // meaning: sleeps
    ],
    correctIndex: 1
  },
  {
    id: "l1-es-q8",
    prompt: "Traduce: 'El teléfono no funciona.'",
    choices: [
      "The phone not work.",        // grammar: missing does
      "The phone does not works.",  // grammar: extra -s
      "The phone does not work.",
      "The phone is new."           // meaning: is new
    ],
    correctIndex: 2
  },
  {
    id: "l1-es-q9",
    prompt: "Traduce: 'Diego se siente muy mal.'",
    choices: [
      "Diego is very well.",        // meaning: very well
      "Diego feels very bad.",
      "Diego feel very bad.",       // grammar: missing -s
      "Diego feeling very bad."     // grammar: missing is
    ],
    correctIndex: 1
  },
  {
    id: "l1-es-q10",
    prompt: "Traduce: 'Lo hace sentir feliz.'",
    choices: [
      "It make him feel happy.",    // grammar: missing -s
      "It makes him feels happy.",  // grammar: extra -s on feel
      "It makes him feel happy.",
      "It makes him feel angry."    // meaning: angry
    ],
    correctIndex: 2
  }
];
