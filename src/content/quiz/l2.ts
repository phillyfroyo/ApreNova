// /src/content/quiz/l2.ts
// Level 2 (A2) - Elementary Questions
// Sentences from "The Last Word" and "Diego Unplugged" L2 content
// Wrong answers include both meaning errors AND grammar errors

// For English speakers learning Spanish - translate English to Spanish
export const quizL2_en = [
  // From "The Last Word"
  {
    id: "l2-en-q1",
    prompt: "Translate: 'Her hands were shaking as she held her note cards.'",
    choices: [
      "Sus manos temblaban mientras sostenía sus tarjetas.",
      "Sus manos temblaban mientras sostener sus tarjetas.",  // grammar: infinitive
      "Sus manos estaban frías mientras leía sus tarjetas.",  // meaning: cold/read
      "Sus manos temblaron mientras sostenía sus tarjetas."   // grammar: wrong tense
    ],
    correctIndex: 0
  },
  {
    id: "l2-en-q2",
    prompt: "Translate: 'She practiced in her room, in the mirror.'",
    choices: [
      "Ella practicar en su cuarto, frente al espejo.",       // grammar: infinitive
      "Practicó en su cuarto, frente al espejo.",
      "Practicó en la escuela, con su amiga.",                // meaning: school/friend
      "Ella practicaba en su cuarto, frente el espejo."       // grammar: missing 'a'
    ],
    correctIndex: 1
  },
  {
    id: "l2-en-q3",
    prompt: "Translate: 'Her face felt hot. Her heart was beating fast.'",
    choices: [
      "Su cara estaba fría. Su corazón estaba tranquilo.",    // meaning: cold/calm
      "Le ardía la cara. El corazón le latía muy rápido.",
      "Le ardía la cara. El corazón le latir muy rápido.",    // grammar: infinitive
      "Le ardió la cara. El corazón le latió muy rápido."     // grammar: wrong tense
    ],
    correctIndex: 1
  },
  {
    id: "l2-en-q4",
    prompt: "Translate: 'She looked at the floor and wished she could disappear.'",
    choices: [
      "Miró al suelo y deseó poder desaparecer.",
      "Miró al suelo y deseó poder desaparecía.",              // grammar: wrong verb form
      "Miró a la ventana y quiso salir corriendo.",           // meaning: window/run
      "Miraba al suelo y desear poder desaparecer."           // grammar: infinitive
    ],
    correctIndex: 0
  },
  {
    id: "l2-en-q5",
    prompt: "Translate: 'She used to love writing stories.'",
    choices: [
      "Ella odiaba escribir historias.",                      // meaning: hated
      "Antes le encantaba escribiendo historias.",            // grammar: gerund instead of infinitive
      "Antes le encantaba escribir historias.",
      "Antes ella encantar escribir historias."               // grammar: infinitive/missing 'le'
    ],
    correctIndex: 2
  },
  // From "Diego Unplugged"
  {
    id: "l2-en-q6",
    prompt: "Translate: 'Suddenly, the phone fell out of his hands.'",
    choices: [
      "Lentamente, el teléfono se rompió en sus manos.",      // meaning: slowly/broke
      "De repente, el teléfono se cayó de sus manos.",
      "De repente, el teléfono se caer de sus manos.",        // grammar: infinitive
      "De repente, el teléfono se cayeron de sus manos."      // grammar: plural verb
    ],
    correctIndex: 1
  },
  {
    id: "l2-en-q7",
    prompt: "Translate: 'It would take him at least a month to save up enough money.'",
    choices: [
      "Tardaría al menos un mes en ahorrar suficiente dinero.",
      "Tardará al menos un mes en ahorrar suficiente dinero.", // grammar: wrong conditional
      "Necesitaba una semana para ganar más dinero.",         // meaning: week/earn
      "Tardar al menos un mes en ahorrar suficiente dinero."  // grammar: infinitive
    ],
    correctIndex: 0
  },
  {
    id: "l2-en-q8",
    prompt: "Translate: 'The silence didn't feel nice. It was difficult.'",
    choices: [
      "El ruido no era agradable. Era molesto.",              // meaning: noise/annoying
      "El silencio no se sentir bien. Era difícil.",          // grammar: infinitive
      "El silencio no se sentía bien. Era difícil.",
      "El silencio no se sentían bien. Eran difícil."         // grammar: plural verbs
    ],
    correctIndex: 2
  },
  {
    id: "l2-en-q9",
    prompt: "Translate: 'He began to notice things that he hadn't noticed before.'",
    choices: [
      "Empezó a notar cosas que antes no veía.",
      "Empezó a notar cosas que antes no ver.",               // grammar: infinitive
      "Empezó a olvidar cosas que antes recordaba.",          // meaning: forget/remember
      "Empezar a notar cosas que antes no veía."              // grammar: infinitive
    ],
    correctIndex: 0
  },
  {
    id: "l2-en-q10",
    prompt: "Translate: 'The world didn't change. I did.'",
    choices: [
      "El mundo cambió mucho. Yo también.",                   // meaning: changed a lot
      "El mundo no cambió. Yo cambié.",
      "El mundo no cambiar. Yo cambiar.",                     // grammar: infinitives
      "El mundo no cambiaba. Yo cambié."                      // grammar: tense mismatch
    ],
    correctIndex: 1
  }
];

// For Spanish speakers learning English - translate Spanish to English
export const quizL2_es = [
  // From "The Last Word"
  {
    id: "l2-es-q1",
    prompt: "Traduce: 'Sus manos temblaban mientras sostenía sus tarjetas.'",
    choices: [
      "Her hands were shaking as she held her note cards.",
      "Her hands was shaking as she held her note cards.",    // grammar: was instead of were
      "Her hands were cold as she read her note cards.",      // meaning: cold/read
      "Her hands were shake as she hold her note cards."      // grammar: wrong verb forms
    ],
    correctIndex: 0
  },
  {
    id: "l2-es-q2",
    prompt: "Traduce: 'Practicó en su cuarto, frente al espejo.'",
    choices: [
      "She practiced at school, with her friend.",            // meaning: school/friend
      "She practiced in her room, in the mirror.",
      "She practice in her room, in the mirror.",             // grammar: missing -d
      "She was practice in her room, in the mirror."          // grammar: wrong structure
    ],
    correctIndex: 1
  },
  {
    id: "l2-es-q3",
    prompt: "Traduce: 'Le ardía la cara. El corazón le latía muy rápido.'",
    choices: [
      "Her face was cold. Her heart was calm.",               // meaning: cold/calm
      "Her face felt hot. Her heart was beating fast.",
      "Her face felt hot. Her heart were beating fast.",      // grammar: were instead of was
      "Her face feel hot. Her heart was beat fast."           // grammar: wrong verb forms
    ],
    correctIndex: 1
  },
  {
    id: "l2-es-q4",
    prompt: "Traduce: 'Miró al suelo y deseó poder desaparecer.'",
    choices: [
      "She looked at the floor and wished she could disappear.",
      "She look at the floor and wish she could disappear.",  // grammar: missing -ed
      "She looked at the window and wanted to run away.",     // meaning: window/run
      "She looked at the floor and wished she can disappear." // grammar: can instead of could
    ],
    correctIndex: 0
  },
  {
    id: "l2-es-q5",
    prompt: "Traduce: 'Antes le encantaba escribir historias.'",
    choices: [
      "She hated writing stories.",                           // meaning: hated
      "She use to love writing stories.",                     // grammar: use instead of used
      "She used to love writing stories.",
      "She used to loving write stories."                     // grammar: wrong structure
    ],
    correctIndex: 2
  },
  // From "Diego Unplugged"
  {
    id: "l2-es-q6",
    prompt: "Traduce: 'De repente, el teléfono se cayó de sus manos.'",
    choices: [
      "Slowly, the phone broke in his hands.",                // meaning: slowly/broke
      "Suddenly, the phone fell out of his hands.",
      "Suddenly, the phone fall out of his hands.",           // grammar: fall instead of fell
      "Suddenly, the phone falled out of his hands."          // grammar: falled
    ],
    correctIndex: 1
  },
  {
    id: "l2-es-q7",
    prompt: "Traduce: 'Tardaría al menos un mes en ahorrar suficiente dinero.'",
    choices: [
      "It would take him at least a month to save up enough money.",
      "It will took him at least a month to save up enough money.",  // grammar: will took
      "He needed a week to earn more money.",                 // meaning: week/earn
      "It would takes him at least a month to save up enough money." // grammar: takes
    ],
    correctIndex: 0
  },
  {
    id: "l2-es-q8",
    prompt: "Traduce: 'El silencio no se sentía bien. Era difícil.'",
    choices: [
      "The noise wasn't pleasant. It was annoying.",          // meaning: noise/annoying
      "The silence didn't felt nice. It was difficult.",      // grammar: didn't felt
      "The silence didn't feel nice. It was difficult.",
      "The silence doesn't feel nice. It is difficult."       // grammar: wrong tense
    ],
    correctIndex: 2
  },
  {
    id: "l2-es-q9",
    prompt: "Traduce: 'Empezó a notar cosas que antes no veía.'",
    choices: [
      "He began to notice things that he hadn't noticed before.",
      "He began to noticing things that he hadn't noticed before.", // grammar: to noticing
      "He began to forget things that he used to remember.",  // meaning: forget/remember
      "He begin to notice things that he hadn't noticed before."    // grammar: begin
    ],
    correctIndex: 0
  },
  {
    id: "l2-es-q10",
    prompt: "Traduce: 'El mundo no cambió. Yo cambié.'",
    choices: [
      "The world changed a lot. I did too.",                  // meaning: changed a lot
      "The world didn't change. I did.",
      "The world didn't changed. I did.",                     // grammar: didn't changed
      "The world not change. I change."                       // grammar: missing did
    ],
    correctIndex: 1
  }
];
