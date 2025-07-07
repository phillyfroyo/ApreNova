'use client'

import { useUserLevel } from '@/hooks/useUserLevel'

export default function SettingsLevelDisplay() {
  const selectedLevel = useUserLevel()

  if (!selectedLevel) {
    const lang = typeof window !== 'undefined' && window.location.pathname.startsWith('/en') ? 'en' : 'es'
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
    <div className="text-xs text-black/80 mb-4">
      🎯 Current Level: {selectedLevel.toUpperCase()}
    </div>
  )
}

