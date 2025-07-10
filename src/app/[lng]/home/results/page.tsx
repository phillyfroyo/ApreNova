// src/app/[lng]/home/results/page.js
"use client"

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Card } from '@/components/ui'
import Logo from '@/components/Logo'
import { useParams } from "next/navigation";
import type { Language } from "@/types/i18n";
import { Button } from "@/components/ui";
import { useRouter } from 'next/navigation'

export default function ResultsPage() {
  const { lang } = useParams();
  const typedLang = lang as Language;

  const [levelLabel, setLevelLabel] = useState('')
  const { data: session } = useSession()
  const router = useRouter();

  useEffect(() => {
    async function saveLevelToDB() {
      const correctCount = Number(sessionStorage.getItem('correctAnswers') || 0)
let level = 'l1'

if (correctCount >= 3) {
  level = 'l4'
} else if (correctCount === 2) {
  level = 'l3'
} else if (correctCount === 1) {
  level = 'l2'
} else {
  level = 'l1'
}

      if (session?.user?.id) {
        try {
          await fetch('/api/user-level', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: session.user.id, level }),
          })
        } catch (err) {
          console.error('Failed to update level:', err)
        }
      }

      // Store level for Leerme reference
      localStorage.setItem('level', level)

      // Set label for display
      const levelMap = {
        l1: 'Brand New',
        l2: 'Beginner',
        l3: 'Intermediate',
        l4: 'Advanced',
      }

      setLevelLabel(levelMap[level] || 'Brand New')
    }

    saveLevelToDB()
  }, [session])


  return (
    <div
      style={{
        padding: "2rem",
        position: "relative",
        backgroundImage: "url('/images/background3.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Logo variant="storiesmain" />
      <Card variant="glass" className="hide-scrollbar" style={{ padding: '2rem', textAlign: 'center', maxWidth: '400px' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Your level: {levelLabel}</h2>
        <Button
            onClick={() => router.push(`/${typedLang}/stories`)}
            className="bg-blue-800 text-white font-bold px-6 py-3 rounded-md"
          >
            Start Learning
        </Button>
      </Card>
    </div>
  );
}
