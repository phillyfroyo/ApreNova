"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { signOut, useSession } from "next-auth/react";
import Logo from '@/components/Logo';

// Account dropdown shown in top-right
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
  const [selectedLevel, setSelectedLevel] = useState("all");

  useEffect(() => {
    sessionStorage.removeItem("activeLevel");

    const levelFromURL = searchParams.get("level");
    const levelFromStorage = localStorage.getItem("quizLevel");

    if (levelFromURL && levelFromURL !== selectedLevel) {
      setSelectedLevel(levelFromURL);
    } else if (!levelFromURL && levelFromStorage && levelFromStorage !== selectedLevel) {
      setSelectedLevel(levelFromStorage);
    }

    const level = searchParams.get("level");
    if (level && level !== selectedLevel) {
      setSelectedLevel(level);
    }
  }, [searchParams, selectedLevel]);

  return (
    <div style={{ padding: "2rem", position: "relative" }}>
      <AccountDropdown />

      <div className="text-center mb-6">
  <Logo variant="storiesmain" />
  <h2 style={{ marginTop: '0.5rem', fontSize: '1.25rem' }}>
    Historias ({selectedLevel})
  </h2>
</div>
      <div
        style={{
          display: "flex",
          gap: "1rem",
          overflowX: "auto",
          paddingTop: "1rem",
        }}
      >
        {[
          { title: "La Aventura", image: "/images/aventura-thumbnail.png" },
          { title: "El Bosque Perdido", image: "/images/placeholder1.png" },
          { title: "Misterio en la Selva", image: "/images/placeholder2.png" },
          { title: "El Viaje Mágico", image: "/images/placeholder3.png" },
          { title: "Secretos del Desierto", image: "/images/placeholder4.png" },
        ].map((story, i) => (
          <div
            key={i}
            style={{
              minWidth: "200px",
              textAlign: "center",
              cursor: i === 0 ? "pointer" : "default",
            }}
            onClick={() => {
              if (i === 0) {
                const level = localStorage.getItem("quizLevel") || "l1";
                window.location.href = `/es/stories/aventura/${level}/part-1`;
              }
            }}
          >
            <img
              src={story.image}
              alt={story.title}
              style={{
                width: "100%",
                height: "auto",
                aspectRatio: "2 / 3",
                borderRadius: "8px",
                boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
                objectFit: "cover",
              }}
            />
            <p style={{ marginTop: "0.5rem", fontWeight: "bold" }}>{story.title}</p>
          </div>
        ))}
      </div>
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
