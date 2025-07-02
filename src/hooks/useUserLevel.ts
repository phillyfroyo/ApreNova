"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

export function useUserLevel(defaultLevel: string = "l2") {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [selectedLevel, setSelectedLevel] = useState("all");

  useEffect(() => {
    async function fetchUserLevel() {
      const levelFromURL = searchParams?.get("level");
      const levelFromStorage = localStorage.getItem("quizLevel");

      if (levelFromURL && levelFromURL !== selectedLevel) {
        setSelectedLevel(levelFromURL);
        return;
      }

      if (!session?.user?.email) return;

      try {
        const res = await fetch(`/api/user-level?email=${session.user.email}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.level) {
            setSelectedLevel(data.level);
            localStorage.setItem("quizLevel", data.level);
            return;
          }
        } else {
          console.warn("Level not found or fetch failed, falling back.");
        }
      } catch (err) {
        console.error("Failed to fetch level from DB", err);
      }

      if (levelFromStorage && levelFromStorage !== selectedLevel) {
        setSelectedLevel(levelFromStorage);
      } else if (!levelFromStorage && selectedLevel !== defaultLevel) {
        setSelectedLevel(defaultLevel);
      }
    }

    fetchUserLevel();
  }, [searchParams, selectedLevel, session, defaultLevel]);

  return selectedLevel;
}
