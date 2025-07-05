import { OpenAI } from 'openai';
import { NextRequest, NextResponse } from 'next/server';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function GET(req: NextRequest) {
  const inputParam = req.nextUrl.searchParams.get('input');
  const sentenceParam = req.nextUrl.searchParams.get('sentence');
  const levelParam = req.nextUrl.searchParams.get('level');
  const mode = req.nextUrl.searchParams.get('mode') || 'auto';

  if (!inputParam || !sentenceParam || !levelParam) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
  }

  const input = inputParam.trim();
  const sentence = sentenceParam.trim();
  const level = levelParam.trim();

  const wordCount = input.split(/\s+/).length;
  let translationMode = 'simple';

  // If explicit mode is given
  if (mode === 'multi') {
    translationMode = 'multi';
  } else if (mode === 'simple') {
    translationMode = 'simple';
  } else if (wordCount === 1) {
    translationMode = 'multi';
  } else {
    // Ask GPT if this is a phrase with multiple interpretations
    const checkPrompt = `Is the English phrase "${input}" a multi-meaning phrase, idiom, or phrasal verb that would benefit from seeing more than one possible Spanish translation? Respond only with YES or NO.`;

    try {
      const checkResponse = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are a helpful assistant for ESL learners.' },
          { role: 'user', content: checkPrompt }
        ],
        max_tokens: 10,
      });

      const isPhrase = checkResponse.choices[0]?.message?.content?.trim().toUpperCase().startsWith('Y');
      translationMode = isPhrase ? 'multi' : 'simple';
    } catch (e) {
      console.error('GPT idiom check failed:', e);
      translationMode = 'simple';
    }
  }

  const prompt = translationMode === 'multi'
    ? `Provide 1 to 3 possible Spanish translations for the English phrase \"${input}\" using the context of the full sentence: \"${sentence}\". Return a JSON array of objects, each with fields: \"translation\" and optionally \"example\" and \"example_es\". Respond with only the JSON.`
    : `Translate the English phrase \"${input}\" into Spanish using the full context of the sentence: \"${sentence}\". Return a JSON object with the field \"translation\". Respond with only the JSON.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a helpful Spanish translator for ESL learners. Respond in JSON only.' },
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

