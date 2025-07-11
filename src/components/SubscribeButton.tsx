// src/components/SubscribeButton.tsx
"use client";

import Button from "@/components/ui/Button";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import { t } from "@/lib/t";
import type { Language } from "@/types/i18n";

export default function SubscribeButton() {
  const router = useRouter(); // ✅ FIXED: hook at top level
  const { lng } = useParams();
  const typedLang: Language = (lng === "en" || lng === "es" ? lng : "es") as Language;

  const handleSubscribe = async () => {
    const res = await fetch("/api/create-checkout-session", { method: "POST" });
    const data = await res.json();
    if (data?.url) {
      router.push(data.url);
    }
  };

  return (
    <Button variant="button1" onClick={handleSubscribe}>
      {t(typedLang, "premium", "subscribeButton")}
    </Button>
  );
}
