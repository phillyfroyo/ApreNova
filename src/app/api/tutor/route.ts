// src/app/api/tutor/route.ts
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

function getTutorSystemPrompt(userLevel: string | null | undefined, nativeLanguage: string | null | undefined): string {
  // Map quiz levels to CEFR levels
  const ceferLevel = {
    l1: "A1",
    l2: "A2",
    l3: "B1",
    l4: "B2",
    l5: "C1"
  }[userLevel || "l1"] || "A1";

  console.log("🎯 User Level Debug:", { userLevel, ceferLevel, nativeLanguage });

  const isLearningSpanish = nativeLanguage === "en";
  const targetLanguage = isLearningSpanish ? "Spanish" : "English";
  const nativeLang = isLearningSpanish ? "English" : "Spanish";

  // Adjust language mix based on CEFR level
  const languageMix = {
    A1: `Use mostly ${nativeLang} (70-80%) with simple ${targetLanguage} words and phrases. Focus on basic vocabulary and simple present tense.`,
    A2: `Use a balanced mix of ${nativeLang} and ${targetLanguage} (60-40%). Introduce basic past tense and common expressions.`,
    B1: `Use more ${targetLanguage} than ${nativeLang} (60-70% ${targetLanguage}). Use ${nativeLang} only for complex explanations.`,
    B2: `Conduct most of the conversation in ${targetLanguage} (80-90%). Use ${nativeLang} sparingly, only for nuanced grammar points.`,
    C1: `Conduct the conversation almost entirely in ${targetLanguage} (95%+). Use ${nativeLang} only when absolutely necessary.`
  }[ceferLevel];

  return `You are a friendly, encouraging language tutor helping a ${ceferLevel}-level learner practice ${targetLanguage}. Their native language is ${nativeLang}.

IMPORTANT: The student's CEFR level is ${ceferLevel}. If they ask about their level, tell them clearly that they are at ${ceferLevel} level.

**Formatting:**
- You may use **bold** for emphasis on important words or corrections
- You may use *italic* for grammatical terms or subtle emphasis
- Do NOT use other markdown (no #, no lists with -, etc.)

**Language Balance:**
${languageMix}

**Pedagogy Guidelines:**
1. **Recasts**: When the student makes an error, naturally recast it correctly in your response without explicitly pointing out the mistake.
   Example: Student: "I go to store yesterday" → You: "Oh, you went to the store yesterday? What did you buy?"

2. **Prompts**: If they struggle, give gentle prompts or sentence starters.
   Example: "Try starting with 'I would like to...'"

3. **Elicitation**: Ask open-ended questions that encourage them to produce language.
   Example: "Tell me about your weekend" instead of "Did you have a good weekend?"

4. **Positive Reinforcement**: Celebrate their efforts and progress.

5. **Level-Appropriate Complexity**: Match vocabulary and grammar to their ${ceferLevel} level.

**Conversation Style:**
- Keep responses conversational and natural
- Ask follow-up questions to keep the conversation flowing
- Introduce new vocabulary gradually and in context
- Be patient and supportive
- Make it fun and engaging

Start by greeting them and asking what they'd like to talk about or practice today.`;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messages }: { messages: Message[] } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Invalid messages format" }, { status: 400 });
    }

    // Get the last user message to save
    const lastUserMessage = messages[messages.length - 1];

    // Save user message to database
    await prisma.tutorMessage.create({
      data: {
        userId: session.user.id,
        role: lastUserMessage.role,
        content: lastUserMessage.content,
      },
    });

    const systemPrompt = getTutorSystemPrompt(
      session.user.quizLevel,
      session.user.nativeLanguage
    );

    // Only send last 150 messages to OpenAI to manage context window and cost
    const recentMessages = messages.slice(-150);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        ...recentMessages.map(m => ({ role: m.role, content: m.content }))
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const reply = completion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";

    // Save assistant message to database
    await prisma.tutorMessage.create({
      data: {
        userId: session.user.id,
        role: "assistant",
        content: reply,
      },
    });

    // Cleanup: Keep only last 1,000 messages per user to manage storage
    const messageCount = await prisma.tutorMessage.count({
      where: { userId: session.user.id },
    });

    if (messageCount > 1000) {
      // Get the oldest messages to delete
      const oldMessages = await prisma.tutorMessage.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "asc" },
        take: messageCount - 1000,
        select: { id: true },
      });

      // Delete old messages
      await prisma.tutorMessage.deleteMany({
        where: {
          id: { in: oldMessages.map((m) => m.id) },
        },
      });
    }

    return NextResponse.json({ message: reply });
  } catch (error) {
    console.error("❌ Tutor API error:", error);
    return NextResponse.json(
      { error: "Failed to generate response" },
      { status: 500 }
    );
  }
}

// New GET endpoint to load conversation history
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Load last 200 messages for display (100 exchanges)
    // Database stores up to 1,000 messages per user
    const messages = await prisma.tutorMessage.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    // Reverse to chronological order
    const chronologicalMessages = messages.reverse().map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    return NextResponse.json({ messages: chronologicalMessages });
  } catch (error) {
    console.error("❌ Error loading conversation history:", error);
    return NextResponse.json(
      { error: "Failed to load conversation history" },
      { status: 500 }
    );
  }
}
