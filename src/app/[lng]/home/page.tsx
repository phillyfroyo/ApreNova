// src/app/[lng]/home/page.tsx
'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Logo from '@/components/Logo';
import { useParams, useRouter } from "next/navigation";
import type { Language } from "@/types/i18n";
import { useTypedLang } from "@/hooks/useTypedLang";
import { t } from '@/lib/t';
import Image from 'next/image'
import { useState, useRef, useEffect } from 'react'


export default function QuizWelcome() {
  const { lng } = useParams();
  const typedLang = useTypedLang();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
  function handleClickOutside(event: MouseEvent) {
    if (!menuRef.current?.contains(event.target as Node)) {
  setMenuOpen(false)
}
  }

  if (menuOpen) {
    document.addEventListener("mousedown", handleClickOutside)
  }

  return () => {
    document.removeEventListener("mousedown", handleClickOutside)
  }
}, [menuOpen])


  return (
    <motion.section
      layout
      className="min-h-screen flex flex-col items-center justify-center bg-[url('/images/background3.png')] bg-cover bg-center text-black px-6 pb-20"
      initial={{ y: 10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
    >

      {/* Avatar Menu for Unauthenticated Users */}
<div ref={menuRef} className="absolute top-4 right-4 text-sm z-50">
  {/* Avatar icon */}
  <div
    className="cursor-pointer rounded-full overflow-hidden w-8 h-8"
    onClick={() => setMenuOpen((prev) => !prev)}
  >
    <Image
      src="/images/default-avatar.png"
      alt="Account"
      width={100}
      height={100}
      style={{ objectFit: 'cover' }}
    />
  </div>

  {/* Dropdown menu */}
  {menuOpen && (
    <div className="mt-2 bg-white border border-gray-200 rounded-md shadow-md p-3 w-40 absolute right-0">
      <a
        href={`/${typedLang}/auth/login`}
        className="block text-blue-800 hover:underline mb-2"
      >
        {t(typedLang, "auth", "login")}
      </a>
      <a
        href={`/${typedLang}/auth/signup`}
        className="block text-blue-800 hover:underline"
      >
        {t(typedLang, "stories", "createAccount")}
      </a>
    </div>
  )}
</div>

      {/* Logo and subtitle */}
      <div className="text-center mt-24 md:mt-12 mb-12">
  <Logo variant="soft" />
  <p className="mt-4 text-[18px] font-[Alice]">
    {t(typedLang, "home", "subtitle")}
  </p>
</div>


      {/* Quiz / No Thanks Buttons */}
      <div className="flex flex-col md:flex-row items-stretch gap-10">
        {/* Quiz Option */}
        <div className="bg-[#fff5eb] p-8 rounded-3xl shadow-md max-w-xs text-center relative flex flex-col justify-between h-full">
          <p className="text-[24px] font-bold mb-2">{t(typedLang, "home", "quizTitle")}</p>
          <p className="mb-4">{t(typedLang, "home", "letUsPick")}</p>
          <Link href={`/${typedLang}/home/quiz/l1/q1`}>
          <button className="bg-[#1000c8] text-white px-6 py-2 rounded-full hover:opacity-90 transition">
           {t(typedLang, "home", "startQuiz")}
          </button>
          </Link>
        </div>

        {/* No Gracias Option */}
        <div className="bg-[#fff5eb] p-8 rounded-3xl shadow-md max-w-xs text-center relative flex flex-col justify-between h-full">
          <p className="text-[24px] font-bold mb-2">{t(typedLang, "home", "noThanksTitle")}</p>
          <p className="mb-4">{t(typedLang, "home", "pickLater")}</p>
          <Link href={`/${typedLang}/stories`}>
            <button className="bg-[#1000c8] text-white px-6 py-2 rounded-full hover:opacity-90 transition">
              {t(typedLang, "home", "startLearning")}
            </button>
          </Link>
        </div>
      </div>

{/* About Section */}
<Link
  href={`/${typedLang}/about`}
  className="mt-12 text-base text-black-900 hover:underline inline-flex items-center space-x-1"
>
  <span>{t(typedLang, "home", "aboutPrefix")}</span>
  <Logo variant="classic" size="text-[18px]" />
</Link>
    </motion.section>
  );
}
