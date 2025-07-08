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
import StoryCard from "@/components/StoryCard";
import Link from "next/link";


function AccountDropdown() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const profilePic = session?.user?.image;
  const email = session?.user?.email || (
  <a href="/es/auth/signup" className="text-blue-800 hover:underline">
  Create an Account
</a>
);

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
          <div className="space-y-2">
  <div
    className="text-green-600 cursor-pointer"
    onClick={() => {
      const lang = window.location.pathname.startsWith("/en") ? "en" : "es";
      window.location.href = `/${lang}/home/quiz/l1/q1`;
    }}
  >
    Take the Quiz
  </div>
  <div
    className="text-blue-800 cursor-pointer"
    onClick={() => (window.location.href = "/es/settings")}
  >
    My Account
  </div>
  <Link
    href="/es/premium"
    className="text-yellow-700 cursor-pointer block"
  >
    Go Premium 💎
  </Link>
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
  const [cardPosition, setCardPosition] = useState<DOMRect | null>(null);
  const [activeStory, setActiveStory] = useState<number | null>(null);

  function handleLevelClick(lvl) {
  const locale = "es"; // We'll pull from router later
  const storySlug = "aventura"; // We'll make this dynamic in the future
  const url = getStoryUrl({ locale, storySlug, level: lvl });
  window.location.href = url;
}

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
    <div style={{
    padding: "2rem",
    position: "relative",
    backgroundImage: "url('/images/background3.png')",
    backgroundSize: "cover",
    backgroundPosition: "center",
    minHeight: "100vh",
  }}>
    <AccountDropdown />

    <div className="text-center" style={{ marginBottom: "2rem" }}>
      <Logo variant="storiesmain" size="text-[40px]" className="mx-auto" />
      <h2 style={{ marginTop: "0.5rem", fontSize: "1.25rem", marginBottom: "1rem" }}>
        Historias ({selectedLevel})
      </h2>
    </div>

    <div style={{ position: "relative" }}>
      <div
        style={{
          position: "relative",               // 👈 add this
          display: "flex",
          gap: "1.5rem",
          overflowX: "auto",
          paddingLeft: "1rem",
          paddingRight: "1rem",
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
        >
         {STORY_METADATA.map((story, i) => (
           <StoryCard
             key={i}
             index={i}
             title={story.title}
             image={story.image}
             onClick={(rect) => {
              setCardPosition(rect);
              setActiveStory(i);
            }}
          />
        ))}
      </div>
    </div> {/* Close scroll wrapper */}

      <StoryModal
  activeStory={activeStory}
  cardPosition={cardPosition}
  storySlug={activeStory !== null ? STORY_METADATA[activeStory].slug : ""}
  onClose={() => {
    setActiveStory(null);
    setCardPosition(null);
  }}
  handleLevelClick={handleLevelClick}
  user={user} // ✅ Add this line
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
