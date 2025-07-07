"use client"

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Card } from '@/components/ui'
import Logo from '@/components/Logo'

export default function ResultsPage() {
  const [levelLabel, setLevelLabel] = useState('')
  const { data: session } = useSession()

  useEffect(() => {
    async function saveLevelToDB() {
      const level = localStorage.getItem('quizLevel') || 'l1'

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
        <button
          onClick={() => (window.location.href = '/es/stories')}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#1000c8',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          Continue
        </button>
      </Card>
    </div>
  );
}
