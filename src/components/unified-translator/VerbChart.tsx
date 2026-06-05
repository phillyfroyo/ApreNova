// src/components/unified-translator/VerbChart.tsx
"use client";

import type { EnhancedTranslation } from "./types";

const tenseToEnglish: Record<string, string> = {
  'Presente': 'present', 'Pretérito': 'simple past', 'Preterito': 'simple past',
  'Imperfecto': 'imperfect', 'Futuro': 'future', 'Futuro Simple': 'simple future',
  'Condicional': 'conditional', 'Presente Perfecto': 'present perfect',
  'Pretérito Perfecto': 'present perfect', 'Pluscuamperfecto': 'past perfect',
  'Pretérito Pluscuamperfecto': 'past perfect', 'Futuro Perfecto': 'future perfect',
  'Subjuntivo Presente': 'present subjunctive', 'Subjuntivo Imperfecto': 'imperfect subjunctive',
  'Imperativo': 'imperative', 'Presente Progresivo': 'present progressive',
  'Pretérito Progresivo': 'past progressive',
};

const tenseToSpanish: Record<string, string> = {
  'Present Simple': 'presente simple', 'Simple Present': 'presente simple',
  'Past Simple': 'pasado simple', 'Simple Past': 'pasado simple',
  'Present Continuous': 'presente continuo', 'Present Progressive': 'presente progresivo',
  'Past Continuous': 'pasado continuo', 'Past Progressive': 'pasado progresivo',
  'Present Perfect': 'presente perfecto', 'Past Perfect': 'pasado perfecto',
  'Future Simple': 'futuro simple', 'Simple Future': 'futuro simple',
  'Future': 'futuro', 'Conditional': 'condicional',
  'Future Perfect': 'futuro perfecto', 'Imperative': 'imperativo',
};

const posMap: Record<string, string> = {
  noun: 'sustantivo', verb: 'verbo', adjective: 'adjetivo',
  adverb: 'adverbio', preposition: 'preposición', pronoun: 'pronombre',
  conjunction: 'conjunción', determiner: 'determinante',
  'auxiliary verb': 'verbo auxiliar', 'modal verb': 'verbo modal',
};

interface VerbChartProps {
  verbChart: NonNullable<EnhancedTranslation['verbChart']>;
  selectedWord: string;
}

export default function VerbChart({ verbChart, selectedWord }: VerbChartProps) {
  const c = verbChart.conjugations;
  const isSpanish = 'yo' in c;
  const pairs: [string, string][] = isSpanish
    ? [['yo', 'nosotros'], ['tú', 'vosotros'], ['él/ella/usted', 'ellos/ellas/ustedes']]
    : [['I', 'we'], ['you', 'you all'], ['he/she/it', 'they']];
  const lowerSelected = selectedWord.toLowerCase();

  return (
    <div className="mt-3 border-t pt-2">
      <p className="font-semibold text-sm text-gray-700 mb-1">
        {verbChart.infinitive} &mdash; {verbChart.tense}
      </p>
      <div className="overflow-x-auto">
        {/* whitespace-nowrap keeps every cell on one line, so long forms
            (e.g. reflexive "nos lavamos") push the table past the card edge
            and scroll behind it instead of wrapping. */}
        <table className="text-sm w-full border-collapse border border-gray-200 min-w-[340px] whitespace-nowrap">
          <tbody>
            {pairs.map(([left, right], i) => {
              const leftForm = c[left] || '';
              const rightForm = c[right] || '';
              const leftMatch = leftForm.toLowerCase() === lowerSelected;
              const rightMatch = rightForm.toLowerCase() === lowerSelected;
              const rightLabel = right === 'vosotros' ? 'vosotros (Spain)' : right;
              return (
                <tr key={i} className="border-b border-gray-200 last:border-b-0">
                  <td className={"text-gray-500 px-2 py-1.5 border-r border-gray-200" + (leftMatch ? " bg-yellow-100" : "")}>{left}</td>
                  <td className={"px-2 py-1.5 border-r border-gray-300" + (leftMatch ? " bg-yellow-100 text-gray-900 font-semibold" : " text-gray-900")}>{leftForm}</td>
                  <td className={"text-gray-500 px-2 py-1.5 border-r border-gray-200" + (rightMatch ? " bg-yellow-100" : "")}>{rightLabel}</td>
                  <td className={"px-2 py-1.5" + (rightMatch ? " bg-yellow-100 text-gray-900 font-semibold" : " text-gray-900")}>{rightForm}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Returns the part-of-speech label with optional tense annotation */
export function getPartOfSpeechLabel(
  partOfSpeech: string,
  verbChart: EnhancedTranslation['verbChart'],
  currentLang: string
): string {
  const posLabel = currentLang === 'es' ? (posMap[partOfSpeech] || partOfSpeech) : partOfSpeech;
  let tenseLabel = '';
  if (['verb', 'auxiliary verb', 'modal verb'].includes(partOfSpeech) && verbChart?.tense) {
    const rawTense = verbChart.tense;
    const tense = rawTense.replace(/, (modal verb|auxiliary verb)$/i, '').trim();
    const nativeMap = currentLang === 'en' ? tenseToEnglish : tenseToSpanish;
    const nativeTense = nativeMap[tense];
    tenseLabel = nativeTense ? `, ${tense} (${nativeTense})` : `, ${tense}`;
  }
  return `${posLabel}${tenseLabel}`;
}
