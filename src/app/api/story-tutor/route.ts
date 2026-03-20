// src/app/api/story-tutor/route.ts
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

// Prompt for English speakers learning Spanish
function getConversationalPrompt_EnglishLearner(
  userLevel: string | null | undefined,
  currentPageText: string[],
  context?: {
    lineIndex: number;
    fullLine: string;
    selectedText?: string;
  } | null
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

  let contextSection = "";
  if (context?.selectedText) {
    const wordCount = context.selectedText.trim().split(/\s+/).length;
    const isSingleWord = wordCount === 1;
    const isLongText = wordCount > 20;
    const verbInstruction = isSingleWord
      ? `\n\nIMPORTANT: If "${context.selectedText}" is a verb, provide a full SPANISH conjugation table:
- If the verb in the story is in PRESENT tense: Show the present tense conjugation table in Spanish
- If the verb in ANY OTHER tense: Show BOTH that tense AND present tense tables in Spanish
- Use Spanish pronouns: yo, tú, él/ella, nosotros, vosotros, ellos/ellas`
      : "";
    const longTextInstruction = isLongText
      ? `\n\nIMPORTANT: This is a long passage. Do NOT break down every word. Instead:
- Translate SENTENCE BY SENTENCE: For each sentence, show "Spanish:" then the Spanish sentence, then "English:" then the translation, with a blank line between each pair
- After all sentence pairs, show "Key vocabulary:" with 3-5 key/difficult words
- Then "Grammar:" with 1-2 notable grammar patterns in a brief sentence`
      : "";

    contextSection = `\n
IMMEDIATE FOCUS:
The student has selected the following Spanish text from line ${context.lineIndex + 1}: "${context.selectedText}"
This is from the full sentence: "${context.fullLine}"
Start by focusing on this specific phrase/word unless they ask something else.${verbInstruction}${longTextInstruction}`;
  } else if (context) {
    const wordCount = context.fullLine.trim().split(/\s+/).length;
    const isLongText = wordCount > 20;
    const longTextInstruction = isLongText
      ? `\nIMPORTANT: This is a long passage. Do NOT break down every word. Instead:
- Translate SENTENCE BY SENTENCE: For each sentence, show "Spanish:" then the Spanish sentence, then "English:" then the translation, with a blank line between each pair
- After all sentence pairs, show "Key vocabulary:" with 3-5 key/difficult words
- Then "Grammar:" with 1-2 notable grammar patterns in a brief sentence`
      : "";

    contextSection = `\n
IMMEDIATE FOCUS:
The student is asking about line ${context.lineIndex + 1}: "${context.fullLine}"
Start by focusing on this sentence unless they ask something else.${longTextInstruction}`;
  }

  return `You are a helpful language tutor assisting a ${ceferLevel}-level Spanish learner who is reading a story. Their native language is English.

CRITICAL FORMATTING RULES:
1. You may use **bold** for emphasis on important words or translations
2. You may use *italic* for grammatical terms or subtle emphasis
3. Do NOT use other markdown (no #, no lists with -, etc.)
4. Do NOT explain how text relates to the story's plot, themes, or character development
5. Focus ONLY on linguistic content: translations, grammar, vocabulary
6. Keep responses concise and educational

CURRENT PAGE CONTEXT:
The student is currently reading the following Spanish text:
${currentPageText.map((line, i) => `${i + 1}. ${line}`).join('\n')}${contextSection}

YOUR ROLE:
- Answer questions about vocabulary, grammar, cultural context, or story comprehension
- Provide explanations appropriate to their ${ceferLevel} level
- ${languageMix}
- Be encouraging and patient
- Keep responses concise and focused (2-3 sentences for word explanations, slightly longer for complex questions)

GUIDELINES:
- If they send a message like "You selected '[text]'", this means they clicked on that Spanish text and want help understanding it
- If they ask about a word or phrase, explain it in context with a simple example
- If they ask about grammar, give clear, simple explanations with examples in Spanish
- If asking about a Spanish verb, provide conjugation tables in SPANISH, not English
- Focus on the linguistic content - translations, grammar, vocabulary
- You may use **bold** and *italic* for emphasis, but avoid other markdown formatting`;
}

// Prompt for Spanish speakers learning English
function getConversationalPrompt_SpanishLearner(
  userLevel: string | null | undefined,
  currentPageText: string[],
  context?: {
    lineIndex: number;
    fullLine: string;
    selectedText?: string;
  } | null
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

  let contextSection = "";
  if (context?.selectedText) {
    const wordCount = context.selectedText.trim().split(/\s+/).length;
    const isSingleWord = wordCount === 1;
    const isLongText = wordCount > 20;
    const verbInstruction = isSingleWord
      ? `\n\nRECORDATORIO CRÍTICO SOBRE CONJUGACIONES:
- "${context.selectedText}" es una palabra en INGLÉS (el idioma que el estudiante está aprendiendo)
- Si es un verbo, las conjugaciones DEBEN ser en INGLÉS
- NUNCA uses conjugaciones en español (yo pude, tú pudiste, etc.)
- SIEMPRE usa conjugaciones en inglés (I could, you could, etc.)
- Usa pronombres en inglés: I, you, he/she, we, you all, they
- Si el verbo NO está en presente: Muestra AMBAS tablas (ese tiempo Y el presente) en inglés`
      : "";
    const longTextInstruction = isLongText
      ? `\n\nIMPORTANTE: Este es un pasaje largo. NO desgloses cada palabra. En su lugar:
- Traduce ORACIÓN POR ORACIÓN: Para cada oración, muestra "English:" luego la oración en inglés, luego "Español:" luego la traducción, con una línea en blanco entre cada par
- Después de todos los pares, muestra "Vocabulario clave:" con 3-5 palabras clave/difíciles
- Luego "Gramática:" con 1-2 patrones gramaticales notables en una oración breve`
      : "";

    contextSection = `\n
ENFOQUE INMEDIATO:
El estudiante ha seleccionado el siguiente texto en inglés de la línea ${context.lineIndex + 1}: "${context.selectedText}"
Esto es de la oración completa: "${context.fullLine}"
Comienza enfocándote en esta frase/palabra específica a menos que pregunten otra cosa.${verbInstruction}${longTextInstruction}`;
  } else if (context) {
    const wordCount = context.fullLine.trim().split(/\s+/).length;
    const isLongText = wordCount > 20;
    const longTextInstruction = isLongText
      ? `\nIMPORTANTE: Este es un pasaje largo. NO desgloses cada palabra. En su lugar:
- Traduce ORACIÓN POR ORACIÓN: Para cada oración, muestra "English:" luego la oración en inglés, luego "Español:" luego la traducción, con una línea en blanco entre cada par
- Después de todos los pares, muestra "Vocabulario clave:" con 3-5 palabras clave/difíciles
- Luego "Gramática:" con 1-2 patrones gramaticales notables en una oración breve`
      : "";

    contextSection = `\n
ENFOQUE INMEDIATO:
El estudiante está preguntando sobre la línea ${context.lineIndex + 1}: "${context.fullLine}"
Comienza enfocándote en esta oración a menos que pregunten otra cosa.${longTextInstruction}`;
  }

  return `REGLA #1 - LA MÁS IMPORTANTE:
SI UNA PALABRA ES UN VERBO EN INGLÉS, LAS CONJUGACIONES DEBEN SER EN INGLÉS.
NUNCA escribas "yo pude, tú pudiste, él pudo" - esto es ESPAÑOL.
SIEMPRE escribe "I could, you could, he/she could" - esto es INGLÉS.

REGLA #2 - FORMATO:
NO uses ** para negrita. NO uses * para cursiva. Solo texto plano.

Eres un tutor de idiomas útil que ayuda a un estudiante de inglés de nivel ${ceferLevel} que está leyendo una historia. Su idioma nativo es español.

REGLAS CRÍTICAS DE FORMATO:
1. Puedes usar **negrita** para énfasis en palabras importantes o traducciones
2. Puedes usar *cursiva* para términos gramaticales o énfasis sutil
3. NO uses otro formato markdown (sin #, sin listas con -, etc.)
4. NO expliques cómo el texto se relaciona con la trama, temas o desarrollo de personajes de la historia
5. Enfócate SOLO en contenido lingüístico: traducciones, gramática, vocabulario
6. Mantén las respuestas concisas y educativas

CONTEXTO DE LA PÁGINA ACTUAL:
El estudiante está leyendo actualmente el siguiente texto en inglés:
${currentPageText.map((line, i) => `${i + 1}. ${line}`).join('\n')}${contextSection}

TU ROL:
- Responde preguntas sobre vocabulario, gramática, contexto cultural o comprensión de la historia
- Proporciona explicaciones apropiadas para su nivel ${ceferLevel}
- ${languageMix}
- Sé alentador y paciente
- Mantén las respuestas concisas y enfocadas (2-3 oraciones para explicaciones de palabras, un poco más largas para preguntas complejas)

PAUTAS:
- Si envían un mensaje como "Seleccionaste '[texto]'", esto significa que hicieron clic en ese texto en inglés y quieren ayuda para entenderlo
- Si preguntan sobre una palabra o frase, explícala en contexto con un ejemplo simple
- Si preguntan sobre gramática, da explicaciones claras y simples con ejemplos en inglés
- Si preguntan sobre un verbo en inglés, proporciona tablas de conjugación en INGLÉS, no en español
- Enfócate en el contenido lingüístico - traducciones, gramática, vocabulario
- Puedes usar **negrita** y *cursiva* para énfasis, pero evita otro formato markdown

EJEMPLO CORRECTO para el verbo "could":
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

EJEMPLO INCORRECTO (NO HAGAS ESTO):
Pasado (Could) - Poder:
yo pude
tú pudiste
él/ella pudo`;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messages, storySlug, currentPageText, context, routeLanguage }: {
      messages: Message[];
      storySlug: string;
      currentPageText: string[];
      context?: {
        lineIndex: number;
        fullLine: string;
        selectedText?: string;
      } | null;
      routeLanguage?: string;
    } = await req.json();

    if (!messages || !Array.isArray(messages) || !storySlug) {
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
    console.log("🔍 STORY TUTOR CONVERSATIONAL DEBUG INFO");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📍 Route Language:", routeLanguage);
    console.log("🎯 Is Learning Spanish:", isLearningSpanish);
    console.log("📚 User CEFR Level:", session.user.quizLevel);
    console.log("📝 Context Selected Text:", context?.selectedText || "N/A");
    console.log("📄 Context Full Line:", context?.fullLine || "N/A");
    console.log("💬 Total Messages:", messages.length);
    console.log("💬 Last User Message:", messages[messages.length - 1]?.content || "N/A");

    const systemPrompt = isLearningSpanish
      ? getConversationalPrompt_EnglishLearner(session.user.quizLevel, currentPageText || [], context)
      : getConversationalPrompt_SpanishLearner(session.user.quizLevel, currentPageText || [], context);

    console.log("🤖 Prompt Function Used:", isLearningSpanish ? "EnglishLearner" : "SpanishLearner");
    console.log("📋 System Prompt (first 500 chars):");
    console.log(systemPrompt.substring(0, 500) + "...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // Only send last 50 messages to OpenAI to manage context window
    const recentMessages = messages.slice(-50);

    // Bump token limit for long text contexts
    const contextText = context?.selectedText || context?.fullLine || "";
    const contextWordCount = contextText.trim().split(/\s+/).length;
    const maxTokens = contextWordCount > 20 ? 800 : 300;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...recentMessages.map(m => ({ role: m.role, content: m.content }))
      ],
      temperature: 0.7,
      max_tokens: maxTokens,
    });

    // Log cost (fire-and-forget)
    logOpenAICost("story-tutor", "gpt-4o-mini", completion.usage, {
      userId: session.user.id,
      metadata: { storySlug },
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

    // Cleanup: Keep only last 500 messages per user per story
    const messageCount = await prisma.storyTutorMessage.count({
      where: {
        userId: session.user.id,
        storySlug,
      },
    });

    if (messageCount > 500) {
      const oldMessages = await prisma.storyTutorMessage.findMany({
        where: {
          userId: session.user.id,
          storySlug,
        },
        orderBy: { createdAt: "asc" },
        take: messageCount - 500,
        select: { id: true },
      });

      await prisma.storyTutorMessage.deleteMany({
        where: {
          id: { in: oldMessages.map((m) => m.id) },
        },
      });
    }

    return NextResponse.json({ message: reply });
  } catch (error) {
    console.error("❌ Story Tutor API error:", error);
    return NextResponse.json(
      { error: "Failed to generate response" },
      { status: 500 }
    );
  }
}

// GET endpoint to load story-specific conversation history
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const storySlug = searchParams.get('storySlug');

    if (!storySlug) {
      return NextResponse.json({ error: "Story slug required" }, { status: 400 });
    }

    // Load last 100 messages for this story
    const messages = await prisma.storyTutorMessage.findMany({
      where: {
        userId: session.user.id,
        storySlug,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    // Reverse to chronological order
    const chronologicalMessages = messages.reverse().map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    return NextResponse.json({ messages: chronologicalMessages });
  } catch (error) {
    console.error("❌ Error loading story conversation history:", error);
    return NextResponse.json(
      { error: "Failed to load conversation history" },
      { status: 500 }
    );
  }
}
