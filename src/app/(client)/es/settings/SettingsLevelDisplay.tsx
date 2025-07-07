'use client'

import { useUserLevel } from '@/hooks/useUserLevel'
import { useState } from 'react'

export default function SettingsLevelDisplay() {
  const selectedLevel = useUserLevel()
  const [editing, setEditing] = useState(false)

  if (!selectedLevel) {
    const lang =
      typeof window !== 'undefined' && window.location.pathname.startsWith('/en') ? 'en' : 'es'
    return (
      <div
        className="text-sm text-blue-800 mb-4 cursor-pointer"
        onClick={() => {
          window.location.href = `/${lang}/home/quiz/l1/q1`
        }}
      >
        🎯 Current Level: Undefined. Take the Quiz
      </div>
    )
  }

  const lang =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/en') ? 'en' : 'es'

  return (
    <div className="flex items-center justify-between text-sm mb-2">
      <span className="font-medium">
        🎯 <span className="text-black">Current Level:</span> {selectedLevel.toUpperCase()}
        {editing && (
          <span
            className="ml-2 text-blue-800 underline cursor-pointer"
            onClick={() => {
              window.location.href = `/${lang}/home/quiz/l1/q1`
            }}
          >
            take the quiz to change your level
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

