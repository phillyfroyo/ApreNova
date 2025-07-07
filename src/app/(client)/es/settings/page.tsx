'use client'

import { useSession, signOut, getSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import { useUserLevel } from "@/hooks/useUserLevel"
import { Suspense, useState } from 'react'
import SettingsLevelDisplay from './SettingsLevelDisplay'
import EditableField from '@/components/ui/EditableField'

export default function SettingsPage() {
  const { data: session, status, update } = useSession() // ✅ Everything here
  const router = useRouter()
  const [sessionKey, setSessionKey] = useState(0)

  if (status === 'loading') return <p>Loading...</p>
  if (!session?.user?.email) return <p>Not logged in</p>

  const email = session.user.email

  const updateUserField = async (field: string, value: string) => {
    try {
      await fetch("/api/user/update-field", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, value }),
      })

      await update()          // 🔁 Refresh session context
      router.refresh()        // 🔃 Optional SSR refresh
    } catch (err) {
      console.error("Failed to update user field:", err)
    }
  }
  
  return (
  <div key={sessionKey}>
    <div
      className="min-h-screen h-screen bg-cover bg-center px-4 py-10 text-black"
      style={{ backgroundImage: 'url(/images/background3.png)' }}
    >
      <div className="flex justify-center mb-6">
        <Logo />
      </div>

      <h1 className="text-2xl font-bold text-center mb-6">
        ¡Hola {session.user.name || session.user.email}! 🎉
      </h1>

      <div className="text-left max-w-sm mx-auto">
        <EditableField
          label="👤"
          value={session.user.name ?? ''}
          onSave={(newVal) => updateUserField('name', newVal)}
        />

        <EditableField
          label="📧"
          value={email}
          onSave={(newVal) => updateUserField('email', newVal)}
        />

        <EditableField
          label="🌐 My native language:"
          value={session.user.nativeLanguage ?? ''}
          inputType="select"
          options={['es', 'en', 'fr', 'de']}
          onSave={(lang) => updateUserField('nativeLanguage', lang)}
        />

        <Suspense fallback={<div className="text-xs mb-4">🎯 Loading level...</div>}>
          <SettingsLevelDisplay />
        </Suspense>
      </div>

      <div
        className="mb-3 text-green-700 cursor-pointer hover:underline"
        onClick={() => {
          const lang = window.location.pathname.startsWith('/en') ? 'en' : 'es'
          window.location.href = `/${lang}/home/quiz/l1/q1`
        }}
      >
        Take the Quiz
      </div>

      <div
        className="text-red-600 cursor-pointer hover:underline"
        onClick={() => signOut({ callbackUrl: '/' })}
      >
        Log out
      </div>
    </div>
  </div>
)}
