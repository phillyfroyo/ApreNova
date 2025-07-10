// src/components/SubscribeButton.tsx
"use client";

import Button from "@/components/ui/Button";
import { useRouter } from "next/navigation";

export default function SubscribeButton() {
  const router = useRouter(); // ✅ FIXED: hook at top level

  const handleSubscribe = async () => {
    const res = await fetch("/api/create-checkout-session", { method: "POST" });
    const data = await res.json();
    if (data?.url) {
      router.push(data.url);
    }
  };

  return (
    <Button variant="button1" onClick={handleSubscribe}>
      Subscribe to Premium
    </Button>
  );
}
