'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

export function useUserLevel(defaultLevel: string = 'l2') {
  const { data: session } = useSession()
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null)

  useEffect(() => {
    const fetchLevel = async () => {
      if (!session?.user?.id) return

      try {
        const res = await fetch(`/api/user-level?userId=${session.user.id}`)
        const data = await res.json()
        if (data.level) {
          setSelectedLevel(data.level)
        }
      } catch (err) {
        console.error('Failed to load user level', err)
      }
    }

    fetchLevel()
  }, [session?.user?.id])

  return selectedLevel ?? defaultLevel
}
