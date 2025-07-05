// src\app\api\translate-phrase\route.ts

import { OpenAI } from 'openai';
import { NextRequest, NextResponse } from 'next/server';
import { getPhrasePrompt } from '@/lib/getPhrasePrompt';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function GET(req: NextRequest) {
  const inputParam = req.nextUrl.searchParams.get('input');
  const sentenceParam = req.nextUrl.searchParams.get('sentence');
  const levelParam = req.nextUrl.searchParams.get('level');

  if (!inputParam || !sentenceParam || !levelParam) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
  }

  const phrase = inputParam.trim();
  const sentence = sentenceParam.trim();
  const level = parseInt(levelParam.trim());

  const prompt = getPhrasePrompt(level, phrase, );
  console.log("🧠 Prompt to GPT:", prompt);

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
    });

    const result = completion.choices[0]?.message?.content;
    const cleaned = result?.replace(/^```json\n?|```$/g, '').trim();
    return NextResponse.json(JSON.parse(cleaned!));
  } catch (e) {
    console.error('Translation error:', e);
    return NextResponse.json({ error: 'Translation failed' }, { status: 500 });
  }
}
