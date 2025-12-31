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
    // For phrases/sentences
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
    // Para frases/oraciones
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

    // For proactive responses, we only need the last message (the "You selected" one)
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: lastUserMessage.content }
      ],
      temperature: 0.3, // Lower temperature for more consistent formatting
      max_tokens: 300,
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
