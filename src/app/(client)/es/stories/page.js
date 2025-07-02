"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { signOut, useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import Logo from '@/components/Logo';
import { Card } from '@/components/ui';
import { STORY_METADATA } from "@/lib/stories";
import { getStoryUrl } from "@/lib/stories";
import { useUserLevel } from "@/hooks/useUserLevel";
import { useUserSession } from "@/lib/auth";
import StoryModal from "@/components/StoryModal";

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
{session?.user?.nativeLanguage && (
  <div style={{ fontSize: "12px", color: "#666", marginBottom: "1rem" }}>
    🌐 {session.user.nativeLanguage}
  </div>
)}
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
  const { user, email, image, name, nativeLanguage } = useUserSession();
  const selectedLevel = useUserLevel();
  const [activeStory, setActiveStory] = useState(null);
  const [cardPosition, setCardPosition] = useState(null);

  const handleCardClick = (index, e) => {
  const rect = e.currentTarget.getBoundingClientRect();
  setCardPosition(rect);
  setActiveStory(index);
};

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
        {STORY_METADATA.map((story, i) => (
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

      <StoryModal
  activeStory={activeStory}
  cardPosition={cardPosition}
  onClose={() => {
    setActiveStory(null);
    setCardPosition(null);
  }}
/>

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
