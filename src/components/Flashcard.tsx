// src/components/Flashcard.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { QUALITY_RATINGS, type QualityRating, formatInterval, getIntervalPreview } from '@/lib/sm2';

interface EnrichedData {
  partOfSpeech?: string;
  contextTranslation?: string;
  isDerivative?: boolean;
  rootWord?: string;
  rootTranslation?: string;
  otherCommonTranslations?: Array<string | { translation: string; example?: { en: string; es: string } }>;
  subject?: string;
  subjectTranslation?: string;
  derivatives?: Array<{
    pos: string;
    word: string;
    translation: string;
    example?: { en: string; es: string };
  }>;
  verbChart?: {
    tense: string;
    infinitive: string;
    conjugations: Record<string, string>;
  };
}

interface FlashcardProps {
  word: string;
  translation: string;
  direction: 'es-en' | 'en-es';
  sourceSentence?: string | null;
  translatedSentence?: string | null;
  enrichedData?: EnrichedData | null;
  easeFactor: number;
  interval: number;
  repetitions: number;
  stability?: number;
  onRate: (quality: number) => void;
  lang?: 'en' | 'es';
}

const posToSpanish: Record<string, string> = {
  noun: 'sustantivo', verb: 'verbo', adjective: 'adjetivo',
  adverb: 'adverbio', preposition: 'preposici\u00f3n', pronoun: 'pronombre',
  conjunction: 'conjunci\u00f3n', determiner: 'determinante',
  'auxiliary verb': 'verbo auxiliar', 'modal verb': 'verbo modal',
};

const spanishPronounPairs: [string, string][] = [
  ['yo', 'nosotros'],
  ['t\u00fa', 'vosotros'],
  ['el/ella/usted', 'ellos/ellas/ustedes'],
];

const cardLabels = {
  en: {
    yourAnswer: 'Your answer',
    check: 'Check',
    conjugate: 'Conjugate',
    moreInfo: 'More Info',
    rootWord: 'Root Word',
    otherUses: 'Other Uses',
    wordFamily: 'Word Family',
    correct: 'Correct!',
    youTyped: 'You typed',
    typeBelow: 'Type your answer below',
    conjugations: 'Conjugations',
    HARD: 'Hard',
    GOOD: 'Good',
    EASY: 'Easy',
    MASTERED: 'Mastered',
  },
  es: {
    yourAnswer: 'Tu respuesta',
    check: 'Verificar',
    conjugate: 'Conjuga',
    moreInfo: 'M\u00e1s informaci\u00f3n',
    rootWord: 'Ra\u00edz',
    otherUses: 'Otros usos',
    wordFamily: 'Familia de palabras',
    correct: '\u00a1Correcto!',
    youTyped: 'Escribiste',
    typeBelow: 'Escribe tu respuesta abajo',
    conjugations: 'Conjugaciones',
    HARD: 'Dif\u00edcil',
    GOOD: 'Bien',
    EASY: 'F\u00e1cil',
    MASTERED: 'Dominada',
  },
};

const ratingColors = {
  HARD: 'bg-red-500 hover:bg-red-600',
  GOOD: 'bg-amber-500 hover:bg-amber-600',
  EASY: 'bg-green-500 hover:bg-green-600',
  MASTERED: 'bg-indigo-500 hover:bg-indigo-600',
};

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export default function Flashcard({
  word, translation, direction, sourceSentence, translatedSentence,
  enrichedData, easeFactor, interval, repetitions, stability = 0,
  onRate, lang = 'es',
}: FlashcardProps) {
  const [typedAnswer, setTypedAnswer] = useState('');
  const [typedConjugations, setTypedConjugations] = useState<Record<string, string>>({});
  const [isChecked, setIsChecked] = useState(false);
  const [showMoreInfo, setShowMoreInfo] = useState(false);
  const answerRef = useRef<HTMLInputElement>(null);

  const labels = cardLabels[lang] || cardLabels.es;
  const enriched: EnrichedData = (enrichedData as EnrichedData) || {};
  const pos = enriched.partOfSpeech;
  const isVerb = ['verb', 'auxiliary verb', 'modal verb'].includes(pos || '');
  const verbChart = enriched.verbChart;
  const hasSpanishChart = !!(verbChart?.conjugations && 'yo' in verbChart.conjugations);
  const showConjugations = isVerb && hasSpanishChart && direction === 'es-en';

  const subj = isVerb ? enriched.subject : null;
  const subjTrans = isVerb ? enriched.subjectTranslation : null;
  const displayWord = subj ? `${subj} ${word}` : word;
  const displayTranslation = subjTrans ? `${subjTrans} ${translation}` : translation;
  const front = direction === 'es-en' ? displayWord : displayTranslation;
  const back = direction === 'es-en' ? displayTranslation : displayWord;
  const frontLang = direction === 'es-en' ? 'ES' : 'EN';
  const backLang = direction === 'es-en' ? 'EN' : 'ES';
  const frontLangCode = direction === 'es-en' ? 'es' : 'en';
  const backLangCode = direction === 'es-en' ? 'en' : 'es';
  const frontSentence = direction === 'es-en' ? sourceSentence : translatedSentence;
  const backSentence = direction === 'es-en' ? translatedSentence : sourceSentence;

  const frontPos = pos ? (frontLangCode === 'es' ? (posToSpanish[pos] || pos) : pos) : null;
  const backPos = pos ? (backLangCode === 'es' ? (posToSpanish[pos] || pos) : pos) : null;
  const bareBack = direction === 'es-en' ? translation : word;
  const typed = typedAnswer.trim().toLowerCase();
  const isAnswerCorrect = typed === back.trim().toLowerCase() || typed === bareBack.trim().toLowerCase();

  const conjugationResults = showConjugations && verbChart
    ? spanishPronounPairs.flatMap(([left, right]) => [left, right]).map(pronoun => {
        const chartKey = Object.keys(verbChart.conjugations).find(
          k => stripAccents(k.toLowerCase()) === stripAccents(pronoun.toLowerCase())
        ) || pronoun;
        const correct = verbChart.conjugations[chartKey] || '';
        const typed = (typedConjugations[pronoun] || '').trim();
        return { pronoun, chartKey, correct, typed, isCorrect: typed.toLowerCase() === correct.toLowerCase(), isEmpty: !typed };
      })
    : [];
  const conjugationCorrectCount = conjugationResults.filter(r => r.isCorrect).length;
  const conjugationTotal = conjugationResults.length;

  useEffect(() => {
    if (!isChecked) {
      const timer = setTimeout(() => answerRef.current?.focus(), 150);
      return () => clearTimeout(timer);
    }
  }, [isChecked]);

  const handleCheck = () => {
    if (!typedAnswer.trim()) { answerRef.current?.focus(); return; }
    setIsChecked(true);
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleCheck(); }
  };

  const previews = getIntervalPreview({ repetitions, easeFactor, interval, stability });
  const handleRate = (rating: QualityRating) => onRate(QUALITY_RATINGS[rating]);

  const hasMoreInfo = !!(
    (enriched.isDerivative && enriched.rootWord) ||
    (enriched.otherCommonTranslations && enriched.otherCommonTranslations.length > 0) ||
    (enriched.derivatives && enriched.derivatives.length > 0) ||
    (hasSpanishChart && !showConjugations)
  );
  const showSpanishFirst = lang === 'en';

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="relative h-64 perspective-1000 mb-4">
        <motion.div className="w-full h-full" initial={false} animate={{ rotateY: isChecked ? 180 : 0 }} transition={{ duration: 0.4, ease: 'easeInOut' }} style={{ transformStyle: 'preserve-3d' }}>
          <div className="absolute inset-0 bg-white rounded-2xl shadow-lg border border-gray-200 p-6 flex flex-col items-center justify-center" style={{ backfaceVisibility: 'hidden' }}>
            <div className="absolute top-3 left-3 right-3 flex justify-between items-center">
              <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{frontLang}</span>
              {frontPos && <span className="text-xs italic text-gray-400">{frontPos}</span>}
            </div>
            <p className="text-3xl font-bold text-gray-900 text-center">{front}</p>
            {frontSentence && <p className="text-sm text-gray-400 text-center mt-4 line-clamp-2">{frontSentence}</p>}
            <p className="absolute bottom-4 text-sm text-gray-400">{labels.typeBelow}</p>
          </div>
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl shadow-lg border border-indigo-200 p-6 flex flex-col items-center justify-center" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
            <div className="absolute top-3 left-3 right-3 flex justify-between items-center">
              <span className="text-xs font-medium text-indigo-500 bg-indigo-100 px-2 py-0.5 rounded">{backLang}</span>
              {backPos && <span className="text-xs italic text-indigo-400">{backPos}</span>}
            </div>
            <p className="text-xs text-indigo-400 mb-1">{front}</p>
            <p className="text-3xl font-bold text-indigo-900 text-center">{back}</p>
            {isChecked && (
              <div className="mt-2 text-center">
                {isAnswerCorrect
                  ? <span className="text-sm font-medium text-green-600">{'\u2713'} {labels.correct}</span>
                  : <span className="text-sm text-red-500">{'\u2717'} {labels.youTyped}: &quot;{typedAnswer.trim()}&quot;</span>}
              </div>
            )}
            {backSentence && <p className="text-sm text-indigo-400 text-center mt-3 line-clamp-2">{backSentence}</p>}
          </div>
        </motion.div>
      </div>

      <AnimatePresence mode="wait">
        {!isChecked ? (
          <motion.div key="question" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-600 mb-1 block">{labels.yourAnswer}</label>
              <input ref={answerRef} type="text" value={typedAnswer} onChange={e => setTypedAnswer(e.target.value)} onKeyDown={handleKeyDown} className="w-full px-4 py-3 border border-gray-300 rounded-xl text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} />
            </div>

            {showConjugations && verbChart && (
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-600 mb-2">
                  {labels.conjugate}:{' '}<span className="font-bold">{verbChart.infinitive}</span>{' \u2014 '}<span className="italic">{verbChart.tense}</span>
                </p>
                <table className="w-full text-sm border-collapse border border-gray-200 rounded-lg overflow-hidden">
                  <tbody>
                    {spanishPronounPairs.map(([left, right], i) => (
                      <tr key={i} className="border-b border-gray-200 last:border-b-0">
                        <td className="text-gray-500 px-2 py-1.5 border-r border-gray-200 text-xs whitespace-nowrap">{left}</td>
                        <td className="px-1 py-1 border-r border-gray-300">
                          <input type="text" value={typedConjugations[left] || ''} onChange={e => setTypedConjugations(prev => ({ ...prev, [left]: e.target.value }))} onKeyDown={handleKeyDown} className="w-full px-1.5 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} />
                        </td>
                        <td className="text-gray-500 px-2 py-1.5 border-r border-gray-200 text-xs whitespace-nowrap">{right}</td>
                        <td className="px-1 py-1">
                          <input type="text" value={typedConjugations[right] || ''} onChange={e => setTypedConjugations(prev => ({ ...prev, [right]: e.target.value }))} onKeyDown={handleKeyDown} className="w-full px-1.5 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <button onClick={handleCheck} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors">{labels.check}</button>
          </motion.div>
        ) : (
          <motion.div key="answer" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2, delay: 0.3 }}>
            {showConjugations && verbChart && conjugationResults.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-600 mb-2">{labels.conjugations}: {conjugationCorrectCount}/{conjugationTotal}</p>
                <table className="w-full text-sm border-collapse border border-gray-200 rounded-lg overflow-hidden">
                  <tbody>
                    {spanishPronounPairs.map(([left, right], i) => {
                      const leftR = conjugationResults.find(r => r.pronoun === left);
                      const rightR = conjugationResults.find(r => r.pronoun === right);
                      const bgFor = (r?: typeof leftR) => r?.isCorrect ? 'bg-green-50' : r?.isEmpty ? 'bg-gray-50' : 'bg-red-50';
                      const textFor = (r?: typeof leftR) => r?.isCorrect ? 'text-green-700 font-medium' : 'text-red-600';
                      return (
                        <tr key={i} className="border-b border-gray-200 last:border-b-0">
                          <td className={`text-gray-500 px-2 py-1.5 border-r border-gray-200 text-xs whitespace-nowrap ${bgFor(leftR)}`}>{left}</td>
                          <td className={`px-2 py-1.5 border-r border-gray-300 ${bgFor(leftR)}`}>
                            <span className={textFor(leftR)}>{leftR?.correct}</span>
                            {leftR && !leftR.isCorrect && !leftR.isEmpty && <span className="text-xs text-gray-400 ml-1">({leftR.typed})</span>}
                          </td>
                          <td className={`text-gray-500 px-2 py-1.5 border-r border-gray-200 text-xs whitespace-nowrap ${bgFor(rightR)}`}>{right}</td>
                          <td className={`px-2 py-1.5 ${bgFor(rightR)}`}>
                            <span className={textFor(rightR)}>{rightR?.correct}</span>
                            {rightR && !rightR.isCorrect && !rightR.isEmpty && <span className="text-xs text-gray-400 ml-1">({rightR.typed})</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {hasMoreInfo && (
              <div className="mb-4">
                <button onClick={() => setShowMoreInfo(prev => !prev)} className="flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors">
                  <ChevronDown className={`w-4 h-4 transition-transform ${showMoreInfo ? 'rotate-180' : ''}`} />
                  {labels.moreInfo}
                </button>
                <AnimatePresence>
                  {showMoreInfo && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                      <div className="mt-2 bg-white rounded-xl border border-gray-200 p-4 space-y-3 text-sm">
                        {enriched.isDerivative && enriched.rootWord && (
                          <div>
                            <p className="font-semibold text-gray-700">{labels.rootWord}</p>
                            <p className="text-gray-600"><span className="font-medium">{enriched.rootWord}</span> = {enriched.rootTranslation}</p>
                          </div>
                        )}
                        {enriched.otherCommonTranslations && enriched.otherCommonTranslations.length > 0 && (
                          <div>
                            <p className="font-semibold text-gray-700">{labels.otherUses}</p>
                            <ul className="list-disc list-inside text-gray-600">
                              {enriched.otherCommonTranslations.map((item, i) => {
                                const label = typeof item === 'string' ? item : item.translation;
                                const example = typeof item === 'object' && item.example ? item.example : null;
                                return (
                                  <li key={i}>
                                    {label}
                                    {example && (
                                      <div className="ml-4 text-xs text-gray-400">
                                        {showSpanishFirst
                                          ? <><p>&quot;{example.es}&quot;</p><p className="italic">&quot;{example.en}&quot;</p></>
                                          : <><p>&quot;{example.en}&quot;</p><p className="italic">&quot;{example.es}&quot;</p></>}
                                      </div>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        )}
                        {enriched.derivatives && enriched.derivatives.length > 0 && (
                          <div>
                            <p className="font-semibold text-gray-700">{labels.wordFamily}</p>
                            <div className="space-y-1.5">
                              {enriched.derivatives.map((d, i) => (
                                <div key={i} className="text-gray-600">
                                  <span className="text-gray-400 italic text-xs">({d.pos})</span>{' '}
                                  <span className="font-medium">{d.word}</span> = {d.translation}
                                  {d.example && (
                                    <div className="ml-4 text-xs text-gray-400">
                                      {showSpanishFirst
                                        ? <><p>&quot;{d.example.es}&quot;</p><p className="italic">&quot;{d.example.en}&quot;</p></>
                                        : <><p>&quot;{d.example.en}&quot;</p><p className="italic">&quot;{d.example.es}&quot;</p></>}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {hasSpanishChart && !showConjugations && verbChart && (
                          <div>
                            <p className="font-semibold text-gray-700">{labels.conjugations}: {verbChart.infinitive} &mdash; {verbChart.tense}</p>
                            <table className="w-full text-sm border-collapse border border-gray-200 mt-1">
                              <tbody>
                                {spanishPronounPairs.map(([left, right], i) => {
                                  const leftKey = Object.keys(verbChart.conjugations).find(k => stripAccents(k.toLowerCase()) === stripAccents(left.toLowerCase())) || left;
                                  const rightKey = Object.keys(verbChart.conjugations).find(k => stripAccents(k.toLowerCase()) === stripAccents(right.toLowerCase())) || right;
                                  return (
                                    <tr key={i} className="border-b border-gray-200 last:border-b-0">
                                      <td className="text-gray-500 px-2 py-1 border-r border-gray-200 text-xs">{left}</td>
                                      <td className="px-2 py-1 border-r border-gray-300 text-gray-900">{verbChart.conjugations[leftKey]}</td>
                                      <td className="text-gray-500 px-2 py-1 border-r border-gray-200 text-xs">{right}</td>
                                      <td className="px-2 py-1 text-gray-900">{verbChart.conjugations[rightKey]}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            <div className="grid grid-cols-4 gap-2">
              {(['HARD', 'GOOD', 'EASY', 'MASTERED'] as QualityRating[]).map((rating) => (
                <button key={rating} onClick={() => handleRate(rating)} className={`${ratingColors[rating]} text-white py-3 px-2 rounded-xl font-medium transition-colors flex flex-col items-center gap-1`}>
                  <span className="text-sm">{labels[rating]}</span>
                  <span className="text-xs opacity-75">{formatInterval(previews[rating], lang)}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
