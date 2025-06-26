import { ArrowRight } from 'lucide-react';
import { heroText } from './HomeHeroText';
import Link from "next/link";

export default function HomeHero({ language = 'es' }) {
  const t = heroText[language];

  return (
  <section className="min-h-screen flex items-start justify-start px-8 pt-24 bg-[url('/images/background.png')] bg-cover bg-center">
    <div className="max-w-xl">
      {/* ApreNova Logo */}
      <div translate="no">
        <h1 className="text-[74px] font-bold leading-none relative font-[Alice]">
          <span className="text-[#5ce1e6] absolute left-0 top-1 z-0">Apre</span>
          <span className="text-[#1000c8] relative z-10">Apre</span>
          <span className="text-[69px] font-bold ml-2 font-['Open_Sans'] relative">
            <span className="text-[#5ce1e6] absolute left-0 top-1 z-0">Nova</span>
            <span className="text-[#5100a2] relative z-10">Nova</span>
          </span>
        </h1>
      </div>

        {/* Subtitle */}
        <p className="mt-4 text-[20px] font-[Alice] text-black">{t.subtitle}</p>

        {/* CTA Button */}
        <div className="mt-6">
          <Link href="/signup">
  <button className="flex items-center gap-2 bg-[#1000c8] text-white px-6 py-3 rounded-full text-[16px] font-['Open_Sans'] hover:opacity-90 transition">
    Start today, for free
    <ArrowRight size={18} strokeWidth={2.5} />
  </button>
</Link>
        </div>

        {/* Sign-in Link */}
        <p className="mt-4 text-[14px] font-['Open_Sans']">
          <span className="text-black">{t.signInPrompt} </span>
          <a href="/login" className="text-[#1000c8] hover:underline">
            {t.signIn}
          </a>
        </p>

        {/* Site Language */}
        <div className="mt-8 flex items-center gap-2 text-[15px] font-[Alice] text-black">
          🌐 {t.languageLabel}
        </div>
      </div>
    </section>
  );
}
