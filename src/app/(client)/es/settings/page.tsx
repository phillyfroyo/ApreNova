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

if (!session?.user?.email) {
  return (
    <div className="min-h-screen relative bg-[url('/images/background3.png')] bg-cover bg-center text-black px-6">

  {/* Back Button */}
  <div className="absolute top-4 left-4">
    <button
      onClick={() => window.location.href = '/es/stories'}
      className="text-sm text-blue-700 hover:underline"
    >
      ← Back to stories
    </button>
  </div>

  {/* Layout container */}
  <div className="flex flex-col items-center justify-center min-h-screen relative">

    {/* Logo slightly higher */}
    <div className="absolute top-[20%]">
      <Logo />
    </div>

    {/* Centered message + auth links */}
    <div className="text-center mt-10 space-y-4">
      <p className="text-xl font-semibold">You’re not logged in.</p>

      <div className="text-sm text-black text-center space-y-2">
        <p>
          Already have an account?{' '}
          <a href="/es/auth/login" className="text-blue-700 underline">
            Sign in
          </a>
        </p>

        <div className="text-gray-500 text-xs">or</div>

        <a
          href="/es/auth/signup"
          className="text-blue-700 font-semibold"
        >
          Create a new account
        </a>
      </div>
    </div>
  </div>
</div>

  )
}



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
  className="relative min-h-screen h-screen bg-cover bg-center px-4 py-10 text-black"
  style={{ backgroundImage: 'url(/images/background3.png)' }}
>

      <div className="absolute top-4 left-4">
  <button
    onClick={() => window.location.href = '/es/stories'}
    className="text-sm text-blue-700 hover:underline"
  >
    ← Back to stories
  </button>
</div>

      <div className="flex justify-center mb-12">
  <Logo />
</div>
      <h1 className="text-2xl font-bold text-center mb-6">
        ¡Hola {session.user.name || session.user.email}! 🎉
      </h1>

      <div className="text-left max-w-sm mx-auto space-y-4">
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

        <div
          className="text-green-700 cursor-pointer hover:underline text-sm"
          onClick={() => {
            const lang = window.location.pathname.startsWith('/en') ? 'en' : 'es'
            window.location.href = `/${lang}/home/quiz/l1/q1`
          }}
        >
          ▶️ Take the Quiz
        </div>

        <div
          className="text-red-600 cursor-pointer hover:underline text-sm"
          onClick={() => signOut({ callbackUrl: '/' })}
        >
          🚪 Log Out
        </div>
      </div>
    </div>
  </div>
)
}
