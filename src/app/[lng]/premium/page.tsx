export const dynamic = "force-dynamic";

// src/app/[lng]/premium/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import Link from "next/link";
import Button from "@/components/ui/Button";
import SubscribeButton from "@/components/SubscribeButton";
import type { Language } from "@/types/i18n";
import { t } from "@/lib/t";

export default async function PremiumPage({
  params,
}: {
  params: Promise<{ lng: string }>;
}) {
  const { lng: rawLng } = await params;
  const lng = (["en", "es"].includes(rawLng) ? rawLng : "es") as "en" | "es";

  const session = await getServerSession(authOptions);

  return (
    <div className="min-h-screen p-6" style={{ backgroundImage: "url('/images/background6.png')", backgroundSize: "cover", backgroundPosition: "center" }}>
      <div className="max-w-3xl mx-auto">
      <h1 className="text-4xl font-extrabold mb-4 text-yellow-700">
    {t(lng, "premium", "title")}
  </h1>
       <p className="text-lg mb-6 text-gray-700">
    {t(lng, "premium", "description")}
  </p>

<ul className="grid gap-4">
  <li className="bg-white rounded-xl shadow-md p-4 border border-yellow-200">
    <p className="text-sm text-gray-800">
      <span className="font-semibold text-yellow-700">💬 {t(lng, "premium", "benefit1.title")}:</span>{" "}
      {t(lng, "premium", "benefit1.desc")}
    </p>
  </li>
  <li className="bg-white rounded-xl shadow-md p-4 border border-yellow-200">
    <p className="text-sm text-gray-800">
      <span className="font-semibold text-yellow-700">📖 {t(lng, "premium", "benefit2.title")}:</span>{" "}
      {t(lng, "premium", "benefit2.desc")}
    </p>
  </li>
  <li className="bg-white rounded-xl shadow-md p-4 border border-yellow-200">
    <p className="text-sm text-gray-800">
      <span className="font-semibold text-yellow-700">🔊 {t(lng, "premium", "benefit3.title")}:</span>{" "}
      {t(lng, "premium", "benefit3.desc")}
    </p>
  </li>
</ul>

  <p className="mt-6 text-sm text-gray-600">
    {t(lng, "premium", "currentPlan")}:{" "}
    <span className="font-bold">
      {session?.user?.isPremium ? t(lng, "premium", "planPremium") : t(lng, "premium", "planFree")}
    </span>
  </p>

  {/* 💎 Subscribe Button */}
{!session?.user?.isPremium && (
  <div className="mt-8">
    <SubscribeButton />
  </div>
)}


  {/* Return to stories */}
  <div className="mt-8">
    <Link href={`/${lng}/stories`}>
      <Button variant="button1">← {t(lng, "premium", "returnToStories")}</Button>
    </Link>
  </div>
    </div>
</div>
  );
}

