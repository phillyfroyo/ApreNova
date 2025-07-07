'use client'

import { useUserLevel } from '@/hooks/useUserLevel'

export default function SettingsLevelDisplay() {
  const selectedLevel = useUserLevel()

  if (!selectedLevel) return null

  return (
    <div className="text-xs text-black/80 mb-4">
      🎯 Current Level: {selectedLevel.toUpperCase()}
    </div>
  )
}
