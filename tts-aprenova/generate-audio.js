const fs = require("fs");
const path = require("path");
const axios = require("axios");

// Parse CLI arg
const lng = process.argv[2]; // "es" or "en"
if (!lng || !["es", "en"].includes(lng)) {
  console.error("❌ Usage: node generate-audio.js <es|en>");
  process.exit(1);
}

// Core setup
const subscriptionKey = "YOUR_KEY_HERE";
const region = "eastus";
const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;

const storySlug = "aventura";
const baseInputDir = path.join(__dirname, `../stories-json/${storySlug}`);
const baseOutputDir = path.join(__dirname, `../public/audio/${lng}/${storySlug}`);

// Determine target language (the one the learner is trying to learn)
const targetLang = lng === "es" ? "en" : "es";
const voice = targetLang === "en"
  ? "en-US-BrianMultilingualNeural"
  : "es-ES-AlvaroNeural";

const synthesizeWithRate = async (text, outputPath, rate) => {
  const ssml = `
  <speak version='1.0' xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang='${targetLang}'>
    <voice name='${voice}'>
      <mstts:express-as style="default">
        <prosody rate="${rate}" pitch="default">${text}</prosody>
      </mstts:express-as>
    </voice>
  </speak>
  `;

  try {
    const response = await axios.post(endpoint, ssml, {
      headers: {
        "Ocp-Apim-Subscription-Key": subscriptionKey,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-16khz-128kbitrate-mono-mp3",
        "User-Agent": "Aprenova-TTS-BatchGen",
      },
      responseType: "arraybuffer",
    });

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, response.data);
    console.log(`✅ ${path.relative(baseOutputDir, outputPath)} (${rate})`);
} catch (err) {
  console.error(`❌ Failed to generate ${outputPath}`);

  if (err.response?.data) {
    try {
      // Attempt to parse error as JSON
      const errorText = Buffer.from(err.response.data).toString("utf8");
      const parsed = JSON.parse(errorText);
      console.error("🔍 Azure error:", parsed);
    } catch (jsonErr) {
      console.error("🔍 Raw response (non-JSON):", Buffer.from(err.response.data).toString("utf8"));
    }
  } else {
    console.error("🔍 Error:", err.message);
  }
}
};

const generateAll = () => {
  const levels = fs.readdirSync(baseInputDir); // l1, l2, etc.

  levels.forEach((level) => {
    const levelPath = path.join(baseInputDir, level);
    const chapters = fs.readdirSync(levelPath); // ch1, ch2, etc.

    chapters.forEach((chapter) => {
      const chapterPath = path.join(levelPath, chapter);
      const pages = fs.readdirSync(chapterPath); // page-1.json, etc.

      pages.forEach((pageFile) => {
        const pageName = path.basename(pageFile, ".json"); // e.g. page-1
        const jsonPath = path.join(chapterPath, pageFile);
        const sentences = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

        sentences.forEach((sentence, i) => {
  const lineNum = i + 1;
  const text = sentence[targetLang]?.trim();

  if (!text) {
    console.warn(`⚠️ Skipping empty or missing text on line ${lineNum} in ${level}/${chapter}/${pageName}`);
    return;
  }

  // Normal speed
  const normalPath = path.join(baseOutputDir, level, chapter, pageName, `line${lineNum}.mp3`);
  synthesizeWithRate(text, normalPath, "medium");

  // Slow speed
  const slowPath = path.join(baseOutputDir, level, chapter, `${pageName}-slow`, `line${lineNum}.mp3`);
  synthesizeWithRate(text, slowPath, "x-slow");
});
      });
    });
  });
};

generateAll();

