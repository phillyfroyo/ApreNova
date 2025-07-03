'use client'
// src/components/Logo.tsx

import { useSession } from 'next-auth/react'

interface LogoProps {
  variant?: string;
  size?: string;
  className?: string;
}

export default function Logo({ variant = 'default', size = 'text-[64px]', className = '' }: LogoProps) {
  const { data: session } = useSession();

  const label =
    session?.user?.nativeLanguage === 'es'
      ? 'miAprendO'
      : session?.user?.nativeLanguage === 'en'
      ? 'myAprendO'
      : 'AprendO';

  const variants: Record<string, [string, string, string?]> = {
    default: ['text-[#1000c8]', 'text-[#5100a2]', 'font-[Alice]'],
    quiz: ['text-blue-500 drop-shadow-xl', 'text-fuchsia-600'],
    auth: ['text-[#70e0dc]', 'text-[#5100a2]'],
    storiesmain: ['text-[#1000c8]', 'text-purple-800'],
    corporate: ['text-blue-800', 'text-indigo-900', 'font-sans'],
    classic: ['text-indigo-600', 'text-purple-700', 'font-serif'],
    coolgray: ['text-gray-800', 'text-blue-600', 'font-sans'],
    steel: ['text-slate-800', 'text-blue-900', 'font-sans'],
    vibrant: ['text-fuchsia-500', 'text-purple-700', 'font-[Fredoka]'],
    electric: ['text-cyan-400', 'text-purple-800', 'font-[Orbitron]'],
    wave: ['text-sky-500', 'text-indigo-600', 'font-[Raleway]'],
    berryblast: ['text-pink-500', 'text-violet-700', 'font-[Baloo_2]'],
    glowcool: ['text-blue-600', 'text-fuchsia-700', 'font-[Audiowide]'],
    glowmint: ['text-emerald-400', 'text-cyan-700', 'font-[Exo_2]'],
    glowroyal: ['text-[#1000c8]', 'text-purple-800', 'font-[Alice]'],
    glassmode: ['text-white', 'text-white/90', 'font-[Quicksand]'],
    playtime: ['text-pink-400', 'text-sky-400', 'font-[Fredoka]'],
    storybook: ['text-rose-500', 'text-amber-400', 'font-[Merriweather]'],
    neonpop: ['text-lime-400', 'text-fuchsia-500', 'font-[Orbitron]'],
    bubblegum: ['text-rose-300', 'text-indigo-400', 'font-[Baloo_2]'],
    starlight: ['text-white', 'text-indigo-400', 'font-[Raleway]'],
    novaflare: ['text-blue-500', 'text-fuchsia-600', 'font-[Changa_One]'],
    plasma: ['text-cyan-300', 'text-violet-500', 'font-[Exo_2]'],
    eventhorizon: ['text-black', 'text-white/80', 'font-[Audiowide]'],
    goldleaf: ['text-yellow-500', 'text-amber-700', 'font-[Playfair_Display]'],
    midnight: ['text-gray-900', 'text-indigo-800', 'font-[Lora]'],
    pearl: ['text-gray-100', 'text-slate-200', 'font-[Quicksand]'],
    onyx: ['text-black', 'text-gray-700', 'font-[Oswald]'],
    hotline: ['text-fuchsia-500', 'text-rose-500', 'font-[Orbitron]'],
    splash: ['text-cyan-400', 'text-orange-400', 'font-[Orbitron]'],
    retrobit: ['text-green-400', 'text-purple-500', 'font-[\"Press_Start_2P\"]'],
    electricice: ['text-sky-300', 'text-teal-300', 'font-[Raleway]'],
  };

  const [aprendColor, oColor, font = 'font-[Alice]'] = variants[variant] || variants.default;

  // Language logic
  const isLoggedIn = !!session?.user;
  const lang = session?.user?.nativeLanguage || 'es'; // default to Spanish
  const brand = !isLoggedIn
    ? ['Aprend', 'O']
    : lang === 'es'
      ? ['miAprend', 'O']
      : ['myAprend', 'O'];

  return (
    <h1 className={`font-bold leading-none ${font} ${size} ${className}`}>
      <span className={`${aprendColor} drop-shadow-aprenova`}>{brand[0]}</span>
      <span className={`${oColor} drop-shadow-aprenova`}>{brand[1]}</span>
    </h1>
  );
}
