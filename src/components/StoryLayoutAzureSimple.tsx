// src/components/StoryLayoutAzureSimple.tsx
"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import type { Language } from "@/types/i18n";

// Simple Azure TTS testing component
export default function StoryLayoutAzureSimple({
  sentences,
  initialLevel,
  storySlug,
  title,
  storyMap,
}) {
  const [audioStatus, setAudioStatus] = useState<string>('Ready');
  const [isGenerating, setIsGenerating] = useState(false);

  const { lng } = useParams() ?? {};
  const typedLang = (lng as Language) ?? "es";
  const oppositeLang = typedLang === "en" ? "es" : "en";

  const testAzureTTS = async (text: string, speed: 'normal' | 'slow', language: 'en' | 'es') => {
    setIsGenerating(true);
    setAudioStatus(`Generating ${speed} speed audio (${language.toUpperCase()})...`);

    try {
      const response = await fetch('/api/azure-tts/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          language: language === 'en' ? 'en-US' : 'es-ES',
          speed: speed,
          storySlug: storySlug,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setAudioStatus(`✅ Generated! Duration: ${data.duration?.toFixed(1)}s, Words: ${data.wordTimings?.length || 0}`);
        
        // Play the audio
        if (data.audioUrl) {
          const audio = new Audio(data.audioUrl);
          audio.play();
        }
      } else {
        setAudioStatus(`❌ Failed: HTTP ${response.status}`);
      }
    } catch (error) {
      setAudioStatus(`❌ Error: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen px-4 pt-6 pb-16 bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{title}</h1>
          <div className="bg-white rounded-lg p-4 shadow-sm border border-blue-200">
            <h2 className="text-lg font-semibold text-blue-800 mb-2">Azure TTS Testing</h2>
            <p className="text-sm text-gray-600 mb-3">
              Click the buttons below to test Azure Text-to-Speech generation
            </p>
            <div className="bg-gray-50 rounded p-3 text-sm">
              <strong>Status:</strong> <span className={isGenerating ? 'text-blue-600' : 'text-gray-800'}>{audioStatus}</span>
            </div>
          </div>
        </div>

        {/* Sentences */}
        {sentences.map((sentence, index) => (
          <div key={index} className="mb-8 bg-white rounded-lg p-6 shadow-sm">
            <div className="mb-4">
              <div className="text-lg font-medium text-gray-900 mb-2">
                {sentence[oppositeLang]}
              </div>
              <div className="text-sm text-gray-600">
                {sentence[typedLang]}
              </div>
            </div>

            <div className="space-y-3">
              {/* English TTS Testing */}
              <div>
                <div className="text-xs font-medium text-gray-500 mb-2">🇺🇸 ENGLISH (American): "{sentence.en}"</div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => testAzureTTS(sentence.en, 'normal', 'en')}
                    disabled={isGenerating}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                  >
                    🔊 Normal
                  </button>
                  
                  <button
                    onClick={() => testAzureTTS(sentence.en, 'slow', 'en')}
                    disabled={isGenerating}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-400 text-white rounded-md hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                  >
                    🐢 Slow
                  </button>
                </div>
              </div>

              {/* Spanish TTS Testing */}
              <div>
                <div className="text-xs font-medium text-gray-500 mb-2">🇲🇽 SPANISH (Mexican): "{sentence.es}"</div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => testAzureTTS(sentence.es, 'normal', 'es')}
                    disabled={isGenerating}
                    className="flex items-center gap-2 px-3 py-1.5 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                  >
                    🔊 Normal
                  </button>
                  
                  <button
                    onClick={() => testAzureTTS(sentence.es, 'slow', 'es')}
                    disabled={isGenerating}
                    className="flex items-center gap-2 px-3 py-1.5 bg-green-400 text-white rounded-md hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                  >
                    🐢 Slow
                  </button>
                </div>
              </div>

              <button
                onClick={() => {
                  setAudioStatus('Ready');
                }}
                className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm"
              >
                🔄 Reset Status
              </button>
            </div>
          </div>
        ))}

        {/* Test Results */}
        <div className="bg-white rounded-lg p-6 shadow-sm mt-8">
          <h3 className="text-lg font-semibold mb-4">Migration Test Checklist</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 bg-gray-200 rounded-full"></span>
              <span>Azure TTS generates audio successfully</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 bg-gray-200 rounded-full"></span>
              <span>🇺🇸 English uses clear American accent (en-US-AriaNeural)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 bg-gray-200 rounded-full"></span>
              <span>🇲🇽 Spanish uses Mexican accent (es-MX-DaliaNeural)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 bg-gray-200 rounded-full"></span>
              <span>Normal and slow speeds work for both languages</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 bg-gray-200 rounded-full"></span>
              <span>Generation time is reasonable (&lt;3s)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 bg-gray-200 rounded-full"></span>
              <span>Caching works (second request faster)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}