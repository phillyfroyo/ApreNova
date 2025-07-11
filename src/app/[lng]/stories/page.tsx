// src/app/[lng]/stories/page.tsx
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
import { useRouter, useParams } from "next/navigation";
import type { Language } from "@/types/i18n";
import Image from "next/image";
import { t } from "@/lib/t";



function AccountDropdown() {
  const router = useRouter();
  const { lng } = useParams();
  const typedLang = lng as Language;

  const goToQuiz = () => router.push(`/${typedLang}/home/quiz/l1/q1`);
  const goToSettings = () => router.push(`/${typedLang}/settings`);

  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const profilePic = session?.user?.image;


  return (
  <div>
    <div style={{ position: "absolute", top: "1rem", right: "1rem", textAlign: "center" }}>
      <div
        style={{
          cursor: "pointer",
          borderRadius: "50%",
          overflow: "hidden",
          width: "32px",
          height: "32px",
          margin: "0 auto",
        }}
        onClick={() => setOpen((prev) => !prev)}
      >
        <Image
  src={profilePic || "/images/default-avatar.png"}
  alt="Account"
  width={100} // ✅ you MUST define width + height unless using fill
  height={100}
  style={{ objectFit: "cover" }}
/>
      </div>

      {session?.user?.isPremium && (
        <div
          style={{
            fontSize: "8px",
            backgroundColor: "rgba(255, 255, 255, 0.6)",
            padding: "2px 6px",
            borderRadius: "9999px",
            backdropFilter: "blur(4px)",
            fontWeight: "600",
            color: "#333",
            display: "inline-block",
          }}
        >
          Premium 💎
        </div>
      )}
    </div>

    {open && (
      <div
        style={{
          position: "absolute",
          top: "70px",
          right: "15px",
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
  {session?.user?.email ? (
    <div>{session.user.email}</div>
  ) : (
    <a href={`/${typedLang}/auth/signup`} className="text-blue-800 hover:underline">
      {t(typedLang, "stories", "createAccount")}
    </a>
  )}
</div>

        <div className="space-y-2">
          <button
            onClick={goToQuiz}
            className="text-green-600 cursor-pointer block w-full text-left"
          >
            {t(typedLang, "stories", "takeQuiz")}
          </button>

          <button
            onClick={goToSettings}
            className="text-blue-800 cursor-pointer block w-full text-left"
          >
            {t(typedLang, "stories", "myAccount")}
          </button>

          <Link
            href={`/${typedLang}/premium`}
            className="text-yellow-700 cursor-pointer block"
          >
            {t(typedLang, "stories", "goPremium")}
          </Link>
        </div>
      </div>
    )}
  </div>
);}

function StoriesPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, email, image, name, nativeLanguage } = useUserSession();
  const selectedLevel = useUserLevel();
  const [cardPosition, setCardPosition] = useState<DOMRect | null>(null);
  const [activeStory, setActiveStory] = useState<number | null>(null);
  const { lng } = useParams();
  const typedLang = lng as Language;


  function handleLevelClick(lvl) {
  const locale = typedLang;
  const storySlug = "aventura"; // We'll make this dynamic in the future
  const url = getStoryUrl({ locale, storySlug, level: lvl });
  router.push(url);
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

    <div className="absolute top-4 left-4 z-50">
  <Logo variant="storiesmain" size="text-[32px]" />
</div>

<div className="mt-16 mb-4 px-4">
  <h2 className="text-xl font-semibold text-left">
    {t(typedLang, "stories", "storiesAll")} ({selectedLevel})
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
