// /src/content/quiz/l5.ts
// Level 5 (C1) - Advanced Questions
// Sentences from "The Last Word" and "Diego Unplugged" L5 content
// Wrong answers include both meaning errors AND grammar errors

// For English speakers learning Spanish - translate English to Spanish
export const quizL5_en = [
  // From "The Last Word"
  {
    id: "l5-en-q1",
    prompt: "Translate: 'Her stomach twisted as Daniel went through his slides without any trouble.'",
    choices: [
      "Su estómago se retorció mientras Daniel pasaba sus diapositivas sin problema.",
      "Su estómago se retorcer mientras Daniel pasaba sus diapositivas.",         // grammar: infinitive
      "Su estómago se relajó mientras Daniel luchaba con sus diapositivas.",      // meaning: relaxed/struggled
      "Su estómago se retorcieron mientras Daniel pasaba sus diapositivas."       // grammar: plural verb
    ],
    correctIndex: 0
  },
  {
    id: "l5-en-q2",
    prompt: "Translate: 'It scratched in her backpack. It sang in the back of her mind.'",
    choices: [
      "Rascaba en su mochila. Cantaba en el fondo de su mente.",
      "Rascar en su mochila. Cantar en el fondo de su mente.",                   // grammar: infinitives
      "Dormía en su mochila. Callaba en el fondo de su mente.",                  // meaning: slept/silenced
      "Rascaba en su mochila. Cantaban en el fondo de su mente."                 // grammar: plural
    ],
    correctIndex: 0
  },
  {
    id: "l5-en-q3",
    prompt: "Translate: 'Halfway through, her throat caught.'",
    choices: [
      "A mitad, se le cerró la garganta.",
      "A mitad, se le cerrar la garganta.",                                      // grammar: infinitive
      "Al final, su garganta se abrió.",                                         // meaning: end/opened
      "A mitad, se les cerró la garganta."                                       // grammar: les vs le
    ],
    correctIndex: 0
  },
  {
    id: "l5-en-q4",
    prompt: "Translate: 'She spoke about grief, and hope. She spoke about her Dad.'",
    choices: [
      "Habló de la tristeza y la esperanza. Habló de su papá.",
      "Hablar de la tristeza y la esperanza. Habló de su papá.",                 // grammar: infinitive
      "Habló de la alegría y el miedo. Habló de su mamá.",                       // meaning: joy/fear/mom
      "Habló de la tristeza y la esperanza. Hablaron de su papá."                // grammar: plural
    ],
    correctIndex: 0
  },
  {
    id: "l5-en-q5",
    prompt: "Translate: 'And her voice, though quiet, did not shake. It was strong enough to carry the last word.'",
    choices: [
      "Y su voz, aunque suave, no tembló. Era lo suficientemente fuerte para llevar la última palabra.",
      "Y su voz, aunque suave, no temblar. Era fuerte para llevar la última palabra.", // grammar: infinitive
      "Y su voz, aunque fuerte, tembló. Era demasiado débil para escuchar.",     // meaning: loud/shook/weak
      "Y su voz, aunque suave, no temblaron."                                    // grammar: plural verb
    ],
    correctIndex: 0
  },
  // From "Diego Unplugged"
  {
    id: "l5-en-q6",
    prompt: "Translate: 'All of a sudden, he lost his grip. The phone slipped from his fingers.'",
    choices: [
      "De repente, perdió el control. El teléfono se le resbaló de los dedos.",
      "De repente, perder el control. El teléfono se le resbaló.",               // grammar: infinitive
      "Lentamente, agarró bien el teléfono. El teléfono se quedó en sus manos.", // meaning: slowly/grabbed/stayed
      "De repente, perdió el control. El teléfono se les resbaló de los dedos."  // grammar: les vs le
    ],
    correctIndex: 0
  },
  {
    id: "l5-en-q7",
    prompt: "Translate: 'He couldn't explain it, but something scratched inside of him. Anxiety.'",
    choices: [
      "No podía explicarlo, pero algo le rasguñaba por dentro. Ansiedad.",
      "No poder explicarlo, pero algo le rasguñaba por dentro.",                 // grammar: infinitive
      "Podía explicarlo claramente. Se sentía tranquilo y en paz.",              // meaning: could explain/calm
      "No podía explicarlo, pero algo le rasguñar por dentro."                   // grammar: infinitive
    ],
    correctIndex: 0
  },
  {
    id: "l5-en-q8",
    prompt: "Translate: 'The silence wasn't peaceful — it was painful.'",
    choices: [
      "El silencio no era pacífico — era doloroso.",
      "El silencio no ser pacífico — era doloroso.",                             // grammar: infinitive
      "El silencio era pacífico — era reconfortante.",                           // meaning: was peaceful/comforting
      "El silencio no eran pacífico — era doloroso."                             // grammar: eran vs era
    ],
    correctIndex: 0
  },
  {
    id: "l5-en-q9",
    prompt: "Translate: 'The city was in motion below, but it no longer felt like noise. It felt like music.'",
    choices: [
      "La ciudad se movía debajo, pero ya no sonaba como ruido. Sonaba como música.",
      "La ciudad se mover debajo, pero ya no sonaba como ruido.",                // grammar: infinitive
      "La ciudad estaba quieta arriba, y sonaba como silencio.",                 // meaning: still/above/silence
      "La ciudad se movía debajo, pero ya no sonar como ruido."                  // grammar: infinitive
    ],
    correctIndex: 0
  },
  {
    id: "l5-en-q10",
    prompt: "Translate: 'Maybe it would serve as a reminder as to what he is missing out on.'",
    choices: [
      "Tal vez serviría como recordatorio de lo que se está perdiendo.",
      "Tal vez servir como recordatorio de lo que se está perdiendo.",           // grammar: infinitive
      "Probablemente olvidaría por completo lo que estaba haciendo.",            // meaning: forget/doing
      "Tal vez servirían como recordatorio de lo que se está perdiendo."         // grammar: plural
    ],
    correctIndex: 0
  }
];

// For Spanish speakers learning English - translate Spanish to English
export const quizL5_es = [
  // From "The Last Word"
  {
    id: "l5-es-q1",
    prompt: "Traduce: 'Su estómago se retorció mientras Daniel pasaba sus diapositivas sin problema.'",
    choices: [
      "Her stomach twisted as Daniel went through his slides without any trouble.",
      "Her stomach twist as Daniel went through his slides without any trouble.", // grammar: twist vs twisted
      "Her stomach relaxed as Daniel struggled with his slides.",                // meaning: relaxed/struggled
      "Her stomach twisted as Daniel gone through his slides without any trouble." // grammar: gone vs went
    ],
    correctIndex: 0
  },
  {
    id: "l5-es-q2",
    prompt: "Traduce: 'Rascaba en su mochila. Cantaba en el fondo de su mente.'",
    choices: [
      "It scratched in her backpack. It sang in the back of her mind.",
      "It scratch in her backpack. It sing in the back of her mind.",            // grammar: scratch/sing
      "It slept in her backpack. It was silent in the back of her mind.",        // meaning: slept/silent
      "It scratched in her backpack. It singed in the back of her mind."         // grammar: singed vs sang
    ],
    correctIndex: 0
  },
  {
    id: "l5-es-q3",
    prompt: "Traduce: 'A mitad, se le cerró la garganta.'",
    choices: [
      "Halfway through, her throat caught.",
      "Halfway through, her throat catch.",                                      // grammar: catch vs caught
      "At the end, her throat opened.",                                          // meaning: end/opened
      "Halfway through, her throat catched."                                     // grammar: catched vs caught
    ],
    correctIndex: 0
  },
  {
    id: "l5-es-q4",
    prompt: "Traduce: 'Habló de la tristeza y la esperanza. Habló de su papá.'",
    choices: [
      "She spoke about grief, and hope. She spoke about her Dad.",
      "She speak about grief, and hope. She spoke about her Dad.",               // grammar: speak vs spoke
      "She spoke about joy, and fear. She spoke about her Mom.",                 // meaning: joy/fear/mom
      "She spoke about grief, and hope. She speaked about her Dad."              // grammar: speaked
    ],
    correctIndex: 0
  },
  {
    id: "l5-es-q5",
    prompt: "Traduce: 'Y su voz, aunque suave, no tembló. Era lo suficientemente fuerte para llevar la última palabra.'",
    choices: [
      "And her voice, though quiet, did not shake. It was strong enough to carry the last word.",
      "And her voice, though quiet, did not shook. It was strong enough.",       // grammar: did not shook
      "And her voice, though loud, shook. It was too weak to hear.",             // meaning: loud/shook/weak
      "And her voice, though quiet, did not shake. It were strong enough."       // grammar: were vs was
    ],
    correctIndex: 0
  },
  // From "Diego Unplugged"
  {
    id: "l5-es-q6",
    prompt: "Traduce: 'De repente, perdió el control. El teléfono se le resbaló de los dedos.'",
    choices: [
      "All of a sudden, he lost his grip. The phone slipped from his fingers.",
      "All of a sudden, he lose his grip. The phone slipped from his fingers.",  // grammar: lose vs lost
      "Slowly, he grabbed the phone tightly. The phone stayed in his hands.",    // meaning: slowly/grabbed/stayed
      "All of a sudden, he lost his grip. The phone slipt from his fingers."     // grammar: slipt vs slipped
    ],
    correctIndex: 0
  },
  {
    id: "l5-es-q7",
    prompt: "Traduce: 'No podía explicarlo, pero algo le rasguñaba por dentro. Ansiedad.'",
    choices: [
      "He couldn't explain it, but something scratched inside of him. Anxiety.",
      "He can't explain it, but something scratched inside of him. Anxiety.",    // grammar: can't vs couldn't
      "He could explain it clearly. He felt calm and at peace.",                 // meaning: could explain/calm
      "He couldn't explain it, but something scratch inside of him."             // grammar: scratch vs scratched
    ],
    correctIndex: 0
  },
  {
    id: "l5-es-q8",
    prompt: "Traduce: 'El silencio no era pacífico — era doloroso.'",
    choices: [
      "The silence wasn't peaceful — it was painful.",
      "The silence weren't peaceful — it was painful.",                          // grammar: weren't vs wasn't
      "The silence was peaceful — it was comforting.",                           // meaning: was peaceful
      "The silence wasn't peaceful — it were painful."                           // grammar: were vs was
    ],
    correctIndex: 0
  },
  {
    id: "l5-es-q9",
    prompt: "Traduce: 'La ciudad se movía debajo, pero ya no sonaba como ruido. Sonaba como música.'",
    choices: [
      "The city was in motion below, but it no longer felt like noise. It felt like music.",
      "The city were in motion below, but it no longer felt like noise.",        // grammar: were vs was
      "The city was still above, and it sounded like silence.",                  // meaning: still/above/silence
      "The city was in motion below, but it no longer feeled like noise."        // grammar: feeled
    ],
    correctIndex: 0
  },
  {
    id: "l5-es-q10",
    prompt: "Traduce: 'Tal vez serviría como recordatorio de lo que se está perdiendo.'",
    choices: [
      "Maybe it would serve as a reminder as to what he is missing out on.",
      "Maybe it will served as a reminder as to what he is missing out on.",     // grammar: will served
      "He would probably completely forget what he was doing.",                  // meaning: forget/doing
      "Maybe it would serve as a reminder as to what he is miss out on."         // grammar: miss vs missing
    ],
    correctIndex: 0
  }
];
