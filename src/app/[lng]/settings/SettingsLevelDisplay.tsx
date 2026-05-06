// src/app/[lng]/settings/SettingsLevelDisplay
'use client'

import { useState } from 'react'
import { useRouter, useParams } from "next/navigation";
import { useSession } from 'next-auth/react';
import { GraduationCap, ChevronRight, ChevronUp } from 'lucide-react';
import type { Language } from "@/types/i18n";
import { t } from '@/lib/t';
import { toCEFR } from '@/lib/cefr';

type Level = 'l1' | 'l2' | 'l3' | 'l4' | 'l5';
const LEVELS: Level[] = ['l1', 'l2', 'l3', 'l4', 'l5'];

// Example sentences at each level — same concept, increasing complexity
const LEVEL_EXAMPLES: Record<Level, { es: string; en: string }> = {
  l1: {
    es: "Él dibujaba cuando era niño. Ahora es adulto. Ya no dibuja.",
    en: "He drew when he was a child. Now he is an adult. He doesn't draw anymore.",
  },
  l2: {
    es: "De niño solía dibujar, pero luego dejó de hacerlo. Ya lleva muchos años sin dibujar.",
    en: "He used to draw when he was a child, but then he stopped. He hasn't drawn now for many years.",
  },
  l3: {
    es: "De repente se dio cuenta de que llevaba años sin dibujar nada. La última vez que realmente se sentó a dibujar algo fue cuando era niño. Había pasado tanto tiempo que casi se había olvidado.",
    en: "He suddenly realized that he hadn't drawn anything in years. The last time he really sat down and drew something was when he was a kid. It had been such a long time that he had almost forgotten about it.",
  },
  l4: {
    es: "Le sorprendió darse cuenta de que no había cogido un lápiz para dibujar desde la infancia. En algún momento, entre crecer y seguir adelante con la vida, simplemente había dejado de hacerlo — y ni siquiera se había dado cuenta hasta ahora.",
    en: "It struck him that he hadn't so much as picked up a pencil to draw since childhood. Somewhere along the way, between growing up and getting on with life, he'd simply stopped — and hadn't even noticed until now.",
  },
  l5: {
    es: "Cayó en la cuenta, casi de pasada, de que no había hecho un solo dibujo desde que era niño. La revelación traía consigo un peso silencioso, como la pérdida de un viejo amor — de algún modo, toda una forma de expresión se había escurrido de su vida sin que él llegara a registrar su ausencia.",
    en: "It dawned on him, almost as an afterthought, that he hadn't produced a single drawing since he was a child. The realization carried a quiet weight, like the loss of an old love — somehow an entire form of expression had slipped out of his life without him ever registering its absence.",
  },
};

export default function SettingsLevelDisplay() {
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [exampleOpen, setExampleOpen] = useState<Level | null>(null)
  const { data: session, update: updateSession } = useSession();

  const router = useRouter();
  const { lng } = useParams();
  const typedLang = lng as Language;

  const currentLevel = session?.user?.quizLevel
    ? toCEFR(session.user.quizLevel)
    : null;

  const handleLevelChange = async (newLevel: string) => {
    if (!session?.user?.id || saving) return;

    setSaving(true);
    try {
      const response = await fetch("/api/user-level", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.user.id, level: newLevel }),
      });

      if (!response.ok) {
        throw new Error("Failed to update level");
      }

      // Update session and local storage
      await updateSession();
      localStorage.setItem("level", newLevel);
      sessionStorage.setItem("quizLevel", newLevel);

      setExpanded(false);
      setExampleOpen(null);
      router.refresh();
    } catch (error) {
      console.error("Failed to update level:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* Green CTA button */}
      <button
        onClick={() => { setExpanded(!expanded); setExampleOpen(null); }}
        className="w-full flex items-center justify-between py-3 px-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-medium hover:from-green-600 hover:to-emerald-700 transition-all shadow-sm"
      >
        <div className="flex items-center gap-3">
          <GraduationCap className="w-5 h-5" />
          <span>
            {typedLang === 'es' ? 'Cambiar Tu Nivel' : 'Change Your Level'}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5" />
        ) : (
          <ChevronRight className="w-5 h-5" />
        )}
      </button>

      {/* Expandable CEFR level cards */}
      {expanded && (
        <div className="mt-4 space-y-3">
          {LEVELS.map((level) => {
            const cefrCode = toCEFR(level);
            const isCurrentLevel = cefrCode === currentLevel;
            const displayName = t(typedLang, "levels", level) || "";
            const isExampleOpen = exampleOpen === level;
            const example = LEVEL_EXAMPLES[level];
            const primaryText = typedLang === "en" ? example.es : example.en;
            const secondaryText = typedLang === "en" ? example.en : example.es;
            return (
              <div
                key={level}
                className={`w-full border rounded-xl text-left transition-all group ${
                  isCurrentLevel
                    ? 'border-indigo-400 bg-indigo-50 ring-2 ring-indigo-200'
                    : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-gray-50'
                } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {/* Main card area — clicking selects the level */}
                <button
                  onClick={() => handleLevelChange(cefrCode)}
                  disabled={saving}
                  className="w-full p-4 text-left"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-sm font-bold text-indigo-600 bg-indigo-100 px-2.5 py-0.5 rounded">
                      {t(typedLang, "levels", `cefrLabels.${level}`)}
                    </span>
                    <h3 className={`font-semibold text-base ${
                      isCurrentLevel ? 'text-indigo-700' : 'text-gray-900 group-hover:text-indigo-700'
                    } transition-colors`}>
                      {displayName}
                    </h3>
                    {isCurrentLevel && (
                      <span className="text-xs font-medium text-indigo-500 ml-auto">
                        {typedLang === 'es' ? 'actual' : 'current'}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {t(typedLang, "levels", `cefrDescriptions.${level}`)}
                  </p>
                </button>

                {/* Example toggle */}
                <div className="px-4 pb-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExampleOpen(isExampleOpen ? null : level);
                    }}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-500 hover:text-indigo-700 transition-colors py-1 px-2 -ml-2 rounded-md hover:bg-indigo-50"
                  >
                    <svg className={`w-3.5 h-3.5 transition-transform ${isExampleOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    {typedLang === "es" ? "Ver ejemplo" : "See example"}
                  </button>

                  {isExampleOpen && (
                    <div className="mt-2 bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <p className="text-sm text-gray-800 italic leading-relaxed">
                        &ldquo;{primaryText}&rdquo;
                      </p>
                      <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                        &ldquo;{secondaryText}&rdquo;
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {saving && (
            <p className="text-xs text-gray-500 text-center">
              {typedLang === "es" ? "Guardando..." : "Saving..."}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
