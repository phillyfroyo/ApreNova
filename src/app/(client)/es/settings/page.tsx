'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import { useUserLevel } from "@/hooks/useUserLevel";
import { Suspense } from 'react'
import SettingsLevelDisplay from './SettingsLevelDisplay'


export default function SettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  if (status === 'loading') {
    return <p>Loading...</p>
  }

  if (!session?.user?.email) {
    return <p>Not logged in</p>
  }

  const email = session.user.email

  return (
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

{session.user.name && (
  <div className="mb-4 text-sm font-semibold">👤 {session.user.name}</div>
)}

  <div className="text-left max-w-sm mx-auto">
    <div className="text-sm text-black/90 mb-2">{email}</div>

    

    {session.user.nativeLanguage ? (
  <div className="text-xs text-blue/80 mb-4">
    🌐 {session.user.nativeLanguage}
  </div>
) : (
  <div className="text-xs text-blue-800 mb-4 cursor-pointer">
    🌐 Add your native language
  </div>
)}

<Suspense fallback={<div className="text-xs mb-4">🎯 Loading level...</div>}>
  <SettingsLevelDisplay />
</Suspense>




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
  )
}