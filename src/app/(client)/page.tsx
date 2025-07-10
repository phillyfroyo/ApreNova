// src/app/(client)/page.js
import { getServerSession } from 'next-auth';
import { authOptions } from "@/lib/authOptions";
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Logo from '@/components/Logo';
import { Card, Button } from '@/components/ui';
import { useParams } from "next/navigation";
import type { Language } from "@/types/i18n";

export default async function Home() {
  const session = await getServerSession(authOptions);
  const { lang } = useParams();
  const typedLang = lang as Language;

  if (session) {
    const lang = session.user?.nativeLanguage ?? 'es';
redirect(`/${lang}/stories`);
  }

  return (
    <section className="min-h-screen flex flex-col items-center justify-center bg-[url('/images/background3.png')] bg-cover bg-center text-black px-6">
      {/* Logo and subtitle */}
      <div className="text-center mb-12">
        <Logo variant="classic" />
        <p className="mt-4 text-[18px] font-[Alice]">
          Aprende más rápido. Aprende con historias.
        </p>
      </div>

      {/* Language choice cards */}
      <div className="flex flex-col md:flex-row items-center gap-10">
        <Card className="glass-card max-w-xs text-center space-y-4">
          <p className="text-[24px] font-bold">
            Mi lengua materna es el español
          </p>
          <Link href={`/${typedLang}/home`}>
            <Button className="w-full" variant="button1">
              Continuar
            </Button>
          </Link>
        </Card>

        <Card className="glass-card max-w-xs text-center space-y-4">
          <p className="text-[24px] font-bold">
            My native language is English
          </p>
          <Link href="/en">
            <Button className="w-full" variant="button1">
              Continue
            </Button>
          </Link>
        </Card>
      </div>

      <p className="mt-4 text-[14px] font-['Open_Sans']">
        <span className="text-black">¿Ya tienes una cuenta? </span>
        <Link href={`/${typedLang}/auth/login`} className="text-[#1000c8] hover:underline">
          Inicia sesión
        </Link>
      </p>

      <p className="mt-2 text-[14px] font-['Open_Sans']">
        <span className="text-black">New to ApreNova? </span>
        <Link href={`/${typedLang}/auth/signup`} className="text-[#1000c8] hover:underline">
          Create a free account
        </Link>
      </p>
    </section>
  );
}
