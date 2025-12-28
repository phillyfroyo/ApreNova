// /src/content/quiz/l4.ts
// Level 4 (B2) - Upper Intermediate Questions
// Sentences from "The Last Word" and "Diego Unplugged" L4 content
// Wrong answers include both meaning errors AND grammar errors

// For English speakers learning Spanish - translate English to Spanish
export const quizL4_en = [
  // From "The Last Word"
  {
    id: "l4-en-q1",
    prompt: "Translate: 'She stared at it, written in black marker on the white board.'",
    choices: [
      "Lo miró fijamente, escrito con marcador negro en la pizarra blanca.",
      "Lo mirar fijamente, escrito con marcador negro en la pizarra blanca.",    // grammar: infinitive
      "Lo vio rápidamente, escrito con lápiz en el cuaderno.",                   // meaning: quickly/pencil/notebook
      "Lo miró fijamente, escribido con marcador negro en la pizarra."           // grammar: escribido vs escrito
    ],
    correctIndex: 0
  },
  {
    id: "l4-en-q2",
    prompt: "Translate: 'He was cracking jokes and somehow made the French Revolution funny.'",
    choices: [
      "Estaba haciendo chistes y, de alguna manera, logró que la Revolución Francesa fuera graciosa.",
      "Estar haciendo chistes y, de alguna manera, logró que fuera graciosa.",   // grammar: infinitive
      "Estaba contando historias y, de alguna manera, la clase se durmió.",      // meaning: stories/fell asleep
      "Estaba haciendo chistes y, de alguna manera, logró que fuera gracioso."   // grammar: gender agreement
    ],
    correctIndex: 0
  },
  {
    id: "l4-en-q3",
    prompt: "Translate: 'A flash of panic flew up her neck.'",
    choices: [
      "Un destello de pánico le subió por el cuello.",
      "Un destello de pánico le subir por el cuello.",                           // grammar: infinitive
      "Una ola de calma le bajó por la espalda.",                                // meaning: calm/went down/back
      "Un destello de pánico le subieron por el cuello."                         // grammar: plural verb
    ],
    correctIndex: 0
  },
  {
    id: "l4-en-q4",
    prompt: "Translate: 'She avoided eye contact with everyone and planned to fake sick.'",
    choices: [
      "Evitó el contacto visual con todos y planeó fingir estar enferma.",
      "Evitar el contacto visual con todos y planeó fingir estar enferma.",      // grammar: infinitive
      "Buscó el contacto visual con todos y planeó ir a la escuela.",            // meaning: sought/go to school
      "Evitó el contacto visual con todos y planeó fingir estar enfermo."        // grammar: gender
    ],
    correctIndex: 0
  },
  {
    id: "l4-en-q5",
    prompt: "Translate: 'She took a breath — a deep, steady breath that felt like something brand new.'",
    choices: [
      "Respiró — una respiración profunda y estable que se sintió como algo completamente nuevo.",
      "Respirar — una respiración profunda y estable que se sintió nuevo.",      // grammar: infinitive + gender
      "Aguantó la respiración — y se sintió mareada y confundida.",              // meaning: held breath/dizzy
      "Respiró — una respiración profundo y estable que se sintió como algo nuevo." // grammar: gender agreement
    ],
    correctIndex: 0
  },
  // From "Diego Unplugged"
  {
    id: "l4-en-q6",
    prompt: "Translate: 'The sound of the phone hitting the sidewalk below was terrifying.'",
    choices: [
      "El sonido del golpe contra la banqueta fue espantoso.",
      "El sonido del golpe contra la banqueta ser espantoso.",                   // grammar: infinitive
      "El silencio después de que el teléfono cayó fue reconfortante.",          // meaning: silence/comforting
      "El sonido del golpe contra la banqueta fueron espantoso."                 // grammar: plural verb
    ],
    correctIndex: 0
  },
  {
    id: "l4-en-q7",
    prompt: "Translate: 'Nothing could hold his attention. Food didn't taste good. Music felt boring.'",
    choices: [
      "Nada lograba mantener su atención. La comida no sabía bien. La música sonaba aburrida.",
      "Nada lograr mantener su atención. La comida no sabía bien.",              // grammar: infinitive
      "Todo captaba su atención. La comida sabía deliciosa. La música era emocionante.", // meaning: opposite
      "Nada lograba mantener su atención. La comida no saber bien."              // grammar: infinitive
    ],
    correctIndex: 0
  },
  {
    id: "l4-en-q8",
    prompt: "Translate: 'At first, small talk felt awkward. He didn't really know how to respond.'",
    choices: [
      "Al principio, la charla informal le resultaba incómoda. No sabía bien cómo responder.",
      "Al principio, la charla informal le resultar incómoda. No sabía responder.", // grammar: infinitive
      "Al principio, las conversaciones profundas le resultaban fáciles.",       // meaning: deep conversations/easy
      "Al principio, la charla informal le resultaba incómodo."                  // grammar: gender
    ],
    correctIndex: 0
  },
  {
    id: "l4-en-q9",
    prompt: "Translate: 'He felt that familiar rush. That dopamine hit.'",
    choices: [
      "Sintió esa emoción familiar. Ese golpe de dopamina.",
      "Sentir esa emoción familiar. Ese golpe de dopamina.",                     // grammar: infinitive
      "Sintió esa calma desconocida. Esa paz interior.",                         // meaning: unknown calm/peace
      "Sintió eso emoción familiar. Ese golpe de dopamina."                      // grammar: eso vs esa
    ],
    correctIndex: 0
  },
  {
    id: "l4-en-q10",
    prompt: "Translate: 'The city was in motion below, but it no longer felt like noise.'",
    choices: [
      "La ciudad se movía abajo, pero ya no se sentía como ruido.",
      "La ciudad se mover abajo, pero ya no se sentía como ruido.",              // grammar: infinitive
      "La ciudad estaba silenciosa abajo, y se sentía muy ruidosa.",             // meaning: silent/noisy
      "La ciudad se movía abajo, pero ya no se sentían como ruido."              // grammar: plural verb
    ],
    correctIndex: 0
  }
];

// For Spanish speakers learning English - translate Spanish to English
export const quizL4_es = [
  // From "The Last Word"
  {
    id: "l4-es-q1",
    prompt: "Traduce: 'Lo miró fijamente, escrito con marcador negro en la pizarra blanca.'",
    choices: [
      "She stared at it, written in black marker on the white board.",
      "She stare at it, written in black marker on the white board.",            // grammar: stare vs stared
      "She glanced at it quickly, written in pencil on the notebook.",           // meaning: glanced/pencil
      "She stared at it, writed in black marker on the white board."             // grammar: writed vs written
    ],
    correctIndex: 0
  },
  {
    id: "l4-es-q2",
    prompt: "Traduce: 'Estaba haciendo chistes y, de alguna manera, logró que la Revolución Francesa fuera graciosa.'",
    choices: [
      "He was cracking jokes and somehow made the French Revolution funny.",
      "He was crack jokes and somehow made the French Revolution funny.",        // grammar: crack vs cracking
      "He was telling stories and somehow made the class fall asleep.",          // meaning: stories/fall asleep
      "He was cracking jokes and somehow maked the French Revolution funny."     // grammar: maked vs made
    ],
    correctIndex: 0
  },
  {
    id: "l4-es-q3",
    prompt: "Traduce: 'Un destello de pánico le subió por el cuello.'",
    choices: [
      "A flash of panic flew up her neck.",
      "A flash of panic fly up her neck.",                                       // grammar: fly vs flew
      "A wave of calm went down her back.",                                      // meaning: calm/went down
      "A flash of panic flyed up her neck."                                      // grammar: flyed vs flew
    ],
    correctIndex: 0
  },
  {
    id: "l4-es-q4",
    prompt: "Traduce: 'Evitó el contacto visual con todos y planeó fingir estar enferma.'",
    choices: [
      "She avoided eye contact with everyone and planned to fake sick.",
      "She avoid eye contact with everyone and planned to fake sick.",           // grammar: avoid vs avoided
      "She sought eye contact with everyone and planned to go to school.",       // meaning: sought/go to school
      "She avoided eye contact with everyone and planed to fake sick."           // grammar: planed vs planned
    ],
    correctIndex: 0
  },
  {
    id: "l4-es-q5",
    prompt: "Traduce: 'Respiró — una respiración profunda y estable que se sintió como algo completamente nuevo.'",
    choices: [
      "She took a breath — a deep, steady breath that felt like something brand new.",
      "She take a breath — a deep, steady breath that felt like something brand new.", // grammar: take vs took
      "She held her breath — and felt dizzy and confused.",                      // meaning: held/dizzy
      "She took a breath — a deep, steady breath that feeled like something brand new." // grammar: feeled
    ],
    correctIndex: 0
  },
  // From "Diego Unplugged"
  {
    id: "l4-es-q6",
    prompt: "Traduce: 'El sonido del golpe contra la banqueta fue espantoso.'",
    choices: [
      "The sound of the phone hitting the sidewalk below was terrifying.",
      "The sound of the phone hit the sidewalk below was terrifying.",           // grammar: hit vs hitting
      "The silence after the phone fell was comforting.",                        // meaning: silence/comforting
      "The sound of the phone hitting the sidewalk below were terrifying."       // grammar: were vs was
    ],
    correctIndex: 0
  },
  {
    id: "l4-es-q7",
    prompt: "Traduce: 'Nada lograba mantener su atención. La comida no sabía bien. La música sonaba aburrida.'",
    choices: [
      "Nothing could hold his attention. Food didn't taste good. Music felt boring.",
      "Nothing can hold his attention. Food didn't taste good. Music felt boring.", // grammar: can vs could
      "Everything captured his attention. Food tasted delicious. Music was exciting.", // meaning: opposite
      "Nothing could held his attention. Food didn't taste good."                // grammar: held vs hold
    ],
    correctIndex: 0
  },
  {
    id: "l4-es-q8",
    prompt: "Traduce: 'Al principio, la charla informal le resultaba incómoda. No sabía bien cómo responder.'",
    choices: [
      "At first, small talk felt awkward. He didn't really know how to respond.",
      "At first, small talk feel awkward. He didn't really know how to respond.", // grammar: feel vs felt
      "At first, deep conversations felt easy for him.",                         // meaning: deep/easy
      "At first, small talk felt awkward. He didn't really knew how to respond." // grammar: knew vs know
    ],
    correctIndex: 0
  },
  {
    id: "l4-es-q9",
    prompt: "Traduce: 'Sintió esa emoción familiar. Ese golpe de dopamina.'",
    choices: [
      "He felt that familiar rush. That dopamine hit.",
      "He feel that familiar rush. That dopamine hit.",                          // grammar: feel vs felt
      "He felt that unknown calm. That inner peace.",                            // meaning: unknown/peace
      "He felt that familiar rush. That dopamine hitted."                        // grammar: hitted vs hit
    ],
    correctIndex: 0
  },
  {
    id: "l4-es-q10",
    prompt: "Traduce: 'La ciudad se movía abajo, pero ya no se sentía como ruido.'",
    choices: [
      "The city was in motion below, but it no longer felt like noise.",
      "The city were in motion below, but it no longer felt like noise.",        // grammar: were vs was
      "The city was silent below, and it felt very noisy.",                      // meaning: silent/noisy
      "The city was in motion below, but it no longer feeled like noise."        // grammar: feeled
    ],
    correctIndex: 0
  }
];
