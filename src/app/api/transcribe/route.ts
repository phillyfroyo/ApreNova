// src/app/api/transcribe/route.ts
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

    // Get the audio file from form data
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;
    const language = formData.get("language") as string || "auto"; // "en", "es", or "auto"

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🎤 WHISPER TRANSCRIPTION REQUEST");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📁 File size:", audioFile.size, "bytes");
    console.log("📁 File type:", audioFile.type);
    console.log("🌍 Language:", language);
    console.log("👤 User ID:", session.user.id);

    // Convert File to format Whisper API expects
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: language === "auto" ? undefined : language,
      response_format: "json",
    });

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ TRANSCRIPTION RESULT:");
    console.log(transcription.text);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    return NextResponse.json({
      text: transcription.text,
      language: transcription.language || language
    });
  } catch (error) {
    console.error("❌ Whisper transcription error:", error);
    return NextResponse.json(
      { error: "Failed to transcribe audio" },
      { status: 500 }
    );
  }
}
