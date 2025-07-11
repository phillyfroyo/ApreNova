// src/app/[lng]/premium/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import PremiumDevToggle from "@/components/PremiumDevToggle";
import Link from "next/link";
import Button from "@/components/ui/Button";
import SubscribeButton from "@/components/SubscribeButton";
import type { Language } from "@/types/i18n";
import { getStoryUrl } from "@/utils/getStoryUrl";

export default async function PremiumPage(props: any) {
  const { params } = props;
  const lng = (["en", "es"].includes(params?.lng) ? params.lng : "es") as "en" | "es";

  const session = await getServerSession(authOptions);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-4xl font-extrabold mb-4 text-yellow-700">Go Premium 💎</h1>
      <p className="text-lg mb-6 text-gray-700">
        Cuentana Premium unlocks smarter tools for faster learning:
      </p>

  <ul className="grid gap-4">
    <li className="bg-white rounded-xl shadow-md p-4 border border-yellow-200">
      <span className="font-semibold text-yellow-700">💬 Instant GPT Translations:</span>{" "}
      Translate any word or phrase with full context.
    </li>
    <li className="bg-white rounded-xl shadow-md p-4 border border-yellow-200">
      <span className="font-semibold text-yellow-700">📖 Premium-Only Stories:</span>{" "}
      Early access to new stories and advanced levels.
    </li>
    <li className="bg-white rounded-xl shadow-md p-4 border border-yellow-200">
      <span className="font-semibold text-yellow-700">🔊 Full-Sentence Translation Mode:</span>{" "}
      One-click whole sentence translation with example usage.
    </li>
  </ul>

  <p className="mt-6 text-sm text-gray-600">
    Current Plan:{" "}
    <span className="font-bold">
      {session?.user?.isPremium ? "Premium 💎" : "Free"}
    </span>
  </p>

  {/* 💎 Subscribe Button */}
{!session?.user?.isPremium && (
  <div className="mt-8">
    <SubscribeButton />
  </div>
)}


  {/* 🔁 Dev toggle + return */}
  <div className="mt-8">
    <PremiumDevToggle />
    <div className="mt-4">
      <Link href={`/${lng}/stories`}>
        <Button variant="button1">← Return to Stories</Button>
      </Link>
    </div>
  </div>
</div>
  );
}

