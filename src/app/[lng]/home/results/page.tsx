// /src/app/[lng]/home/results/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, Button } from "@/components/ui";
import Logo from "@/components/Logo";
import { usePathname, useRouter } from "next/navigation";
import type { Language } from "@/types/i18n";

export default function ResultsPage() {
  const pathname = usePathname();
  const typedLang = pathname.split("/")[1] as Language;

  const { data: session } = useSession();
  const router = useRouter();

  const [level, setLevel] = useState<"l1" | "l2" | "l3" | "l4">("l1");
  const [levelLabel, setLevelLabel] = useState("Brand New");
  const [description, setDescription] = useState("");

  useEffect(() => {
    const quizLevel = (sessionStorage.getItem("quizLevel") || "l1") as
      | "l1"
      | "l2"
      | "l3"
      | "l4";

    setLevel(quizLevel);

    const levelMap = {
      l1: "Brand New",
      l2: "Beginner",
      l3: "Intermediate",
      l4: "Advanced",
    };

    const descriptions = {
      l1: "You’ll begin with ultra-simple stories using just 100 core words and basic present tense.",
      l2: "You’ll begin with beginner stories using 200 common words and simple past and future tense.",
      l3: "You’ll begin with stories that balance challenge and comfort — using 500 core words and building multi-clause sentences.",
      l4: "You’ll begin with advanced stories using 1,000 words, flexible grammar, and native-level structure.",
    };

    setLevelLabel(levelMap[quizLevel]);
    setDescription(descriptions[quizLevel]);

    localStorage.setItem("level", quizLevel);

    if (session?.user?.id) {
      fetch("/api/user-level", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.user.id, level: quizLevel }),
      }).catch((err) => {
        console.error("Failed to update level:", err);
      });
    }
  }, [session]);

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
      <Card
        variant="glass"
        className="hide-scrollbar"
        style={{ padding: "2rem", textAlign: "center", maxWidth: "400px" }}
      >
        <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
          Your level: {levelLabel}
        </h2>
        <p className="text-base mb-6">{description}</p>
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

// include a message like "You’ll begin with stories that balance challenge and comfort — using 500 core words and building multi-clause sentences."