// src/components/story-reader/StanzaTranslationCard.tsx
"use client";

import Link from "next/link";
import { useStoryReader } from "@/contexts/StoryReaderContext";
import { t } from "@/lib/t";
import type { StoryLine } from "@/lib/story-processing/text-processing";

interface StanzaTranslationCardProps {
  stanzaIdx: number;
  stanza: StoryLine[];
}

export default function StanzaTranslationCard({ stanzaIdx, stanza }: StanzaTranslationCardProps) {
  const {
    typedLang, oppositeLang, currentLevel,
    stanzaAITranslation, setStanzaAITranslation,
    stanzaExampleMap, setStanzaExampleMap,
    visibleStanzaExamples, toggleStanzaExample,
    stanzaTranslationRefs,
  } = useStoryReader();

  const aiTranslation = stanzaAITranslation[stanzaIdx];
  const showSpanishFirst = typedLang === "en";

  const fetchStanzaExample = async (translation: string, selectedWord: string) => {
    const isSpanishSource = oppositeLang === "es";
    const sourceWord = isSpanishSource ? selectedWord : translation;
    const targetWord = isSpanishSource ? translation : selectedWord;

    if (stanzaExampleMap[translation]) {
      setStanzaExampleMap(prev => { const u = { ...prev }; delete u[translation]; return u; });
      return;
    }
    try {
      const res = await fetch(`/api/example-sentence?lang=${oppositeLang === "es" ? "en" : "es"}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spanishWord: isSpanishSource ? sourceWord : targetWord,
          englishWord: isSpanishSource ? targetWord : sourceWord,
          originalSentence: stanza.filter(l => !l.isStanzaBreak && l[oppositeLang]?.trim()).map(l => l[oppositeLang]).join(" "),
          level: currentLevel,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setStanzaExampleMap(prev => ({ ...prev, [translation]: { english: data.english, spanish: data.spanish } }));
    } catch (err) {
      console.error("[StanzaExample] Failed:", err);
    }
  };

  const posMap: Record<string, string> = {
    noun: "sustantivo", verb: "verbo", adjective: "adjetivo", adverb: "adverbio",
    preposition: "preposición", pronoun: "pronombre", conjunction: "conjunción",
    determiner: "determinante", "auxiliary verb": "verbo auxiliar", "modal verb": "verbo modal",
  };
  const tenseToEnglish: Record<string, string> = {
    Presente: "present", "Pretérito": "simple past", Preterito: "simple past",
    Imperfecto: "imperfect", Futuro: "future", "Futuro Simple": "simple future",
    Condicional: "conditional", "Presente Perfecto": "present perfect",
    "Pretérito Perfecto": "present perfect", Pluscuamperfecto: "past perfect",
    "Pretérito Pluscuamperfecto": "past perfect", "Futuro Perfecto": "future perfect",
    "Subjuntivo Presente": "present subjunctive", "Subjuntivo Imperfecto": "imperfect subjunctive",
    Imperativo: "imperative", "Presente Progresivo": "present progressive", "Pretérito Progresivo": "past progressive",
  };
  const tenseToSpanish: Record<string, string> = {
    "Present Simple": "presente simple", "Simple Present": "presente simple",
    "Past Simple": "pasado simple", "Simple Past": "pasado simple",
    "Present Continuous": "presente continuo", "Present Progressive": "presente progresivo",
    "Past Continuous": "pasado continuo", "Past Progressive": "pasado progresivo",
    "Present Perfect": "presente perfecto", "Past Perfect": "pasado perfecto",
    "Future Simple": "futuro simple", "Simple Future": "futuro simple",
    Future: "futuro", Conditional: "condicional", "Future Perfect": "futuro perfecto", Imperative: "imperativo",
  };

  const ExPair = ({ example, idx }: { example: { en: string; es: string }; idx: number }) => {
    if (!visibleStanzaExamples.has(idx)) return null;
    return (
      <div className="ml-2 mt-1 text-sm">
        {showSpanishFirst ? (<><p className="text-gray-900">&quot;{example.es}&quot;</p><p className="text-gray-600 italic">&quot;{example.en}&quot;</p></>) : (<><p className="text-gray-900">&quot;{example.en}&quot;</p><p className="text-gray-600 italic">&quot;{example.es}&quot;</p></>)}
      </div>
    );
  };

  return (
    <div>
      {aiTranslation && (
        <div className="px-2 -mt-1">
          <div className="bg-white text-black px-4 pt-3 pb-3 rounded-xl shadow z-50 -ml-[7px]">
            {aiTranslation.loading ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold">{t(typedLang, "translator", "translating")}…</span>
                <span className="animate-pulse text-lg">🧠</span>
              </div>
            ) : (
              <div className="text-sm text-left relative">
                {aiTranslation.enhancedTranslation ? (
                  <>
                    {aiTranslation.enhancedTranslation.partOfSpeech ? (() => {
                      const posLabel = typedLang === "es" ? (posMap[aiTranslation.enhancedTranslation!.partOfSpeech!] || aiTranslation.enhancedTranslation!.partOfSpeech) : aiTranslation.enhancedTranslation!.partOfSpeech;
                      let tenseLabel = "";
                      const pos = aiTranslation.enhancedTranslation!.partOfSpeech!;
                      if (["verb", "auxiliary verb", "modal verb"].includes(pos) && aiTranslation.enhancedTranslation!.verbChart?.tense) {
                        const raw = aiTranslation.enhancedTranslation!.verbChart!.tense;
                        const tense = raw.replace(/, (modal verb|auxiliary verb)$/i, "").trim();
                        const nMap = typedLang === "en" ? tenseToEnglish : tenseToSpanish;
                        const native = nMap[tense];
                        tenseLabel = native ? `, ${tense} (${native})` : `, ${tense}`;
                      }
                      return <p className="text-xs text-gray-500 italic mb-0.5">{posLabel}{tenseLabel}</p>;
                    })() : <p className="font-semibold">{t(typedLang, "translator", "translation")}:</p>}
                    <div className="text-lg font-medium text-gray-900" style={{ wordSpacing: "0.15em" }}>
                      {aiTranslation.enhancedTranslation.subject && !aiTranslation.selectedWord?.toLowerCase().startsWith(aiTranslation.enhancedTranslation.subject.toLowerCase()) && <span className="font-medium text-gray-500">{aiTranslation.enhancedTranslation.subject} </span>}
                      <span className="font-medium">{aiTranslation.selectedWord}</span> = {aiTranslation.enhancedTranslation.subjectTranslation && <span className="text-gray-500">{aiTranslation.enhancedTranslation.subjectTranslation} </span>}{aiTranslation.enhancedTranslation.contextTranslation}
                    </div>
                    {aiTranslation.enhancedTranslation.isDerivative && aiTranslation.enhancedTranslation.rootWord && (
                      <div className="mt-3"><p className="font-semibold text-sm text-gray-700">{t(typedLang, "translator", "rootWord")}:</p><div className="text-sm text-gray-800"><span className="font-medium">{aiTranslation.enhancedTranslation.rootWord}</span> = {aiTranslation.enhancedTranslation.rootTranslation}</div></div>
                    )}
                    {aiTranslation.enhancedTranslation.otherCommonTranslations && aiTranslation.enhancedTranslation.otherCommonTranslations.length > 0 && (
                      <>
                        <p className="font-normal mt-2"><span className="font-bold italic text-gray-800">{aiTranslation.selectedWord}</span> {t(typedLang, "translator", "otherCommonUses")}:</p>
                        <ul className="list-disc list-inside">
                          {aiTranslation.enhancedTranslation.otherCommonTranslations.map((item, i) => {
                            const label = typeof item === "string" ? item : item.translation;
                            const ex = typeof item === "object" && item !== null && "example" in item ? item.example : null;
                            return (<li key={i}>{ex ? <button onClick={() => toggleStanzaExample(i)} className="text-blue-600 hover:underline">{label}</button> : <span className="text-gray-800">{label}</span>}{ex && <ExPair example={ex} idx={i} />}</li>);
                          })}
                        </ul>
                      </>
                    )}
                    {aiTranslation.enhancedTranslation.derivatives && aiTranslation.enhancedTranslation.derivatives.length > 0 && (
                      <div className="mt-3 border-t pt-2">
                        <p className="font-semibold text-sm text-gray-700 mb-1">Word Family:</p>
                        <div className="space-y-2">
                          {aiTranslation.enhancedTranslation.derivatives.map((d, i) => (
                            <div key={i} className="text-sm">
                              <span className="text-gray-500 italic text-xs">({d.pos})</span> <span className="font-medium">{d.word}</span>{" = "}<span className="text-gray-800">{d.translation}</span>
                              {d.example && <div className="ml-4 mt-0.5 text-xs text-gray-500">{showSpanishFirst ? (<><p>&quot;{d.example.es}&quot;</p><p className="italic">&quot;{d.example.en}&quot;</p></>) : (<><p>&quot;{d.example.en}&quot;</p><p className="italic">&quot;{d.example.es}&quot;</p></>)}</div>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {aiTranslation.enhancedTranslation.verbChart && ["verb", "auxiliary verb", "modal verb"].includes(aiTranslation.enhancedTranslation.partOfSpeech || "") && (() => {
                      const vc = aiTranslation.enhancedTranslation.verbChart;
                      const conj = vc.conjugations;
                      const isSpanish = "yo" in conj;
                      const pairs: [string, string][] = isSpanish ? [["yo", "nosotros"], ["tú", "vosotros"], ["él/ella/usted", "ellos/ellas/ustedes"]] : [["I", "we"], ["you", "you all"], ["he/she/it", "they"]];
                      const selWord = (aiTranslation.selectedWord || "").toLowerCase();
                      return (
                        <div className="mt-3 border-t pt-2">
                          <p className="font-semibold text-sm text-gray-700 mb-1">{vc.infinitive} &mdash; {vc.tense}</p>
                          <div className="overflow-x-auto">
                            <table className="text-sm w-full border-collapse border border-gray-200 min-w-[340px]"><tbody>
                              {pairs.map(([left, right], i) => {
                                const lf = conj[left] || ""; const rf = conj[right] || "";
                                const lm = lf.toLowerCase() === selWord; const rm = rf.toLowerCase() === selWord;
                                const rl = right === "vosotros" ? "vosotros (Spain)" : right;
                                return (<tr key={i} className="border-b border-gray-200 last:border-b-0"><td className={`text-gray-500 px-2 py-1.5 border-r border-gray-200${lm ? " bg-yellow-100" : ""}`}>{left}</td><td className={`px-2 py-1.5 border-r border-gray-300${lm ? " bg-yellow-100 text-gray-900 font-semibold" : " text-gray-900"}`}>{lf}</td><td className={`text-gray-500 px-2 py-1.5 border-r border-gray-200${rm ? " bg-yellow-100" : ""}`}>{rl}</td><td className={`px-2 py-1.5${rm ? " bg-yellow-100 text-gray-900 font-semibold" : " text-gray-900"}`}>{rf}</td></tr>);
                              })}
                            </tbody></table>
                          </div>
                        </div>
                      );
                    })()}
                  </>
                ) : aiTranslation.otherTranslations && aiTranslation.otherTranslations.length > 0 ? (
                  <>
                    <div className="text-lg font-medium text-gray-900 mt-1" style={{ wordSpacing: "0.15em" }}>{aiTranslation.text}</div>
                    <p className="font-normal mt-2"><span className="font-bold italic text-gray-800">{aiTranslation.selectedWord}</span> {t(typedLang, "translator", "otherCommonUses")}:</p>
                    <ul className="list-disc list-inside">
                      {aiTranslation.otherTranslations.map((item, i) => {
                        const label = typeof item === "string" ? item : item.translation;
                        const inEx = typeof item === "object" && item !== null && "example" in item ? item.example : null;
                        const fb = stanzaExampleMap[label];
                        return (<li key={i}>
                          {inEx ? <button onClick={() => toggleStanzaExample(i)} className="text-blue-600 hover:underline">{label}</button> : fb ? <button onClick={() => toggleStanzaExample(i)} className="text-blue-600 hover:underline">{label}</button> : <button onClick={() => fetchStanzaExample(label, aiTranslation.selectedWord || "")} className="text-blue-600 hover:underline">{label}</button>}
                          {inEx && <ExPair example={inEx} idx={i} />}
                          {!inEx && fb && visibleStanzaExamples.has(i) && <div className="ml-2 mt-1 text-sm">{showSpanishFirst ? (<><p className="text-gray-900">&quot;{fb.spanish}&quot;</p><p className="text-gray-600 italic">&quot;{fb.english}&quot;</p></>) : (<><p className="text-gray-900">&quot;{fb.english}&quot;</p><p className="text-gray-600 italic">&quot;{fb.spanish}&quot;</p></>)}</div>}
                        </li>);
                      })}
                    </ul>
                  </>
                ) : aiTranslation.authError ? (
                  <div className="text-sm pr-6 mt-1">
                    <span className="text-gray-700">{t(typedLang, "translator", "signInRequired")} </span>
                    <Link href={`/${typedLang}/auth/login`} className="text-indigo-600 hover:underline font-medium">{t(typedLang, "translator", "signIn")}</Link>
                    <span className="text-gray-700"> {t(typedLang, "translator", "or")} </span>
                    <Link href={`/${typedLang}/auth/signup`} className="text-indigo-600 hover:underline font-medium">{t(typedLang, "translator", "createAccount")}</Link>
                  </div>
                ) : (
                  <div className="text-lg font-medium text-gray-900 mt-1 whitespace-pre-line pr-6" style={{ wordSpacing: "0.15em" }}>{aiTranslation.text}</div>
                )}
                <button onClick={() => setStanzaAITranslation(prev => { const n = { ...prev }; delete n[stanzaIdx]; return n; })} className="absolute top-0 right-0 text-gray-400 hover:text-gray-600 text-sm" data-translation-control="close">✕</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Static stanza translation (pencil) */}
      <div ref={el => { stanzaTranslationRefs.current[stanzaIdx] = el; }} className="hidden px-2 mt-1 bg-white text-black px-4 pt-3 pb-3 rounded-xl shadow z-50 -ml-[7px] relative">
        <button onClick={() => { const el = stanzaTranslationRefs.current[stanzaIdx]; if (el) el.classList.add("hidden"); }} className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-sm" data-translation-control="close">✕</button>
        <div className="text-lg font-medium text-gray-900 whitespace-pre-line pr-6" style={{ wordSpacing: "0.15em" }}>
          {stanza.filter(l => !l.isStanzaBreak && l[typedLang]?.trim()).map((line, idx) => <p key={idx}>{line[typedLang]}</p>)}
        </div>
      </div>
    </div>
  );
}
