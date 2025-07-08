// src/app/es/premium/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import PremiumDevToggle from "@/components/PremiumDevToggle";
import Link from "next/link";
import Button from "@/components/ui/Button";

export default async function PremiumSalesPage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Go Premium 💎</h1>
      <p className="text-lg">
        Unlock smart translations, early content access, and more.
      </p>

      <p className="mt-4 text-sm">
        Current Plan:{" "}
        <span className="font-bold">
          {session?.user?.isPremium ? "Premium 💎" : "Free"}
        </span>
      </p>

      <div className="mt-6">
        <PremiumDevToggle />
      </div>
      <div className="mt-8">
  <Link href="/es/stories">
    <Button variant="button1">
      ← Return to Stories
    </Button>
  </Link>
</div>

    </div>
  );
}

