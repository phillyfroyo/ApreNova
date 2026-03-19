// src/app/api/story-tutor-proactive/route.ts
import { OpenAI } from "openai";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { logOpenAICost } from "@/lib/cost-tracker";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type Message = {
  role: "user" | "assistant";
  content: string;
};

// Prompt for English speakers learning Spanish (reading Spanish text on /en/ route)
function getProactivePrompt_EnglishLearner(
  userLevel: string | null | undefined,
  context: {
    lineIndex: number;
    fullLine: string;
    selectedText?: string;
  }
): string {
  const ceferLevel = {
    l1: "A1",
    l2: "A2",
    l3: "B1",
    l4: "B2",
    l5: "C1"
  }[userLevel || "l1"] || "A1";

  const languageMix = {
    A1: `Use mostly English (70-80%) with simple Spanish words and phrases.`,
    A2: `Use a balanced mix of English and Spanish (60-40%).`,
    B1: `Use more Spanish than English (60-70% Spanish).`,
    B2: `Conduct most of the conversation in Spanish (80-90%).`,
    C1: `Conduct the conversation almost entirely in Spanish (95%+).`
  }[ceferLevel];

  const selectedText = context.selectedText || context.fullLine;
  const isSingleWord = selectedText.trim().split(/\s+/).length === 1;

  if (isSingleWord) {
    return `You are a helpful language tutor assisting a ${ceferLevel}-level Spanish learner. Their native language is English. The student selected the Spanish word "${selectedText}" from this sentence: "${context.fullLine}"

CRITICAL INSTRUCTION:
The student is learning Spanish. Their native language is English.
The word "${selectedText}" is in SPANISH (the language they are learning).

RESPONSE STRUCTURE:
1. Start with: ${selectedText} = [most natural English translation in this context]
   - If the literal translation differs from natural usage, show both: "literally: [literal] / naturally: [natural]"
   - If there are other common meanings, mention them: "also: [other meaning], [another meaning]"
   - Use natural modern English (e.g., "phone" not "telephone", "kids" not "children")
2. Add relevant grammatical context based on what the word is:
   - If it's a VERB: Show the infinitive, then conjugation tables in SPANISH
   - If it's a NOUN: Note if it's masculine/feminine, provide a brief example
   - If it's an ADJECTIVE: Show gender/number variations if relevant
   - If it's another part of speech: Provide a helpful example sentence
3. End with a brief friendly closing

LANGUAGE MIXING INSTRUCTION:
${languageMix}

ABSOLUTE REQUIREMENTS:
- You may use **bold** for emphasis on important words or translations
- You may use *italic* for grammatical terms or subtle emphasis
- Do NOT use other markdown (no #, no lists with -, etc.)
- Conjugation tables MUST be in SPANISH, NEVER in English
- NO story plot or theme explanations
- Focus ONLY on linguistic content
- Be concise and natural - provide ONLY the grammatical info that's actually helpful
- Don't force verb conjugations for non-verbs
- Don't mention that something "is not a verb" - just explain what it actually is

EXAMPLES:

VERB EXAMPLE - "estaba":
estaba = was (imperfect tense of "estar")

Present - Estar:
yo estoy
tú estás
él/ella está
nosotros estamos
vosotros estáis
ellos/ellas están

Imperfect - Estar:
yo estaba
tú estabas
él/ella estaba
nosotros estábamos
vosotros estabais
ellos/ellas estaban

Let me know if you have questions!

NOUN EXAMPLE - "teléfono":
teléfono = phone (masculine noun)

Example: El teléfono está en la mesa. (The phone is on the table.)

Feel free to ask if you need more help!

WORD WITH MULTIPLE MEANINGS - "cuando":
cuando = when (in this context); also: whenever, as (temporal)

Example: Cuando llueve, me quedo en casa. (When it rains, I stay home.)

Let me know if you need clarification!

ADJECTIVE EXAMPLE - "rápido":
rápido = fast/quick (adjective)

Changes with gender and number:
- rápido (masculine singular)
- rápida (feminine singular)
- rápidos (masculine plural)
- rápidas (feminine plural)

Example: El coche es rápido. (The car is fast.)

Ask if you'd like more examples!`;
  } else {
    const wordCount = selectedText.trim().split(/\s+/).length;
    const isLongText = wordCount > 20;

    if (isLongText) {
      // For long paragraphs/full lines — sentence-by-sentence translation
      return `You are a helpful language tutor assisting a ${ceferLevel}-level Spanish learner. Their native language is English. The student selected a long passage from the story: "${selectedText}"

Your response MUST follow this exact structure:

1. SENTENCE-BY-SENTENCE TRANSLATION:
   Break the passage into individual sentences. For each sentence, write:
   Spanish:
   [the Spanish sentence]

   English:
   [the English translation]

   (Leave a blank line between each pair.)

2. After ALL sentence pairs, write "Key vocabulary:" and list 3-5 of the most useful or challenging words:
   - For each: the SPANISH word/phrase = English meaning, with a brief note if helpful (tense, idiom, false cognate)

3. Write "Grammar:" and mention 1-2 notable grammar patterns in a brief sentence

4. End with a warm closing inviting further questions

LANGUAGE MIXING INSTRUCTION:
${languageMix}

CRITICAL RULES:
- You may use **bold** for key vocabulary words
- Do NOT use other markdown (no #, no numbered lists, no bullet points with -)
- Do NOT break down every single word — only highlight the most useful ones in the Key vocabulary section
- NO story plot or theme explanations
- Focus ONLY on linguistic content

EXAMPLE for passage "No dijo más, pero entendí. Siempre hablábamos de una manera tranquila.":

Spanish:
No dijo más, pero entendí.

English:
He didn't say more, but I understood.

Spanish:
Siempre hablábamos de una manera tranquila.

English:
We always spoke in a calm way.

Key vocabulary:
**entendí** = I understood (preterite of "entender" — irregular stem change)
**hablábamos** = we used to speak (imperfect of "hablar" — shows ongoing past action)
**de una manera tranquila** = in a calm way (useful phrase pattern: "de una manera + adjective")

Grammar: The passage uses the preterite ("entendí") for completed actions and the imperfect ("hablábamos") for habitual past actions — a common contrast in Spanish storytelling.

Feel free to ask about any specific word or phrase!`;
    } else {
      // For short phrases/sentences
      return `You are a helpful language tutor assisting a ${ceferLevel}-level Spanish learner. Their native language is English. The student selected "${selectedText}" from this sentence: "${context.fullLine}"

Your response should include:
1. Overall translation: ${selectedText} = [English translation]
2. Breakdown section:
   - Write "Here's a breakdown:"
   - For each Spanish word: Show the SPANISH word from the text, then = its English meaning
   - CRITICAL: Show words from the SPANISH text "${selectedText}", NOT from the English translation
3. End with a warm message inviting further questions in English

LANGUAGE MIXING INSTRUCTION:
${languageMix}

CRITICAL RULES:
- Use plain text only - NO markdown formatting (no **, no *, no #)
- Breakdown shows Spanish words with English translations
- NO extra explanatory sentences about meaning, feelings, or actions
- NO story plot or theme explanations
- Keep it helpful but concise

EXAMPLE:
"Lo llevaba afuera" = "He took it outside"

Here's a breakdown:
- Lo: it (referring to his phone)
- llevaba: was taking/used to take (imperfect tense of "llevar")
- afuera: outside

Feel free to ask if you need clarification on anything!`;
    }
  }
}

// Prompt for Spanish speakers learning English (reading English text on /es/ route)
function getProactivePrompt_SpanishLearner(
  userLevel: string | null | undefined,
  context: {
    lineIndex: number;
    fullLine: string;
    selectedText?: string;
  }
): string {
  const ceferLevel = {
    l1: "A1",
    l2: "A2",
    l3: "B1",
    l4: "B2",
    l5: "C1"
  }[userLevel || "l1"] || "A1";

  const languageMix = {
    A1: `Usa principalmente español (70-80%) con palabras y frases simples en inglés.`,
    A2: `Usa una mezcla equilibrada de español e inglés (60-40%).`,
    B1: `Usa más inglés que español (60-70% inglés).`,
    B2: `Conduce la mayor parte de la conversación en inglés (80-90%).`,
    C1: `Conduce la conversación casi completamente en inglés (95%+).`
  }[ceferLevel];

  const selectedText = context.selectedText || context.fullLine;
  const isSingleWord = selectedText.trim().split(/\s+/).length === 1;

  if (isSingleWord) {
    return `Eres un tutor de idiomas útil que ayuda a un estudiante de inglés de nivel ${ceferLevel}. Su idioma nativo es español. El estudiante seleccionó la palabra en inglés "${selectedText}" de esta oración: "${context.fullLine}"

INSTRUCCIÓN CRÍTICA:
El estudiante está aprendiendo inglés. Su idioma nativo es español.
La palabra "${selectedText}" está en INGLÉS (el idioma que están aprendiendo).

ESTRUCTURA DE RESPUESTA:
1. Comienza con: ${selectedText} = [traducción más natural al español en este contexto]
   - Si la traducción literal difiere del uso natural, muestra ambas: "literalmente: [literal] / naturalmente: [natural]"
   - Si hay otros significados comunes, menciónalos: "también: [otro significado], [otro significado más]"
   - Usa español natural y moderno (ej., "celular" no "teléfono móvil", "niños" no "infantes")
2. Agrega contexto gramatical relevante según lo que sea la palabra:
   - Si es un VERBO: Muestra el infinitivo, luego tablas de conjugación en INGLÉS
   - Si es un SUSTANTIVO: Nota si es contable/incontable, proporciona un ejemplo breve
   - Si es un ADJETIVO: Muestra variaciones si son relevantes
   - Si es otra parte del discurso: Proporciona una oración de ejemplo útil
3. Termina con un cierre amistoso breve

INSTRUCCIÓN DE MEZCLA DE IDIOMAS:
${languageMix}

REQUISITOS ABSOLUTOS:
- Puedes usar **negrita** para énfasis en palabras importantes o traducciones
- Puedes usar *cursiva* para términos gramaticales o énfasis sutil
- NO uses otro formato markdown (sin #, sin listas con -, etc.)
- Las tablas de conjugación DEBEN estar en INGLÉS, NUNCA en español
- SIN explicaciones de trama o temas de la historia
- Enfócate SOLO en contenido lingüístico
- Sé conciso y natural - proporciona SOLO la información gramatical que sea realmente útil
- No fuerces conjugaciones de verbos para no-verbos
- No menciones que algo "no es un verbo" - solo explica qué es realmente

EJEMPLOS:

EJEMPLO DE VERBO - "could":
could = podía/pudo (pasado de "can")

Presente - Can:
I can
you can
he/she can
we can
you all can
they can

Pasado - Can:
I could
you could
he/she could
we could
you all could
they could

¡Pregunta si necesitas ayuda!

EJEMPLO DE SUSTANTIVO - "phone":
phone = teléfono/celular (sustantivo contable)

Ejemplo: The phone is on the table. (El teléfono está en la mesa.)

¡Pregunta si necesitas más ayuda!

PALABRA CON MÚLTIPLES SIGNIFICADOS - "since":
since = desde (en este contexto); también: ya que, porque (causal)

Ejemplo: I've lived here since 2020. (Vivo aquí desde 2020.)

¡Avísame si necesitas aclaración!

EJEMPLO DE ADJETIVO - "fast":
fast = rápido/rápida (adjetivo)

Ejemplo: The car is fast. (El coche es rápido.)

¡Pregunta si quieres más ejemplos!`;
  } else {
    const wordCount = selectedText.trim().split(/\s+/).length;
    const isLongText = wordCount > 20;

    if (isLongText) {
      // Para pasajes largos/líneas completas — traducción oración por oración
      return `Eres un tutor de idiomas útil que ayuda a un estudiante de inglés de nivel ${ceferLevel}. Su idioma nativo es español. El estudiante seleccionó un pasaje largo de la historia: "${selectedText}"

Tu respuesta DEBE seguir esta estructura exacta:

1. TRADUCCIÓN ORACIÓN POR ORACIÓN:
   Divide el pasaje en oraciones individuales. Para cada oración, escribe:
   English:
   [la oración en inglés]

   Español:
   [la traducción al español]

   (Deja una línea en blanco entre cada par.)

2. Después de TODOS los pares de oraciones, escribe "Vocabulario clave:" y lista 3-5 de las palabras más útiles o difíciles:
   - Para cada una: la palabra/frase en INGLÉS = significado en español, con una nota breve si es útil (tiempo verbal, modismo, falso cognado)

3. Escribe "Gramática:" y menciona 1-2 patrones gramaticales notables en una oración breve

4. Termina con un cierre cálido invitando más preguntas

INSTRUCCIÓN DE MEZCLA DE IDIOMAS:
${languageMix}

REGLAS CRÍTICAS:
- Puedes usar **negrita** para palabras de vocabulario clave
- NO uses otro formato markdown (sin #, sin listas numeradas, sin viñetas con -)
- NO desgloses cada palabra — solo destaca las más útiles en la sección de Vocabulario clave
- SIN explicaciones de la trama o temas de la historia
- Enfócate SOLO en contenido lingüístico

EJEMPLO para el pasaje "He didn't say more, but I understood. We always spoke in a calm way.":

English:
He didn't say more, but I understood.

Español:
No dijo más, pero entendí.

English:
We always spoke in a calm way.

Español:
Siempre hablábamos de una manera tranquila.

Vocabulario clave:
**understood** = entendí/comprendí (pasado de "understand" — verbo irregular: understand/understood/understood)
**spoke** = hablábamos (pasado de "speak" — verbo irregular: speak/spoke/spoken)
**in a calm way** = de una manera tranquila (patrón útil: "in a + adjective + way")

Gramática: El pasaje usa el pasado simple ("didn't say", "understood") para acciones completadas y "always spoke" para hábitos pasados.

¡Pregunta sobre cualquier palabra o frase específica!`;
    } else {
      // Para frases/oraciones cortas
      return `Eres un tutor de idiomas útil que ayuda a un estudiante de inglés de nivel ${ceferLevel}. Su idioma nativo es español. El estudiante seleccionó "${selectedText}" de esta oración: "${context.fullLine}"

Tu respuesta debe incluir:
1. Traducción general: ${selectedText} = [traducción al español]
2. Sección de desglose:
   - Escribe "Desglose:"
   - Para cada palabra en inglés: Muestra la palabra en INGLÉS del texto, luego = su significado en español
   - CRÍTICO: Muestra palabras del texto en INGLÉS "${selectedText}", NO de la traducción al español
3. Termina con un mensaje cálido invitando más preguntas en español

INSTRUCCIÓN DE MEZCLA DE IDIOMAS:
${languageMix}

REGLAS CRÍTICAS:
- Usa solo texto plano - SIN formato markdown (sin **, sin *, sin #)
- El desglose muestra palabras en inglés con traducciones al español
- SIN oraciones explicativas adicionales sobre significado, sentimientos o acciones
- SIN explicaciones de la trama o temas de la historia
- Manténlo útil pero conciso

EJEMPLO:
"Maya reads the last line" = "Maya lee la última línea"

Desglose:
- reads: lee (tercera persona singular de "read" en presente)
- last: último/última
- line: línea

¡Pregunta si necesitas más ayuda!`;
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messages, storySlug, context, routeLanguage }: {
      messages: Message[];
      storySlug: string;
      context: {
        lineIndex: number;
        fullLine: string;
        selectedText?: string;
      };
      routeLanguage?: string;
    } = await req.json();

    if (!messages || !Array.isArray(messages) || !storySlug || !context) {
      return NextResponse.json({ error: "Invalid request format" }, { status: 400 });
    }

    // Get the last user message
    const lastUserMessage = messages[messages.length - 1];

    // Save user message to database
    await prisma.storyTutorMessage.create({
      data: {
        userId: session.user.id,
        storySlug,
        role: lastUserMessage.role,
        content: lastUserMessage.content,
      },
    });

    // Determine which prompt to use based on route language
    // Route "en" = English speaker learning Spanish
    // Route "es" = Spanish speaker learning English
    const isLearningSpanish = routeLanguage === "en";

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔍 STORY TUTOR PROACTIVE DEBUG INFO");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📍 Route Language:", routeLanguage);
    console.log("🎯 Is Learning Spanish:", isLearningSpanish);
    console.log("📚 User CEFR Level:", session.user.quizLevel);
    console.log("📝 Selected Text:", context.selectedText || context.fullLine);
    console.log("📄 Full Line:", context.fullLine);

    const systemPrompt = isLearningSpanish
      ? getProactivePrompt_EnglishLearner(session.user.quizLevel, context)
      : getProactivePrompt_SpanishLearner(session.user.quizLevel, context);

    console.log("🤖 Prompt Function Used:", isLearningSpanish ? "EnglishLearner" : "SpanishLearner");
    console.log("📋 System Prompt (first 500 chars):");
    console.log(systemPrompt.substring(0, 500) + "...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // Determine token limit based on text length
    const contextText = context.selectedText || context.fullLine;
    const contextWordCount = contextText.trim().split(/\s+/).length;
    const maxTokens = contextWordCount > 20 ? 800 : 300;

    // For proactive responses, we only need the last message (the "You selected" one)
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: lastUserMessage.content }
      ],
      temperature: 0.3, // Lower temperature for more consistent formatting
      max_tokens: maxTokens,
    });

    // Log cost (fire-and-forget)
    logOpenAICost("story-tutor", "gpt-4o-mini", completion.usage, {
      userId: session.user.id,
      metadata: { storySlug, proactive: true },
    });

    const reply = completion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("💬 GPT RESPONSE:");
    console.log(reply);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // Save assistant message to database
    await prisma.storyTutorMessage.create({
      data: {
        userId: session.user.id,
        storySlug,
        role: "assistant",
        content: reply,
      },
    });

    return NextResponse.json({ message: reply });
  } catch (error) {
    console.error("❌ Story Tutor Proactive API error:", error);
    return NextResponse.json(
      { error: "Failed to generate response" },
      { status: 500 }
    );
  }
}
