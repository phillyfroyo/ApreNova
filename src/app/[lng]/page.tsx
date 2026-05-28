// src/app/[lng]/page.tsx
// /en and /es are published in sitemap.xml as the brand-landing entry
// points. Cold visitors arriving from a Google brand search want the
// story library, not the onboarding flow — redirect them to /[lng]/stories.
// The /  (un-prefixed) route remains the language-selection landing page
// for users who haven't picked a language yet.
import { redirect } from "next/navigation";

export default async function LangRoot({
  params,
}: {
  params: Promise<{ lng: string }>;
}) {
  const { lng } = await params;
  const validLng = lng === "en" ? "en" : "es";
  redirect(`/${validLng}/stories`);
}
