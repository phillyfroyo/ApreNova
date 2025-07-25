// src/app/[lng]/layout.tsx
import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import FeedbackWidget from "@/components/FeedbackWidget";

export default async function Layout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ lng: string }>;
}) {
  // Validate and fallback to "es"
  const { lng } = await params;
  const validLng = lng === "en" ? "en" : "es";

  return (
    <>
      {children}
      <FeedbackWidget lng={validLng} />
    </>
  );
}
