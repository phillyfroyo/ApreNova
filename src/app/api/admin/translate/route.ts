// src/app/api/admin/translate/route.ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { generateTranslationPrompt } from "@/lib/admin/cefr-prompts";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Add line numbers to NON-BLANK lines only for translation alignment.
 * Tracks which lines are blank so we can reconstruct later.
 *
 * Input: "line1\n\nline3"
 * Output: {
 *   numberedText: "[1] line1\n[2] line3",
 *   lineCount: 2,
 *   blankLinePositions: [1] // 0-indexed positions of blank lines
 * }
 */
function addLineNumbers(text: string): {
  numberedText: string;
  lineCount: number;
  totalLines: number;
  blankLinePositions: number[];
} {
  const lines = text.split("\n");
  const blankLinePositions: number[] = [];
  const contentLines: string[] = [];

  lines.forEach((line, idx) => {
    if (line.trim() === "") {
      blankLinePositions.push(idx);
    } else {
      contentLines.push(`[${contentLines.length + 1}] ${line}`);
    }
  });

  return {
    numberedText: contentLines.join("\n"),
    lineCount: contentLines.length,
    totalLines: lines.length,
    blankLinePositions,
  };
}

/**
 * Parse numbered lines from translation response.
 * Extracts content by line number, stripping the [N] prefix.
 */
function parseNumberedLines(text: string, expectedCount: number): string[] {
  const result: string[] = new Array(expectedCount).fill("");

  // Match patterns like [1] text, [2] text, etc.
  // This regex finds all [N] prefixed content
  const linePattern = /\[(\d+)\]\s*([^\n]*)/g;

  let match;
  while ((match = linePattern.exec(text + "\n")) !== null) {
    const lineNum = parseInt(match[1], 10);
    let lineText = match[2].trim();

    // Double-check: strip any remaining [N] prefix that might be nested
    lineText = lineText.replace(/^\[\d+\]\s*/, "");

    if (lineNum >= 1 && lineNum <= expectedCount) {
      result[lineNum - 1] = lineText;
    }
  }

  return result;
}

/**
 * Reconstruct full text by re-inserting blank lines at their original positions
 */
function reconstructWithBlankLines(
  translatedLines: string[],
  blankLinePositions: number[],
  totalLines: number
): string[] {
  const result: string[] = [];
  let translatedIdx = 0;

  for (let i = 0; i < totalLines; i++) {
    if (blankLinePositions.includes(i)) {
      result.push(""); // Re-insert blank line
    } else {
      result.push(translatedLines[translatedIdx] || "");
      translatedIdx++;
    }
  }

  return result;
}

/**
 * Final cleanup: strip any [N] prefixes that might have leaked through
 */
function stripLineNumberPrefixes(lines: string[]): string[] {
  return lines.map(line => line.replace(/^\[\d+\]\s*/, "").trim());
}

export async function POST(req: NextRequest) {
  try {
    const { text, fromLanguage, level } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    if (!fromLanguage || !["en", "es"].includes(fromLanguage)) {
      return NextResponse.json({ error: "Valid fromLanguage (en/es) is required" }, { status: 400 });
    }

    if (!level || level < 1 || level > 5) {
      return NextResponse.json({ error: "Valid level (1-5) is required" }, { status: 400 });
    }

    // ========== LOGGING: INPUT ==========
    const inputLines = text.split("\n");
    console.log("\n" + "=".repeat(60));
    console.log("TRANSLATION API - INPUT");
    console.log("=".repeat(60));
    console.log(`Total input lines: ${inputLines.length}`);
    console.log(`Input character count: ${text.length}`);
    console.log(`Non-empty input lines: ${inputLines.filter(l => l.trim()).length}`);
    console.log("\nFirst 5 input lines:");
    inputLines.slice(0, 5).forEach((line, i) => console.log(`  ${i + 1}: "${line.substring(0, 80)}${line.length > 80 ? '...' : ''}"`));
    console.log("\nLast 5 input lines:");
    inputLines.slice(-5).forEach((line, i) => console.log(`  ${inputLines.length - 4 + i}: "${line.substring(0, 80)}${line.length > 80 ? '...' : ''}"`));

    // Add line numbers to NON-BLANK lines only (tracks blank line positions)
    const { numberedText, lineCount, totalLines, blankLinePositions } = addLineNumbers(text);

    // ========== LOGGING: AFTER NUMBERING ==========
    const numberedLines = numberedText.split("\n");
    console.log("\n" + "-".repeat(60));
    console.log("AFTER addLineNumbers()");
    console.log("-".repeat(60));
    console.log(`Content lines (numbered): ${lineCount}`);
    console.log(`Blank lines (tracked): ${blankLinePositions.length}`);
    console.log(`Total lines: ${totalLines}`);
    console.log("\nFirst 5 numbered lines SENT TO GPT:");
    numberedLines.slice(0, 5).forEach((line) => console.log(`  "${line.substring(0, 100)}${line.length > 100 ? '...' : ''}"`));
    console.log("\nLast 5 numbered lines SENT TO GPT:");
    numberedLines.slice(-5).forEach((line) => console.log(`  "${line.substring(0, 100)}${line.length > 100 ? '...' : ''}"`));

    const toLanguage = fromLanguage === "en" ? "Spanish" : "English";
    const prompt = generateTranslationPrompt(numberedText, fromLanguage, level);

    // ========== LOGGING: PROMPT ==========
    console.log("\n" + "-".repeat(60));
    console.log("PROMPT SENT TO GPT");
    console.log("-".repeat(60));
    console.log(`Prompt length: ${prompt.length} chars`);
    console.log(`First 500 chars of prompt:\n${prompt.substring(0, 500)}...`);

    const systemPrompt = `You are an expert literary translator specializing in ${fromLanguage === "en" ? "English to Spanish" : "Spanish to English"} translation for language learners.

CONTEXT: You are translating literature for educational language learning purposes. These texts may contain period-appropriate themes, archaic language, gothic/horror elements, or mature literary content typical of classic and contemporary literature. Your role is to faithfully translate the literary work while adapting vocabulary complexity for language learners.

CRITICAL RULES:
1. Each line in the input starts with a number in brackets like [1], [2], [3], etc.
2. You MUST preserve these exact line numbers in your output.
3. Each numbered input line produces EXACTLY ONE numbered output line.
4. NEVER split a single input line into multiple output lines.
5. NEVER merge multiple input lines into one output line.
6. Keep the same [N] prefix for each translated line.
7. Translate ALL lines - do not skip any.

Example:
Input:
[1] The cat sat on the mat.
[2] It was a sunny day.

Output:
[1] El gato se sentó en la alfombra.
[2] Era un día soleado.

Maintain CEFR level complexity. Return ONLY the numbered translated lines.`;

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 16000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const rawResponse = response.content[0].type === "text" ? response.content[0].text.trim() : "";

    // ========== LOGGING: RAW CLAUDE RESPONSE ==========
    console.log("\n" + "-".repeat(60));
    console.log("RAW CLAUDE RESPONSE");
    console.log("-".repeat(60));
    if (!rawResponse) {
      console.log("ERROR: No response from AI!");
      return NextResponse.json({ error: "No response from AI" }, { status: 500 });
    }
    const rawLines = rawResponse.split("\n");
    console.log(`Response length: ${rawResponse.length} chars`);
    console.log(`Response line count: ${rawLines.length}`);
    console.log(`Non-empty response lines: ${rawLines.filter(l => l.trim()).length}`);
    console.log("\nFirst 10 lines of GPT response:");
    rawLines.slice(0, 10).forEach((line, i) => console.log(`  ${i + 1}: "${line.substring(0, 100)}${line.length > 100 ? '...' : ''}"`));
    console.log("\nLast 10 lines of GPT response:");
    rawLines.slice(-10).forEach((line, i) => console.log(`  ${rawLines.length - 9 + i}: "${line.substring(0, 100)}${line.length > 100 ? '...' : ''}"`));

    // Check what line numbers GPT returned
    const returnedLineNumbers: number[] = [];
    const lineNumPattern = /^\[(\d+)\]/;
    rawLines.forEach(line => {
      const match = line.match(lineNumPattern);
      if (match) returnedLineNumbers.push(parseInt(match[1], 10));
    });
    console.log(`\nLine numbers found in response: ${returnedLineNumbers.length}`);
    console.log(`Expected line numbers: 1 to ${lineCount}`);
    console.log(`First 10 line numbers: [${returnedLineNumbers.slice(0, 10).join(", ")}]`);
    console.log(`Last 10 line numbers: [${returnedLineNumbers.slice(-10).join(", ")}]`);

    // Find missing line numbers
    const missingNumbers: number[] = [];
    for (let i = 1; i <= lineCount; i++) {
      if (!returnedLineNumbers.includes(i)) missingNumbers.push(i);
    }
    if (missingNumbers.length > 0) {
      console.log(`\nMISSING LINE NUMBERS (${missingNumbers.length}): [${missingNumbers.slice(0, 20).join(", ")}${missingNumbers.length > 20 ? '...' : ''}]`);
    } else {
      console.log(`\nAll ${lineCount} line numbers present in response!`);
    }

    // Parse the numbered response (only content lines)
    let translatedContentLines = parseNumberedLines(rawResponse, lineCount);

    // ========== LOGGING: AFTER PARSING ==========
    console.log("\n" + "-".repeat(60));
    console.log("AFTER parseNumberedLines()");
    console.log("-".repeat(60));
    const parsedNonEmpty = translatedContentLines.filter(l => l.length > 0).length;
    console.log(`Parsed lines array length: ${translatedContentLines.length}`);
    console.log(`Non-empty parsed lines: ${parsedNonEmpty}`);
    console.log(`Empty slots: ${translatedContentLines.length - parsedNonEmpty}`);
    console.log("\nFirst 5 parsed lines:");
    translatedContentLines.slice(0, 5).forEach((line, i) => console.log(`  [${i + 1}]: "${line.substring(0, 80)}${line.length > 80 ? '...' : ''}"`));
    console.log("\nLast 5 parsed lines:");
    translatedContentLines.slice(-5).forEach((line, i) => console.log(`  [${translatedContentLines.length - 4 + i}]: "${line.substring(0, 80)}${line.length > 80 ? '...' : ''}"`));

    // Strip any remaining [N] prefixes that might have leaked through
    translatedContentLines = stripLineNumberPrefixes(translatedContentLines);

    // Reconstruct full text by re-inserting blank lines at original positions
    const fullTranslatedLines = reconstructWithBlankLines(
      translatedContentLines,
      blankLinePositions,
      totalLines
    );

    const translatedText = fullTranslatedLines.join("\n");

    // ========== LOGGING: FINAL OUTPUT ==========
    const translatedNonEmpty = translatedContentLines.filter(l => l.length > 0).length;
    console.log("\n" + "-".repeat(60));
    console.log("FINAL OUTPUT");
    console.log("-".repeat(60));
    console.log(`Final line count: ${fullTranslatedLines.length}`);
    console.log(`Non-empty final lines: ${fullTranslatedLines.filter(l => l.trim()).length}`);
    console.log(`Translation alignment: ${lineCount} content lines → ${translatedNonEmpty} translated (${blankLinePositions.length} blank lines preserved)`);
    console.log("=".repeat(60) + "\n");

    if (translatedNonEmpty < lineCount * 0.8) {
      console.warn(`Warning: Only ${translatedNonEmpty}/${lineCount} content lines were translated. Some lines may be missing.`);
    }

    return NextResponse.json({
      translatedText,
      fromLanguage,
      toLanguage: fromLanguage === "en" ? "es" : "en",
      level,
      alignment: {
        sourceLines: totalLines,
        contentLines: lineCount,
        translatedLines: translatedNonEmpty,
        blankLines: blankLinePositions.length,
      },
    });
  } catch (error) {
    console.error("Translation error:", error);
    return NextResponse.json({ error: "Failed to translate text" }, { status: 500 });
  }
}
