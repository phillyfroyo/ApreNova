// src/app/[lng]/settings/SettingsLevelDisplay
'use client'

import { useUserLevel } from '@/hooks/useUserLevel'
import { useState } from 'react'
import { useRouter, useParams } from "next/navigation";
import { useSession } from 'next-auth/react';
import type { Language } from "@/types/i18n";
import { t } from '@/lib/t';

const levelOptions = [
  { value: 'l1', label: 'Level 1 - Brand New' },
  { value: 'l2', label: 'Level 2 - Beginner' },
  { value: 'l3', label: 'Level 3 - Intermediate' },
  { value: 'l4', label: 'Level 4 - Advanced' },
  { value: 'l5', label: 'Level 5 - Fluent' },
];

export default function SettingsLevelDisplay() {
  const selectedLevel = useUserLevel()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const { data: session, update: updateSession } = useSession();

  const router = useRouter();
  const { lng } = useParams();
  const goToQuiz = () => router.push(`/${typedLang}/home/quiz/placement`);
  const typedLang = lng as Language;

  const handleLevelChange = async (newLevel: string) => {
    if (!session?.user?.id) return;

    setSaving(true);
    try {
      const response = await fetch("/api/user-level", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.user.id, level: newLevel }),
      });

      if (!response.ok) {
        throw new Error("Failed to update level");
      }

      // Update session and local storage
      await updateSession();
      localStorage.setItem("level", newLevel);
      sessionStorage.setItem("quizLevel", newLevel);

      setEditing(false);
      router.refresh();
    } catch (error) {
      console.error("Failed to update level:", error);
      alert("Failed to update level. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!selectedLevel) {
    return (
      <div
        className="text-sm text-blue-800 mb-4 cursor-pointer"
        onClick={goToQuiz}
      >
        {`🎯 ${t(typedLang, 'settings', 'levelUndefined')}`}
      </div>
    )
  }

  return (
    <div className="text-sm mb-2">
      <div className="flex items-center justify-between">
        <span className="font-medium">
          🎯 <span className="text-black">{t(typedLang, 'settings', 'currentLevel')}:</span> {selectedLevel.toUpperCase()}
        </span>

        <button
          onClick={() => setEditing(!editing)}
          className="text-gray-500 hover:text-black text-base"
          disabled={saving}
        >
          ✏️
        </button>
      </div>

      {editing && (
        <div className="mt-2 space-y-2">
          <select
            value={selectedLevel}
            onChange={(e) => handleLevelChange(e.target.value)}
            disabled={saving}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {levelOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {saving && <p className="text-xs text-gray-500">Saving...</p>}
        </div>
      )}
    </div>
  )
}

