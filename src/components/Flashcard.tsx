// src/components/Flashcard.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
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
    yourAnswer: 'Translation:',
    check: 'Check',
    conjugate: 'Conjugate',
    moreInfo: 'More Info',
    rootWord: 'Root Word',
    otherUses: 'Other Uses',
    wordFamily: 'Word Family',
    correct: 'Correct!',
    accentHint: 'Correct, but watch the accents!',
    youTyped: 'You typed',
    typeBelow: 'Type your answer below',
    conjugations: 'Conjugations',
    HARD: 'Hard',
    GOOD: 'Good',
    EASY: 'Easy',
    MASTERED: 'Mastered',
    tryAgain: 'Try Again',
    showAnswer: 'Show Answer',
    wrongAnswer: 'Not quite!',
  },
  es: {
    yourAnswer: 'Traducción:',
    check: 'Verificar',
    conjugate: 'Conjuga',
    moreInfo: 'M\u00e1s informaci\u00f3n',
    rootWord: 'Ra\u00edz',
    otherUses: 'Otros usos',
    wordFamily: 'Familia de palabras',
    correct: '\u00a1Correcto!',
    accentHint: '\u00a1Correcto, pero cuida los acentos!',
    youTyped: 'Escribiste',
    typeBelow: 'Escribe tu respuesta abajo',
    conjugations: 'Conjugaciones',
    HARD: 'Dif\u00edcil',
    GOOD: 'Bien',
    EASY: 'F\u00e1cil',
    MASTERED: 'Dominada',
    tryAgain: 'Intentar de nuevo',
    showAnswer: 'Ver respuesta',
    wrongAnswer: '\u00a1Casi!',
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

function stripPunct(s: string): string {
  return s.replace(/[.,!?;:"""''()¿¡«»…—–\-]+/g, '').trim();
}

function highlightWord(sentence: string, target: string): React.ReactNode {
  if (!target || !sentence) return sentence;
  const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Use lookbehind/lookahead for letter boundaries so "es" doesn't match inside "Entonces"
  const L = '[a-z\u00e1\u00e9\u00ed\u00f3\u00fa\u00fc\u00f1A-Z\u00c1\u00c9\u00cd\u00d3\u00da\u00dc\u00d1]';
  const regex = new RegExp(`(?<!${L})(${escaped})(?!${L})`, 'gi');
  const parts = sentence.split(regex);
  if (parts.length === 1) return sentence;
  return parts.map((part, i) =>
    part.toLowerCase() === target.toLowerCase()
      ? <strong key={i} className="font-semibold text-gray-700">{part}</strong>
      : part
  );
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
  const [shaking, setShaking] = useState(false);
  const [showWrongHint, setShowWrongHint] = useState(false);
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
  const frontTarget = direction === 'es-en' ? word : translation;
  const backTarget = direction === 'es-en' ? translation : word;

  const frontPos = pos ? (frontLangCode === 'es' ? (posToSpanish[pos] || pos) : pos) : null;
  const backPos = pos ? (backLangCode === 'es' ? (posToSpanish[pos] || pos) : pos) : null;
  const bareBack = direction === 'es-en' ? translation : word;
  const typed = typedAnswer.trim().toLowerCase();
  const backNorm = stripPunct(back.trim().toLowerCase());
  const bareNorm = stripPunct(bareBack.trim().toLowerCase());
  const typedNorm = stripPunct(typed);
  const isExactMatch = typedNorm === backNorm || typedNorm === bareNorm;
  const isAccentMatch = !isExactMatch && (
    stripAccents(typedNorm) === stripAccents(backNorm) ||
    stripAccents(typedNorm) === stripAccents(bareNorm)
  );
  const isAnswerCorrect = isExactMatch || isAccentMatch;

  const conjugationResults = showConjugations && verbChart
    ? spanishPronounPairs.flatMap(([left, right]) => [left, right]).map(pronoun => {
        const chartKey = Object.keys(verbChart.conjugations).find(
          k => stripAccents(k.toLowerCase()) === stripAccents(pronoun.toLowerCase())
        ) || pronoun;
        const correct = verbChart.conjugations[chartKey] || '';
        const typed = (typedConjugations[pronoun] || '').trim();
        const exactMatch = typed.toLowerCase() === correct.toLowerCase();
        const accentMatch = !exactMatch && stripAccents(typed.toLowerCase()) === stripAccents(correct.toLowerCase());
        return { pronoun, chartKey, correct, typed, isCorrect: exactMatch || accentMatch, accentOnly: accentMatch, isEmpty: !typed };
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
    // Compute answer correctness inline (same logic as render)
    const t = stripPunct(typedAnswer.trim().toLowerCase());
    const backVal = stripPunct((direction === 'es-en'
      ? (isVerb && enriched.subjectTranslation ? enriched.subjectTranslation + ' ' + translation : translation)
      : (isVerb && enriched.subject ? enriched.subject + ' ' + word : word)).trim().toLowerCase());
    const bareVal = stripPunct((direction === 'es-en' ? translation : word).trim().toLowerCase());
    const correct = t === backVal || t === bareVal
      || stripAccents(t) === stripAccents(backVal)
      || stripAccents(t) === stripAccents(bareVal);
    if (correct) {
      setShowWrongHint(false);
      setIsChecked(true);
    } else {
      // Wrong answer — shake, vibrate, don't flip
      setShowWrongHint(true);
      setShaking(true);
      if (navigator.vibrate) navigator.vibrate(200);
      setTimeout(() => setShaking(false), 500);
      answerRef.current?.focus();
    }
  };
  const handleShowAnswer = () => {
    setShowWrongHint(false);
    setIsChecked(true);
  };
  const handleRetry = () => {
    setShowWrongHint(false);
    setTypedAnswer('');
    answerRef.current?.focus();
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
    (isVerb && hasSpanishChart && !showConjugations)
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
            {frontSentence && <p className="text-sm text-gray-400 text-center mt-4 line-clamp-2">{highlightWord(frontSentence, frontTarget)}</p>}
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
                {isExactMatch
                  ? <span className="text-sm font-medium text-green-600">{'\u2713'} {labels.correct}</span>
                  : isAccentMatch
                  ? <span className="text-sm font-medium text-amber-600">{'\u2713'} {labels.accentHint}</span>
                  : <span className="text-sm text-red-500">{'\u2717'} {labels.youTyped}: &quot;{typedAnswer.trim()}&quot;</span>}
              </div>
            )}
            {backSentence && <p className="text-sm text-indigo-400 text-center mt-3 line-clamp-2">{highlightWord(backSentence, backTarget)}</p>}
          </div>
        </motion.div>
      </div>

      <AnimatePresence mode="wait">
        {!isChecked ? (
          <motion.div key="question" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-600 mb-1 block">{labels.yourAnswer}</label>
              <input ref={answerRef} type="text" value={typedAnswer} onChange={e => setTypedAnswer(e.target.value)} onKeyDown={handleKeyDown} className={`w-full px-4 py-3 border rounded-xl text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${showWrongHint ? 'border-red-300' : 'border-gray-300'} ${shaking ? 'animate-shake' : ''}`} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} />
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

            {showWrongHint && (
              <div className="mb-3 text-center">
                <p className="text-sm text-red-500 font-medium mb-2">{labels.wrongAnswer}</p>
                <div className="flex gap-2">
                  <button onClick={handleRetry} className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl font-medium hover:bg-gray-200 transition-colors text-sm">{labels.tryAgain}</button>
                  <button onClick={handleShowAnswer} className="flex-1 bg-red-50 text-red-600 py-2.5 rounded-xl font-medium hover:bg-red-100 transition-colors text-sm">{labels.showAnswer}</button>
                </div>
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
                      const bgFor = (r?: typeof leftR) => r?.accentOnly ? 'bg-amber-50' : r?.isCorrect ? 'bg-green-50' : r?.isEmpty ? 'bg-gray-50' : 'bg-red-50';
                      const textFor = (r?: typeof leftR) => r?.isCorrect ? 'text-green-700 font-medium' : 'text-red-600';
                      return (
                        <tr key={i} className="border-b border-gray-200 last:border-b-0">
                          <td className={`text-gray-500 px-2 py-1.5 border-r border-gray-200 text-xs whitespace-nowrap ${bgFor(leftR)}`}>{left}</td>
                          <td className={`px-2 py-1.5 border-r border-gray-300 ${bgFor(leftR)}`}>
                            <span className={textFor(leftR)}>{leftR?.correct}</span>
                            {leftR?.accentOnly && <span className="text-xs text-amber-500 ml-1">~</span>}
                            {leftR && !leftR.isCorrect && !leftR.isEmpty && <span className="text-xs text-gray-400 ml-1">({leftR.typed})</span>}
                          </td>
                          <td className={`text-gray-500 px-2 py-1.5 border-r border-gray-200 text-xs whitespace-nowrap ${bgFor(rightR)}`}>{right}</td>
                          <td className={`px-2 py-1.5 ${bgFor(rightR)}`}>
                            <span className={textFor(rightR)}>{rightR?.correct}</span>
                            {rightR?.accentOnly && <span className="text-xs text-amber-500 ml-1">~</span>}
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
                      <div className="mt-2 bg-white rounded-xl border border-gray-200 p-5 text-sm leading-7 divide-y divide-gray-100 [&>*]:py-3 first:[&>*]:pt-0 last:[&>*]:pb-0">
                        {enriched.isDerivative && enriched.rootWord && (
                          <div>
                            <p className="font-semibold text-gray-700 mb-1.5 text-[0.9375rem]">{labels.rootWord}</p>
                            <p className="text-gray-600"><span className="font-medium">{enriched.rootWord}</span> = {enriched.rootTranslation}</p>
                          </div>
                        )}
                        {enriched.otherCommonTranslations && enriched.otherCommonTranslations.length > 0 && (
                          <div>
                            <p className="font-semibold text-gray-700 mb-1.5 text-[0.9375rem]">{labels.otherUses}</p>
                            <ul className="list-disc list-inside text-gray-600">
                              {enriched.otherCommonTranslations.map((item, i) => {
                                const label = typeof item === 'string' ? item : item.translation;
                                const example = typeof item === 'object' && item.example ? item.example : null;
                                return (
                                  <li key={i}>
                                    {label}
                                    {example && (
                                      <div className="ml-4 text-[0.8125rem] text-gray-400 mt-1 leading-relaxed">
                                        {showSpanishFirst
                                          ? <><p>&quot;{highlightWord(example.es, word)}&quot;</p><p className="italic">&quot;{highlightWord(example.en, translation)}&quot;</p></>
                                          : <><p>&quot;{highlightWord(example.en, translation)}&quot;</p><p className="italic">&quot;{highlightWord(example.es, word)}&quot;</p></>}
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
                            <p className="font-semibold text-gray-700 mb-1.5 text-[0.9375rem]">{labels.wordFamily}</p>
                            <div className="space-y-3">
                              {enriched.derivatives.map((d, i) => (
                                <div key={i} className="text-gray-600">
                                  <span className="text-gray-400 italic text-[0.8125rem]">({d.pos})</span>{' '}
                                  <span className="font-medium">{d.word}</span> = {d.translation}
                                  {d.example && (
                                    <div className="ml-4 text-[0.8125rem] text-gray-400 mt-1 leading-relaxed">
                                      {showSpanishFirst
                                        ? <><p>&quot;{highlightWord(d.example.es, d.word)}&quot;</p><p className="italic">&quot;{highlightWord(d.example.en, d.translation)}&quot;</p></>
                                        : <><p>&quot;{highlightWord(d.example.en, d.translation)}&quot;</p><p className="italic">&quot;{highlightWord(d.example.es, d.word)}&quot;</p></>}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {isVerb && hasSpanishChart && !showConjugations && verbChart && (
                          <div>
                            <p className="font-semibold text-gray-700 mb-1.5 text-[0.9375rem]">{labels.conjugations}: {verbChart.infinitive} &mdash; {verbChart.tense}</p>
                            <div className="overflow-x-auto">
                            <table className="text-sm w-full border-collapse border border-gray-200 mt-1 min-w-[340px]">
                              <tbody>
                                {spanishPronounPairs.map(([left, right], i) => {
                                  const leftKey = Object.keys(verbChart.conjugations).find(k => stripAccents(k.toLowerCase()) === stripAccents(left.toLowerCase())) || left;
                                  const rightKey = Object.keys(verbChart.conjugations).find(k => stripAccents(k.toLowerCase()) === stripAccents(right.toLowerCase())) || right;
                                  return (
                                    <tr key={i} className="border-b border-gray-200 last:border-b-0">
                                      <td className="text-gray-500 px-2 py-1.5 border-r border-gray-200 text-[0.8125rem]">{left}</td>
                                      <td className="px-2 py-1.5 border-r border-gray-300 text-gray-900">{verbChart.conjugations[leftKey]}</td>
                                      <td className="text-gray-500 px-2 py-1.5 border-r border-gray-200 text-[0.8125rem]">{right === 'vosotros' ? 'vosotros (Spain)' : right}</td>
                                      <td className="px-2 py-1.5 text-gray-900">{verbChart.conjugations[rightKey]}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                            </div>
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
