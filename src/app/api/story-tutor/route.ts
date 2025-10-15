// src/app/api/story-tutor/route.ts
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

function getStoryTutorSystemPrompt(
  userLevel: string | null | undefined,
  nativeLanguage: string | null | undefined,
  currentPageText: string[],
  context?: {
    lineIndex: number;
    fullLine: string;
    selectedText?: string;
  } | null,
  isInitialProactiveResponse?: boolean
): string {
  // Map quiz levels to CEFR levels
  const ceferLevel = {
    l1: "A1",
    l2: "A2",
    l3: "B1",
    l4: "B2",
    l5: "C1"
  }[userLevel || "l1"] || "A1";

  const isLearningSpanish = nativeLanguage === "en";
  const targetLanguage = isLearningSpanish ? "Spanish" : "English";
  const nativeLang = isLearningSpanish ? "English" : "Spanish";

  const languageMix = {
    A1: `Use mostly ${nativeLang} (70-80%) with simple ${targetLanguage} words and phrases.`,
    A2: `Use a balanced mix of ${nativeLang} and ${targetLanguage} (60-40%).`,
    B1: `Use more ${targetLanguage} than ${nativeLang} (60-70% ${targetLanguage}).`,
    B2: `Conduct most of the conversation in ${targetLanguage} (80-90%).`,
    C1: `Conduct the conversation almost entirely in ${targetLanguage} (95%+).`
  }[ceferLevel];

  // Add context-specific focus if provided
  let contextSection = "";
  if (context) {
    if (context.selectedText) {
      const isSingleWord = context.selectedText.trim().split(/\s+/).length === 1;

      // Special formatting for initial proactive response
      if (isInitialProactiveResponse && isSingleWord) {
        contextSection = `\n**INITIAL PROACTIVE RESPONSE - USE THIS EXACT FORMAT:**
The student selected: "${context.selectedText}" from line ${context.lineIndex + 1}

You MUST respond in this format (no introductory text, start immediately with the word):

${context.selectedText} = [translation in ${nativeLang}]

Root word:
[infinitive form] = [translation in ${nativeLang}]

[If it's a verb, include conjugation table(s) as specified below]

CONJUGATION TABLE RULES:
- If the verb in the story is in PRESENT tense: Show ONLY the present tense conjugation table
- If the verb in ANY OTHER tense: Show BOTH that tense's table AND present tense for reference
- Format tables with all persons (yo, tú, él/ella, nosotros, vosotros, ellos/ellas for Spanish OR I, you, he/she, we, you all, they for English)
- Keep explanations minimal - focus on the format above
- Use plain text only - NO markdown formatting like ** or *
- DO NOT add story context or plot explanations

EXAMPLE for "estaba" (imperfect tense):
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

Let me know if you need anything else!`;
      } else if (isInitialProactiveResponse) {
        // For phrases or non-single words
        contextSection = `\n**INITIAL PROACTIVE RESPONSE:**
The student selected: "${context.selectedText}" from line ${context.lineIndex + 1}

Explain this phrase concisely:
${context.selectedText} = [translation in ${nativeLang}]

Provide a brief explanation of the phrase's meaning and usage.
- Use plain text only - NO markdown formatting like ** or *
- DO NOT add story context or plot explanations
- Focus only on the linguistic meaning`;
      } else {
        // Regular conversational mode
        const verbInstruction = isSingleWord
          ? `\n\nIMPORTANT: If "${context.selectedText}" is a verb, provide a full conjugation table:
- If the verb in the story is in PRESENT tense: Show the present tense conjugation table
- If the verb in the story is in ANY OTHER tense (past, imperfect, future, conditional, subjunctive, etc.): Show BOTH the conjugation table for that tense AND the present tense table for reference
- Format the table clearly with all persons (yo, tú, él/ella, nosotros, vosotros, ellos/ellas for Spanish OR I, you, he/she, we, you all, they for English)
- After the conjugation table(s), you may briefly explain usage in context if helpful`
          : "";

        contextSection = `\n**Immediate Focus:**
The student has selected the following text from line ${context.lineIndex + 1}: "${context.selectedText}"
This is from the full sentence: "${context.fullLine}"
Start by focusing on this specific phrase/word unless they ask something else.${verbInstruction}`;
      }
    } else {
      if (isInitialProactiveResponse) {
        contextSection = `\n**INITIAL PROACTIVE RESPONSE:**
The student is asking about line ${context.lineIndex + 1}: "${context.fullLine}"

Explain this sentence concisely and break down any challenging vocabulary.
- Use plain text only - NO markdown formatting like ** or *
- DO NOT add story context or plot explanations
- Focus only on the linguistic content`;
      } else {
        contextSection = `\n**Immediate Focus:**
The student is asking about line ${context.lineIndex + 1}: "${context.fullLine}"
Start by focusing on this sentence unless they ask something else.`;
      }
    }
  }

  return `You are a helpful language tutor assisting a ${ceferLevel}-level ${targetLanguage} learner who is reading a story. Their native language is ${nativeLang}.

**Current Page Context:**
The student is currently reading the following text:
${currentPageText.map((line, i) => `${i + 1}. ${line}`).join('\n')}${contextSection}

**Your Role:**
- Answer questions about vocabulary, grammar, cultural context, or story comprehension
- Provide explanations appropriate to their ${ceferLevel} level
- ${languageMix}
- Be encouraging and patient
- Keep responses concise and focused (2-3 sentences for word explanations, slightly longer for complex questions)

**Guidelines:**
- If they send a message like "You selected '[text]'", this means they clicked on that text and want help understanding it. Respond proactively based on what they selected.
- If they ask about a word or phrase, explain it in context with a simple example
- If they ask about grammar, give clear, simple explanations with examples
- If they ask about the story, help them understand without spoiling future events
- Focus on the linguistic content - translations, grammar, vocabulary
- DO NOT explain how the text relates to the story's plot or themes unless specifically asked
- Use plain text formatting - avoid markdown syntax like ** for bold or * for italic as it won't render properly`;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messages, storySlug, currentPageText, context, isInitialProactiveResponse }: {
      messages: Message[];
      storySlug: string;
      currentPageText: string[];
      context?: {
        lineIndex: number;
        fullLine: string;
        selectedText?: string;
      } | null;
      isInitialProactiveResponse?: boolean;
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

    const systemPrompt = getStoryTutorSystemPrompt(
      session.user.quizLevel,
      session.user.nativeLanguage,
      currentPageText || [],
      context,
      isInitialProactiveResponse
    );

    // Only send last 50 messages to OpenAI to manage context window
    const recentMessages = messages.slice(-50);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...recentMessages.map(m => ({ role: m.role, content: m.content }))
      ],
      temperature: 0.7,
      max_tokens: 300,
    });

    const reply = completion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";

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
