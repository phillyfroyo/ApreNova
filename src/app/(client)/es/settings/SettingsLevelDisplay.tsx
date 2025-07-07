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
        className="text-xs text-blue-800 mb-4 cursor-pointer"
        onClick={() => {
          window.location.href = `/${lang}/home/quiz/l1/q1`
        }}
      >
        🎯 Current Level: Undefined. Take the Quiz
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 text-xs mb-4">
      {editing ? (
        <span className="text-blue-800">🎯 Take the Quiz</span>
      ) : (
        <span>🎯 Current Level: {selectedLevel.toUpperCase()}</span>
      )}
      <button onClick={() => setEditing(!editing)} className="text-gray-500 hover:text-black">
        ✏️
      </button>
    </div>
  )
}

