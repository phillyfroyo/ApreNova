const fs = require("fs");
const path = require("path");
const axios = require("axios");

const subscriptionKey = "Cl89u59KRbiXWTugWkTUWh0iNYjjftXHByC40MMwThqMGkD3o1acJQQJ99BGACYeBjFXJ3w3AAAYACOGCDa3";
const region = "eastus"; // e.g. "eastus"
const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;

const baseInputDir = path.join(__dirname, "../stories-json/aventura");
const baseOutputDir = path.join(__dirname, "../public/audio/aventura");
const voice = "en-US-BrianMultilingualNeural";

const synthesizeWithRate = async (text, outputPath, rate) => {
  const ssml = `
  <speak version='1.0' xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang='en-US'>
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
    console.error(`❌ Failed to generate ${outputPath}`, err.response?.data || err.message);
  }
};

const generateAll = () => {
  const levels = fs.readdirSync(baseInputDir); // l1, l2, etc.

  levels.forEach((level) => {
    const levelPath = path.join(baseInputDir, level);
    const parts = fs.readdirSync(levelPath); // part-1, part-2...

    parts.forEach((partFile) => {
      const partName = path.basename(partFile, ".json");
      const jsonPath = path.join(levelPath, partFile);
      const sentences = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

      sentences.forEach((sentence, i) => {
        const lineNum = i + 1;
        // Normal speed
        const normalPath = path.join(baseOutputDir, level, partName, `line${lineNum}.mp3`);
synthesizeWithRate(sentence.en, normalPath, "medium");

// Slow speed
        const slowPartName = `${partName}-slow`;
        const slowPath = path.join(baseOutputDir, level, slowPartName, `line${lineNum}.mp3`);
synthesizeWithRate(sentence.en, slowPath, "x-slow");
      });
    });
  });
};

generateAll();
