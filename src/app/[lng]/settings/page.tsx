// src/app/[lng]/settings/page.tsx
'use client'

import { useSession, signOut, getSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import { useUserLevel } from "@/hooks/useUserLevel"
import { Suspense, useState } from 'react'
import SettingsLevelDisplay from './SettingsLevelDisplay'
import EditableField from '@/components/ui/EditableField'
import UserStatsCard from '@/components/UserStatsCard';
import { useParams } from "next/navigation";
import type { Language } from "@/types/i18n";
import { getStoryUrl } from "@/utils/getStoryUrl";
import Link from "next/link";

export default function SettingsPage() {
  const { data: session, status, update } = useSession() // ✅ Everything here
  const router = useRouter()
  const [sessionKey, setSessionKey] = useState(0)

  const { lng } = useParams();
  const typedLang = lng as Language;

  if (status === 'loading') return <p>Loading...</p>

if (!session?.user?.email) {
  return (
    <div className="min-h-screen relative bg-[url('/images/background3.png')] bg-cover bg-center text-black px-6">

  {/* Back Button */}
  <div className="absolute top-4 left-4">
    <button
      onClick={() => router.push(`/${typedLang}/stories`)}
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
  <Link href={`/${typedLang}/auth/login`} className="text-blue-700 underline">
    Sign in
  </Link>
</p>

        <div className="text-gray-500 text-xs">or</div>

        <a
          href={`/${typedLang}/auth/signup`}
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
          onClick={() => router.push(`/${typedLang}/stories`)}
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
      <div className="flex items-center text-sm text-gray-800">
  <span className="w-5 inline-block text-center">💼</span>
  <span className="ml-2">
    Member Status:{" "}
    <span className="font-semibold text-black">
      {session.user.isPremium ? "Premium 💎" : "Free"}
    </span>
  </span>
  <span className="ml-auto text-gray-500 text-xs">✏️</span>
</div>


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
          onSave={(lng) => updateUserField('nativeLanguage', lng)}
        />

        <Suspense fallback={<div className="text-xs mb-4">🎯 Loading level...</div>}>
          <SettingsLevelDisplay />
        </Suspense>

        <div
          className="text-green-700 cursor-pointer hover:underline text-sm"
          onClick={() => {
            const lng = window.location.pathname.startsWith('/en') ? 'en' : 'es';
            router.push(`/${typedLang}/home/quiz/l1/q1`);
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

      {/* ✅ Stats card below all editable/profile elements */}
      <div className="mt-12 flex justify-center">
        <UserStatsCard />
      </div>
    </div>
  </div>
);
}
