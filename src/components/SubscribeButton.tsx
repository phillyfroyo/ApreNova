"use client";

import Button from "@/components/ui/Button";

export default function SubscribeButton() {
  const handleSubscribe = async () => {
    const res = await fetch("/api/create-checkout-session", { method: "POST" });
    const data = await res.json();
    if (data?.url) {
      window.location.href = data.url;
    }
  };

  return (
    <Button variant="button1" onClick={handleSubscribe}>
      Subscribe to Premium
    </Button>
  );
}
