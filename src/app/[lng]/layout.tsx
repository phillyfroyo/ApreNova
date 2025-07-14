// src/app/[lng]/layout.tsx
import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import FeedbackWidget from "@/components/FeedbackWidget";

export default function Layout({
  children,
  params,
}: {
  children: ReactNode;
  params: { lng: string };
}) {
  // Validate and fallback to "es"
  const validLng = params.lng === "en" ? "en" : "es";

  return (
    <>
      {children}
      <FeedbackWidget lng={validLng} />
    </>
  );
}
