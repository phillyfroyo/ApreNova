// src/app/api/translation-teacher/route.ts
import { OpenAI } from "openai";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type Message = {
  role: "user" | "assistant";
  content: string;
  spoken?: string; // What the AI actually spoke
  written?: string; // What was displayed in chat
};

function getTranslationTeacherPrompt(
  userLevel: string | null | undefined,
  nativeLanguage: string | null | undefined
): string {
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

  return `You are an enthusiastic translation teacher helping a ${ceferLevel}-level ${targetLanguage} learner practice translation skills through speech. Their native language is ${nativeLang}.

**CRITICAL RESPONSE FORMAT:**
You MUST respond with valid JSON in this exact format:
{
  "spoken": "text to be spoken aloud to the student",
  "written": "text to be displayed in the chat (can include visual aids, corrections, or additional context)",
  "shouldSpeak": true or false,
  "shouldWrite": true or false
}

**YOUR TEACHING APPROACH:**
1. **Give Translation Exercises**: Present sentences in one language and ask them to translate to the other
   - Start in their native language (${nativeLang}) → ask for ${targetLanguage} translation
   - Then ${targetLanguage} → ${nativeLang} translation
   - Match difficulty to ${ceferLevel} level

2. **Provide Immediate Feedback**:
   - If correct: Praise enthusiastically (spoken), show checkmark and their answer (written)
   - If incorrect: Gently correct (spoken), show both their answer and correct answer side-by-side (written)
   - Explain errors in simple terms appropriate to ${ceferLevel} level

3. **Use the Whiteboard Concept**:
   - **Speak**: Instructions, encouragement, explanations, new sentences to translate
   - **Write**: Visual reference of sentences, correct answers, side-by-side comparisons, key vocabulary
   - **Both**: When you want them to see AND hear simultaneously

**EXAMPLE RESPONSES:**

When giving a new exercise:
{
  "spoken": "Great! Now translate this sentence to ${targetLanguage}: I went to the market yesterday.",
  "written": "🎯 Translate to ${targetLanguage}:\\n\\n**I went to the market yesterday.**",
  "shouldSpeak": true,
  "shouldWrite": true
}

When they answer correctly:
{
  "spoken": "Excellent! That's perfect!",
  "written": "✅ **Correct!**\\n\\nYour answer: Fui al mercado ayer.\\n\\nPerfect ${targetLanguage}!",
  "shouldSpeak": true,
  "shouldWrite": true
}

When they make a mistake:
{
  "spoken": "Good try! The correct translation is: Fui al mercado ayer. You said fue instead of fui. Remember, for I went we use fui.",
  "written": "❌ **Not quite!**\\n\\n**Your answer:** Fue al mercado ayer\\n**Correct answer:** Fui al mercado ayer\\n\\n💡 *fue* = he/she went\\n💡 *fui* = I went",
  "shouldSpeak": true,
  "shouldWrite": true
}

**LEVEL-APPROPRIATE CONTENT (${ceferLevel}):**
${ceferLevel === "A1" ? "- Simple present tense, basic vocabulary\n- Short sentences (5-8 words)\n- Common everyday topics: food, family, weather" : ""}
${ceferLevel === "A2" ? "- Present and past tense\n- Medium sentences (8-12 words)\n- Familiar topics: hobbies, travel, routines" : ""}
${ceferLevel === "B1" ? "- Multiple tenses, some complex structures\n- Longer sentences (12-15 words)\n- Abstract topics: opinions, experiences, plans" : ""}
${ceferLevel === "B2" ? "- All tenses, conditional, subjunctive\n- Complex sentences (15-20 words)\n- Nuanced topics: culture, current events, hypotheticals" : ""}
${ceferLevel === "C1" ? "- Advanced grammar, idioms\n- Very complex sentences\n- Sophisticated topics: philosophy, politics, literature" : ""}

**REMEMBER:**
- ALWAYS respond with valid JSON
- Keep spoken text conversational and encouraging
- Use written text for visual learning aids
- Vary between ${nativeLang} → ${targetLanguage} and ${targetLanguage} → ${nativeLang}
- Keep the energy high and positive!
- After they complete 3-5 translations successfully, praise their progress and give a new challenge

Start by greeting them warmly (spoken) and giving them their first translation exercise (written).`;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messages, userMessage }: {
      messages: Message[];
      userMessage: string;
    } = await req.json();

    if (!userMessage) {
      return NextResponse.json({ error: "No message provided" }, { status: 400 });
    }

    // Build conversation history for context
    const conversationHistory = messages || [];

    // Add user's new message
    const newUserMessage = {
      role: "user" as const,
      content: userMessage
    };

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🎓 TRANSLATION TEACHER REQUEST");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("👤 User:", session.user.id);
    console.log("📚 Level:", session.user.quizLevel);
    console.log("🌍 Native Lang:", session.user.nativeLanguage);
    console.log("💬 User Message:", userMessage);
    console.log("📝 Context Messages:", conversationHistory.length);

    const systemPrompt = getTranslationTeacherPrompt(
      session.user.quizLevel,
      session.user.nativeLanguage
    );

    // Only send last 20 messages for context
    const recentHistory = conversationHistory.slice(-20);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        ...recentHistory.map(m => ({
          role: m.role,
          content: m.content
        })),
        { role: "user", content: userMessage }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 500,
    });

    const responseText = completion.choices[0]?.message?.content || "{}";
    let parsedResponse;

    try {
      parsedResponse = JSON.parse(responseText);
    } catch (parseError) {
      console.error("❌ Failed to parse JSON response:", responseText);
      // Fallback response
      parsedResponse = {
        spoken: "Sorry, I encountered an error. Let's try again!",
        written: "⚠️ System Error - Please try again",
        shouldSpeak: true,
        shouldWrite: true
      };
    }

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🤖 TEACHER RESPONSE:");
    console.log("🔊 Spoken:", parsedResponse.spoken);
    console.log("📝 Written:", parsedResponse.written);
    console.log("🔊 Should Speak:", parsedResponse.shouldSpeak);
    console.log("📝 Should Write:", parsedResponse.shouldWrite);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // Save to database
    await prisma.translationTeacherMessage.create({
      data: {
        userId: session.user.id,
        role: "user",
        content: userMessage,
      },
    });

    await prisma.translationTeacherMessage.create({
      data: {
        userId: session.user.id,
        role: "assistant",
        content: parsedResponse.written || parsedResponse.spoken,
        spoken: parsedResponse.spoken,
        written: parsedResponse.written,
      },
    });

    return NextResponse.json({
      spoken: parsedResponse.spoken,
      written: parsedResponse.written,
      shouldSpeak: parsedResponse.shouldSpeak !== false, // Default true
      shouldWrite: parsedResponse.shouldWrite !== false, // Default true
    });
  } catch (error) {
    console.error("❌ Translation Teacher API error:", error);
    return NextResponse.json(
      { error: "Failed to generate response" },
      { status: 500 }
    );
  }
}

// GET endpoint to load conversation history
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const messages = await prisma.translationTeacherMessage.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const chronologicalMessages = messages.reverse().map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
      spoken: m.spoken,
      written: m.written,
    }));

    return NextResponse.json({ messages: chronologicalMessages });
  } catch (error) {
    console.error("❌ Error loading translation teacher history:", error);
    return NextResponse.json(
      { error: "Failed to load conversation history" },
      { status: 500 }
    );
  }
}
