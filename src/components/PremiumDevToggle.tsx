"use client";

import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";

export default function PremiumDevToggle() {
  const router = useRouter();

  const handleToggle = async () => {
    await fetch("/api/dev-toggle-premium", { method: "POST" });
    router.refresh(); // Triggers server session re-fetch on the page
  };

  return (
    <Button onClick={handleToggle} variant="parts">
      Toggle Premium (Dev Only)
    </Button>
  );
}
