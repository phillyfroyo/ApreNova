// /src/content/quiz/l3.ts
// Level 3 (B1) - Intermediate Questions
// Sentences from "The Last Word" and "Diego Unplugged" L3 content
// Wrong answers include both meaning errors AND grammar errors

// For English speakers learning Spanish - translate English to Spanish
export const quizL3_en = [
  // From "The Last Word"
  {
    id: "l3-en-q1",
    prompt: "Translate: 'Every part of her wanted not to stand up. But her legs moved anyway.'",
    choices: [
      "Cada parte de ella quería no levantarse. Pero sus piernas se movieron de todos modos.",
      "Cada parte de ella querer no levantarse. Pero sus piernas se movieron.",  // grammar: infinitive
      "Toda ella quería quedarse sentada. Pero sus brazos se movieron solos.",   // meaning: seated/arms
      "Cada parte de ella quería no levantarse. Pero sus piernas se mover."      // grammar: infinitive
    ],
    correctIndex: 0
  },
  {
    id: "l3-en-q2",
    prompt: "Translate: 'She held the edges of her note cards so tightly they bent at the corners.'",
    choices: [
      "Dejó caer sus tarjetas y se doblaron en el piso.",                        // meaning: dropped
      "Sujetaba los bordes de sus tarjetas con tanta fuerza que se doblaron en las esquinas.",
      "Sujetaba los bordes de sus tarjetas con tanta fuerza que se doblar.",     // grammar: infinitive
      "Sujetando los bordes de sus tarjetas con tanto fuerza que se doblaron."   // grammar: tanto vs tanta
    ],
    correctIndex: 1
  },
  {
    id: "l3-en-q3",
    prompt: "Translate: 'Not because she was scared, but because she had been holding so many feelings inside.'",
    choices: [
      "No porque tuviera miedo, sino porque había guardado muchos sentimientos dentro.",
      "No porque ella tener miedo, sino porque había guardado muchos sentimientos.",  // grammar: infinitive
      "Porque tenía miedo y no podía controlar sus emociones.",                   // meaning: because scared
      "No porque tuviera miedo, sino porque había guardando muchos sentimientos." // grammar: gerund
    ],
    correctIndex: 0
  },
  {
    id: "l3-en-q4",
    prompt: "Translate: 'She took a breath — a long, deep breath that felt like something brand new.'",
    choices: [
      "Tomó aire rápidamente y se sintió mareada.",                              // meaning: quickly/dizzy
      "Respirar — una respiración larga y profunda que se sintió nuevo.",        // grammar: infinitive + gender
      "Respiró — una respiración larga y profunda que se sintió como algo completamente nuevo.",
      "Respiró — una respiración largo y profundo que se sintió como algo nuevo." // grammar: gender agreement
    ],
    correctIndex: 2
  },
  {
    id: "l3-en-q5",
    prompt: "Translate: 'And her voice, though quiet, was strong enough to carry the last word.'",
    choices: [
      "Y su voz, aunque fuerte, era demasiado baja para escuchar.",              // meaning: loud/too quiet
      "Y su voz, aunque suave, era lo suficientemente fuerte como para decir la última palabra.",
      "Y su voz, aunque suave, ser lo suficientemente fuerte para decir.",       // grammar: infinitive
      "Y su voz, aunque suave, era lo suficiente fuerte como para decir."        // grammar: suficiente vs suficientemente
    ],
    correctIndex: 1
  },
  // From "Diego Unplugged"
  {
    id: "l3-en-q6",
    prompt: "Translate: 'He watched videos until his eyes were too tired to stay open.'",
    choices: [
      "Veía videos hasta que los ojos se le cerraban del cansancio.",
      "Ver videos hasta que los ojos se le cerraban del cansancio.",             // grammar: infinitive
      "Miraba la pantalla hasta que le dolía la cabeza.",                        // meaning: screen/head hurt
      "Veía videos hasta que los ojos se le cerrar del cansancio."               // grammar: infinitive
    ],
    correctIndex: 0
  },
  {
    id: "l3-en-q7",
    prompt: "Translate: 'He felt like he lost a part of himself.'",
    choices: [
      "Sentía que había ganado algo importante.",                                // meaning: gained
      "Sintió que había perdido una parte de sí mismo.",
      "Sentir que había perdido una parte de sí mismo.",                         // grammar: infinitive
      "Sintió que había perdido una parte de él mismo."                          // grammar: él vs sí
    ],
    correctIndex: 1
  },
  {
    id: "l3-en-q8",
    prompt: "Translate: 'It reminded him of when he was a kid.'",
    choices: [
      "Le hizo olvidar su infancia.",                                            // meaning: forget
      "Le recordó a su hermano mayor.",                                          // meaning: older brother
      "Le recordó cuando era niño.",
      "Le recordar cuando era niño."                                             // grammar: infinitive
    ],
    correctIndex: 2
  },
  {
    id: "l3-en-q9",
    prompt: "Translate: 'Maybe it would remind him of what he was missing if he spent too much time on his phone.'",
    choices: [
      "Tal vez le recordaría lo que se estaba perdiendo si pasaba demasiado tiempo en su teléfono.",
      "Tal vez le recordar lo que se estaba perdiendo si pasaba demasiado tiempo.", // grammar: infinitive
      "Probablemente olvidaría usar su teléfono si estaba muy ocupado.",         // meaning: forget/busy
      "Tal vez le recordaría lo que se estar perdiendo si pasar demasiado tiempo." // grammar: infinitives
    ],
    correctIndex: 0
  },
  {
    id: "l3-en-q10",
    prompt: "Translate: 'The city was moving below. But it did not feel like noise anymore.'",
    choices: [
      "La ciudad estaba silenciosa. Pero se sentía vacía.",                      // meaning: quiet/empty
      "La ciudad estar moviendo abajo. Pero ya no se sentía como ruido.",        // grammar: infinitive
      "La ciudad se movía abajo. Pero ya no se sentía como ruido.",
      "La ciudad se movía abajo. Pero ya no se sentir como ruido."               // grammar: infinitive
    ],
    correctIndex: 2
  }
];

// For Spanish speakers learning English - translate Spanish to English
export const quizL3_es = [
  // From "The Last Word"
  {
    id: "l3-es-q1",
    prompt: "Traduce: 'Cada parte de ella quería no levantarse. Pero sus piernas se movieron de todos modos.'",
    choices: [
      "Every part of her wanted not to stand up. But her legs moved anyway.",
      "Every part of her want not to stand up. But her legs moved anyway.",      // grammar: want vs wanted
      "All of her wanted to stay seated. But her arms moved on their own.",      // meaning: seated/arms
      "Every part of her wanted not to stand up. But her legs move anyway."      // grammar: move vs moved
    ],
    correctIndex: 0
  },
  {
    id: "l3-es-q2",
    prompt: "Traduce: 'Sujetaba los bordes de sus tarjetas con tanta fuerza que se doblaron en las esquinas.'",
    choices: [
      "She dropped her cards and they bent on the floor.",                       // meaning: dropped
      "She held the edges of her note cards so tightly they bent at the corners.",
      "She hold the edges of her note cards so tightly they bent.",              // grammar: hold vs held
      "She held the edges of her note cards so tight they bended at the corners." // grammar: tight/bended
    ],
    correctIndex: 1
  },
  {
    id: "l3-es-q3",
    prompt: "Traduce: 'No porque tuviera miedo, sino porque había guardado muchos sentimientos dentro.'",
    choices: [
      "Not because she was scared, but because she had been holding so many feelings inside.",
      "Not because she was scared, but because she have been holding so many feelings.", // grammar: have vs had
      "Because she was afraid and couldn't control her emotions.",               // meaning: because afraid
      "Not because she was scared, but because she had been hold so many feelings." // grammar: hold vs holding
    ],
    correctIndex: 0
  },
  {
    id: "l3-es-q4",
    prompt: "Traduce: 'Respiró — una respiración larga y profunda que se sintió como algo completamente nuevo.'",
    choices: [
      "She breathed quickly and felt dizzy.",                                    // meaning: quickly/dizzy
      "She take a breath — a long, deep breath that felt like something brand new.", // grammar: take vs took
      "She took a breath — a long, deep breath that felt like something brand new.",
      "She took a breath — a long, deep breath that feeled like something brand new." // grammar: feeled
    ],
    correctIndex: 2
  },
  {
    id: "l3-es-q5",
    prompt: "Traduce: 'Y su voz, aunque suave, era lo suficientemente fuerte como para decir la última palabra.'",
    choices: [
      "And her voice, though loud, was too quiet to hear.",                      // meaning: loud/quiet
      "And her voice, though quiet, was strong enough to carry the last word.",
      "And her voice, though quiet, were strong enough to carry the last word.", // grammar: were vs was
      "And her voice, though quiet, was enough strong to carry the last word."   // grammar: word order
    ],
    correctIndex: 1
  },
  // From "Diego Unplugged"
  {
    id: "l3-es-q6",
    prompt: "Traduce: 'Veía videos hasta que los ojos se le cerraban del cansancio.'",
    choices: [
      "He watched videos until his eyes were too tired to stay open.",
      "He watch videos until his eyes were too tired to stay open.",             // grammar: watch vs watched
      "He looked at the screen until his head hurt.",                            // meaning: screen/head
      "He watched videos until his eyes was too tired to stay open."             // grammar: was vs were
    ],
    correctIndex: 0
  },
  {
    id: "l3-es-q7",
    prompt: "Traduce: 'Sintió que había perdido una parte de sí mismo.'",
    choices: [
      "He felt like he had gained something important.",                         // meaning: gained
      "He felt like he lost a part of himself.",
      "He feel like he lost a part of himself.",                                 // grammar: feel vs felt
      "He felt like he had lose a part of himself."                              // grammar: lose vs lost
    ],
    correctIndex: 1
  },
  {
    id: "l3-es-q8",
    prompt: "Traduce: 'Le recordó cuando era niño.'",
    choices: [
      "It made him forget his childhood.",                                       // meaning: forget
      "It reminded him of his older brother.",                                   // meaning: brother
      "It reminded him of when he was a kid.",
      "It remind him of when he was a kid."                                      // grammar: remind vs reminded
    ],
    correctIndex: 2
  },
  {
    id: "l3-es-q9",
    prompt: "Traduce: 'Tal vez le recordaría lo que se estaba perdiendo si pasaba demasiado tiempo en su teléfono.'",
    choices: [
      "Maybe it would remind him of what he was missing if he spent too much time on his phone.",
      "Maybe it will remind him of what he was missing if he spend too much time.", // grammar: will/spend
      "He would probably forget to use his phone if he was too busy.",           // meaning: forget/busy
      "Maybe it would reminded him of what he was missing if he spent too much." // grammar: reminded
    ],
    correctIndex: 0
  },
  {
    id: "l3-es-q10",
    prompt: "Traduce: 'La ciudad se movía abajo. Pero ya no se sentía como ruido.'",
    choices: [
      "The city was quiet. But it felt empty.",                                  // meaning: quiet/empty
      "The city were moving below. But it did not feel like noise anymore.",     // grammar: were vs was
      "The city was moving below. But it did not feel like noise anymore.",
      "The city was moving below. But it did not felt like noise anymore."       // grammar: felt vs feel
    ],
    correctIndex: 2
  }
];
