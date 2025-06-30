"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { signOut, useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import Logo from '@/components/Logo';
import { Card } from '@/components/ui';

function AccountDropdown() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const profilePic = session?.user?.image;
  const email = session?.user?.email || "User";

  return (
    <div style={{ position: "absolute", top: "1rem", right: "1rem" }}>
      <div
        style={{
          cursor: "pointer",
          borderRadius: "50%",
          overflow: "hidden",
          width: "32px",
          height: "32px",
        }}
        onClick={() => setOpen((prev) => !prev)}
      >
        <img
          src={profilePic || "/images/default-avatar.png"}
          alt="Account"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "40px",
            right: 0,
            backgroundColor: "white",
            border: "1px solid #ccc",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            width: "200px",
            padding: "1rem",
            zIndex: 1000,
          }}
        >
          <div style={{ marginBottom: "1rem", fontWeight: "bold", fontSize: "14px" }}>
            {email}
          </div>
          <div
            style={{ marginBottom: "0.75rem", cursor: "pointer", color: "green" }}
            onClick={() => {
              const lang = window.location.pathname.startsWith('/en') ? 'en' : 'es';
              window.location.href = `/${lang}/home/quiz/l1/q1`;
            }}
          >
            Take the Quiz
          </div>
          <div
            style={{ marginBottom: "0.75rem", cursor: "pointer", color: "#1000c8" }}
            onClick={() => (window.location.href = "/es/myaccount")}
          >
            My Account
          </div>
          <div
            style={{ cursor: "pointer", color: "red" }}
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            Log out
          </div>
        </div>
      )}
    </div>
  );
}

function StoriesPageContent() {
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const [selectedLevel, setSelectedLevel] = useState("all");
  const [activeStory, setActiveStory] = useState(null);
  const [cardPosition, setCardPosition] = useState(null);

  const handleCardClick = (index, e) => {
  const rect = e.currentTarget.getBoundingClientRect();
  setCardPosition(rect);
  setActiveStory(index);
};

  useEffect(() => {
  async function fetchUserLevel() {
    const levelFromURL = searchParams.get("level");
    const levelFromStorage = localStorage.getItem("quizLevel");

    if (levelFromURL && levelFromURL !== selectedLevel) {
      setSelectedLevel(levelFromURL);
      return;
    }

    if (!session?.user?.email) return; // ✅ Early return if no session

    try {
      const res = await fetch(`/api/user-level?email=${session.user.email}`);
      if (!res.ok) {
  console.warn("Level not found or fetch failed, falling back to localStorage or default.");
  return; // allow fallback logic to proceed
}

      const data = await res.json();
      if (data?.level) {
        setSelectedLevel(data.level);
        localStorage.setItem("quizLevel", data.level); // ✅ Cache it in localStorage
        return;
      }
    } catch (err) {
      console.error("Failed to fetch level from DB", err);
    }

    if (levelFromStorage && levelFromStorage !== selectedLevel) {
      setSelectedLevel(levelFromStorage);
    } else if (!levelFromStorage && selectedLevel !== "l2") {
      setSelectedLevel("l2");
    }
  }

  fetchUserLevel();
}, [searchParams, selectedLevel, session]);

  useEffect(() => {
    if (activeStory !== null) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [activeStory]);

  const stories = [
    {
      title: "La Aventura",
      image: "/images/aventura-thumbnail.png",
      levels: ["l1", "l2", "l3", "l4", "l5"],
      description: "Una serie de aventuras en Latinoamérica, perfecta para todos los niveles. Una serie de aventuras en Latinoamérica, perfecta para todos los niveles. Una serie de aventuras en Latinoamérica, perfecta para todos los niveles. Una serie de aventuras en Latinoamérica, perfecta para todos los niveles. Una serie de aventuras en Latinoamérica, perfecta para todos los niveles. Una serie de aventuras en Latinoamérica, perfecta para todos los niveles."
    },
    {
      title: "El Bosque Perdido",
      image: "/images/placeholder1.png",
      levels: ["l2"],
      description: "Misterios y criaturas ocultas en un bosque encantado."
    },
    {
      title: "Misterio en la Selva",
      image: "/images/placeholder2.png",
      levels: ["l3"],
      description: "Un arqueólogo desaparece en la selva profunda..."
    },
    {
      title: "El Viaje Mágico",
      image: "/images/placeholder3.png",
      levels: ["l4"],
      description: "Un tren, un mapa antiguo, y una puerta a otro mundo."
    },
    {
      title: "Secretos del Desierto",
      image: "/images/placeholder4.png",
      levels: ["l5"],
      description: "El pasado cobra vida entre las dunas del desierto."
    },
  ];

  return (
    <div
      style={{
        padding: "2rem",
        position: "relative",
        backgroundImage: "url('/images/background3.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        minHeight: "100vh",
      }}
    >
      <AccountDropdown />

      <div className="text-center mb-6">
        <Logo variant="storiesmain" />
        <h2 style={{ marginTop: "0.5rem", fontSize: "1.25rem" }}>
          Historias ({selectedLevel})
        </h2>
      </div>

      <div style={{ display: "flex", gap: "1.5rem", overflow: "hidden", padding: "1rem 0" }}>
        {stories.map((story, i) => (
          <motion.div
            key={i}
            layoutId={`story-${i}`}
            whileHover={{ scale: 1.04 }}
            onClick={(e) => handleCardClick(i, e)}
            style={{
              cursor: "pointer",
              minWidth: "200px",
              borderRadius: "12px",
              overflow: "hidden",
              transition: "box-shadow 0.3s ease",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
            }}
          >
            <img
              src={story.image}
              alt={story.title}
              style={{
                width: "100%",
                aspectRatio: "2 / 3",
                objectFit: "cover",
                display: "block",
              }}
            />
            <p
              style={{
                marginTop: "0.5rem",
                textAlign: "center",
                fontWeight: "bold",
                color: "#000",
              }}
            >
              {story.title}
            </p>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
  {activeStory !== null && (
    <>
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 99,
        }}
        onClick={() => {
          setActiveStory(null);
          setCardPosition(null);
        }}
      />
      <motion.div
        key="modal"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: "absolute",
          top: cardPosition?.top ?? "50%",
          left: cardPosition?.left ?? "50%",
          width: cardPosition?.width ?? "400px",
          height: "auto",
          transform: "translate(0, 0)",
          zIndex: 100,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <motion.div
          layoutId={`story-${activeStory}`}
          style={{
            borderRadius: "12px",
            maxWidth: "100%",
            width: "400px",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <Card variant="glass" className="hide-scrollbar">
            <div
              style={{
                minHeight: "600px",
                maxHeight: "600px",
                overflowY: "auto",
                scrollbarWidth: "none",
                msOverflowStyle: "none",
              }}
              className="hide-scrollbar"
            >
              <motion.img
                src={stories[activeStory].image}
                alt={stories[activeStory].title}
                initial={{ borderRadius: "12px" }}
                animate={{ borderRadius: "12px" }}
                style={{
                  width: "100%",
                  display: "block",
                  objectFit: "cover",
                  aspectRatio: "2 / 3",
                }}
              />
              <div style={{ padding: "1.5rem", textAlign: "center" }}>
                <h3 style={{ fontWeight: "bold" }}>
                  {stories[activeStory].title}
                </h3>
                <p style={{ margin: "0.5rem 0 1rem" }}>
                  {stories[activeStory].description}
                </p>
                {stories[activeStory].levels.map((lvl, idx) => (
                  <button
                    key={idx}
                    onClick={() =>
                      (window.location.href = `/es/stories/aventura/${lvl}/part-1`)
                    }
                    style={{
                      margin: "0.25rem",
                      padding: "0.5rem 1rem",
                      backgroundColor: "#1000c8",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    Nivel {lvl.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </>
  )}
</AnimatePresence>
    </div>
  );
}

export default function StoriesPage() {
  return (
    <Suspense>
      <StoriesPageContent />
    </Suspense>
  );
}
