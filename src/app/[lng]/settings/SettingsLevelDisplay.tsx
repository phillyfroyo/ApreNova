// src/app/[lng]/settings/SettingsLevelDisplay
'use client'

import { useUserLevel } from '@/hooks/useUserLevel'
import { useState } from 'react'
import { useRouter, useParams } from "next/navigation";
import type { Language } from "@/types/i18n";
import { t } from '@/lib/t';



export default function SettingsLevelDisplay() {
  const selectedLevel = useUserLevel()
  const [editing, setEditing] = useState(false)

  const router = useRouter();
  const { lng } = useParams();
  const goToQuiz = () => router.push(`/${typedLang}/home/quiz/l1/q1`);
  const typedLang = lng as Language;


  if (!selectedLevel) {
    return (
      <div
        className="text-sm text-blue-800 mb-4 cursor-pointer"
        onClick={goToQuiz}
      >
        {`🎯 ${t(typedLang, 'settings', 'levelUndefined')}`}
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between text-sm mb-2">
      <span className="font-medium">
        🎯 <span className="text-black">{t(typedLang, 'settings', 'currentLevel')}:</span>{selectedLevel.toUpperCase()}
        {editing && (
          <span
            className="ml-2 text-blue-800 underline cursor-pointer"
            onClick={goToQuiz}
          >
            {t(typedLang, 'settings', 'changeLevel')}
          </span>
        )}
      </span>

      <button
        onClick={() => setEditing(!editing)}
        className="text-gray-500 hover:text-black text-base"
      >
        ✏️
      </button>
    </div>
  )
}

