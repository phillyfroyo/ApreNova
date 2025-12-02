// src/app/api/translation-teacher-speak/route.ts
// Convenience endpoint that gets AI response AND generates TTS in one call
import { OpenAI } from "openai";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { spokenText, language }: {
      spokenText: string;
      language: 'es-ES' | 'en-US';
    } = await req.json();

    if (!spokenText) {
      return NextResponse.json({ error: "No spoken text provided" }, { status: 400 });
    }

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🎙️ TRANSLATION TEACHER TTS REQUEST");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🗣️ Text:", spokenText);
    console.log("🌍 Language:", language);

    // Generate TTS using Azure endpoint
    const ttsResponse = await fetch(`${req.nextUrl.origin}/api/azure-tts/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': req.headers.get('cookie') || '', // Forward auth
      },
      body: JSON.stringify({
        text: spokenText,
        language,
        speed: 'normal',
        storySlug: 'translation-teacher',
        chapterPage: 'live'
      }),
    });

    if (!ttsResponse.ok) {
      throw new Error('Failed to generate TTS');
    }

    const ttsData = await ttsResponse.json();

    console.log("✅ TTS Generated:", ttsData.audioUrl);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    return NextResponse.json({
      audioUrl: ttsData.audioUrl,
      wordTimings: ttsData.wordTimings
    });
  } catch (error) {
    console.error("❌ Translation Teacher TTS error:", error);
    return NextResponse.json(
      { error: "Failed to generate speech" },
      { status: 500 }
    );
  }
}
