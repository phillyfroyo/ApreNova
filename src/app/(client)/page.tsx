// src/app/(client)/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Logo from "@/components/Logo";
import { Card, Button } from "@/components/ui";
import Link from "next/link";


export default function LanguageSelectPage() {
  const { data: session } = useSession();
  const router = useRouter();

  // 🧠 If logged in, send to their nativeLanguage
  useEffect(() => {
    if (session) {
      const lng = session.user?.nativeLanguage ?? "es";
      router.replace(`/${lng}/stories`);
    }
  }, [session, router]);

  // 🔁 If localStorage already has a preferredLang, redirect
  useEffect(() => {
    if (typeof window !== "undefined") {
      const preferred = localStorage.getItem("preferredLang");
      if (preferred === "en" || preferred === "es") {
        router.replace(`/${preferred}/home`);
      }
    }
  }, [router]);

  return (
    <section className="min-h-screen flex flex-col items-center justify-center bg-[url('/images/background3.png')] bg-cover bg-center text-black px-6">
      <div className="text-center mb-12">
        <Logo variant="classic" />
        <p className="mt-4 text-[18px] font-[Alice]">
          Aprende más rápido. Aprende con historias.
        </p>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-10">
        {/* Spanish native */}
        <Card className="glass-card max-w-xs text-center space-y-4">
          <p className="text-[24px] font-bold">Mi lengua materna es el español</p>
          <Button
            className="w-full"
            variant="button1"
            onClick={() => {
              localStorage.setItem("preferredLang", "es");
              router.push("/es/home");
            }}
          >
            Continuar
          </Button>
        </Card>

        {/* English native */}
        <Card className="glass-card max-w-xs text-center space-y-4">
          <p className="text-[24px] font-bold">My native language is English</p>
          <Button
            className="w-full"
            variant="button1"
            onClick={() => {
              localStorage.setItem("preferredLang", "en");
              router.push("/en/home");
            }}
          >
            Continue
          </Button>
        </Card>
      </div>
{/* ✅ Login/Signup Links */}
      <div className="mt-8 text-center text-[14px] font-['Open_Sans']">
        <p>
          <span className="text-black">¿Ya tienes una cuenta? </span>
          {/* Defaulting to Spanish here. You can make this smarter if needed. */}
          <Link href="/es/auth/login" className="text-[#1000c8] hover:underline">
            Inicia sesión
          </Link>
        </p>
        <p className="mt-2">
          <span className="text-black">New to ApreNova? </span>
          <Link href="/en/auth/signup" className="text-[#1000c8] hover:underline">
            Create a free account
          </Link>
        </p>
      </div>
    </section>
  );
}
