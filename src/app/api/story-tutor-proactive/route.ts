// src/app/api/story-tutor-proactive/route.ts
import { OpenAI } from "openai";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";

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

Your response MUST include:
1. Translation: ${selectedText} = [English translation]
2. Root word (if applicable): [Spanish infinitive] = [English translation]
3. Conjugation table (ONLY if it's a verb):
   - YOU MUST show SPANISH conjugations - the language they're learning!
   - DO NOT show English conjugations - they already know English!
   - Present tense verb: Show ONLY present tense in SPANISH
   - Any other tense: Show BOTH that tense AND present tense in SPANISH
   - Use Spanish pronouns: yo, tú, él/ella, nosotros, vosotros, ellos/ellas
4. End with a warm message inviting further questions in English

LANGUAGE MIXING INSTRUCTION:
${languageMix}

ABSOLUTE REQUIREMENTS:
- Use plain text only - absolutely NO markdown formatting (no **, no *, no #)
- Conjugation tables MUST be in SPANISH, NEVER in English
- NO story plot or theme explanations
- Focus ONLY on linguistic content
- Be concise but helpful

EXAMPLE - "estaba":
estaba = was

Root word:
estar = to be

Imperfect Tense - Estar:
yo estaba
tú estabas
él/ella estaba
nosotros estábamos
vosotros estabais
ellos/ellas estaban

Present Tense - Estar:
yo estoy
tú estás
él/ella está
nosotros estamos
vosotros estáis
ellos/ellas están

Let me know if you have any other questions!`;
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
    return `REGLA #1 - LA MÁS IMPORTANTE DE TODAS:
SI LA PALABRA "${selectedText}" ES UN VERBO EN INGLÉS, LAS CONJUGACIONES DEBEN SER EN INGLÉS.
NUNCA escribas "yo pude, tú pudiste, él pudo" - esto es ESPAÑOL.
SIEMPRE escribe "I could, you could, he/she could" - esto es INGLÉS.

REGLA #2 - FORMATO:
NO uses ** para negrita. NO uses * para cursiva. Solo texto plano.

Eres un tutor de idiomas que ayuda a un estudiante de inglés de nivel ${ceferLevel}. Su idioma nativo es español. El estudiante seleccionó la palabra en inglés "${selectedText}" de esta oración: "${context.fullLine}"

RECORDATORIO CRÍTICO:
- "${selectedText}" es una palabra en INGLÉS (no en español)
- El estudiante está APRENDIENDO inglés
- Por lo tanto, si es un verbo, muestra conjugaciones en INGLÉS
- INCORRECTO: yo pude, tú pudiste, él/ella pudo (esto es español)
- CORRECTO: I could, you could, he/she could (esto es inglés)

Tu respuesta DEBE incluir:
1. Traducción: ${selectedText} = [traducción al español]
2. Palabra raíz (si es verbo): [infinitivo en INGLÉS] = [traducción]
3. Conjugaciones (SOLO si es un verbo):
   - Usa pronombres en INGLÉS: I, you, he/she, we, you all, they
   - Muestra el verbo conjugado en INGLÉS
   - Si no es presente, muestra ese tiempo Y el presente
4. Mensaje final invitando más preguntas

INSTRUCCIÓN DE MEZCLA DE IDIOMAS:
${languageMix}

EJEMPLOS DE LO QUE DEBES HACER:

EJEMPLO CORRECTO para "could":
could = podía/pudo

Palabra raíz:
can = poder

Pasado - Can:
I could
you could
he/she could
we could
you all could
they could

Presente - Can:
I can
you can
he/she can
we can
you all can
they can

Pregunta si necesitas ayuda.

EJEMPLO INCORRECTO (NO HAGAS ESTO):
Pasado (Could) - Poder:
yo pude
tú pudiste
él/ella pudo

Presente (Can) - Poder:
yo puedo
tú puedes
él/ella puede`;
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
