// src/styles/DesignGuide.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { H1, H2, Body, Small, Button, Badge, Card, Input } from '@/components/ui';
import Link from 'next/link';

export default function DesignGuide() {
  const [language, setLanguage] = useState('es');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <motion.div
      className="p-10 space-y-12 bg-[url('/images/background3.png')] bg-cover bg-center text-foreground min-h-screen"
      initial={{ y: 10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <section>
        <H1 className="mb-8">Design Guide</H1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
          {/* 🧁 Soft Glow */}
          <Card className="shadow-md hover:shadow-lg ring-1 ring-inset ring-neutral-200">
            <H2 className="mb-2">🧁 Soft Glow</H2>
            <Body className="mb-4">Subtle shadows and ring effects.</Body>
            <Button variant="button1">Try Me</Button>
          </Card>

          {/* 🍬 Glassmorphism */}
          <Card className="bg-white/30 backdrop-blur-md border border-white/10 text-black">
            <H2 className="mb-2">🍬 Glassmorphism</H2>
            <Body className="mb-4">Semi-transparent, soft blur.</Body>
            <Button variant="button1">Try Me</Button>
          </Card>

          {/* 🔮 Interactive Animation */}
          <Card className="transition-all duration-300 hover:scale-105 hover:rotate-1">
            <H2 className="mb-2">🔮 Interactive Animations</H2>
            <Body className="mb-4">Movement and fun on hover.</Body>
            <Button variant="button1">Try Me</Button>
          </Card>

          {/* 🧨 Bold Theme */}
          <Card className="bg-gradient-to-br from-purple-700 to-indigo-700 text-white shadow-xl">
            <H2 className="mb-2">🧨 Bold Theme</H2>
            <Body className="mb-4">Big contrast and punchy color.</Body>
            <Button variant="button1">Try Me</Button>
          </Card>

          {/* 🌈 Combo: Glow + Glass + Hover Scale */}
          <Card className="bg-white/30 backdrop-blur-md border border-white/10 text-black ring-1 ring-inset shadow-md hover:shadow-lg transform transition-transform duration-300 hover:scale-[1.005] will-change-transform">
            <H2 className="mb-2">🌈 Combo Style</H2>
            <Body className="mb-4">Glow, glassmorphism, and soft hover animation.</Body>
            <Button variant="button1">Try Me</Button>
          </Card>

          {/* 🌥️ Glassmorphism + Glow Hover */}
          <Card className="bg-white/30 backdrop-blur-md border border-white/10 text-black transition-shadow duration-300 hover:shadow-lg ring-1 ring-inset">
            <H2 className="mb-2">🌥️ Glass + Glow Hover</H2>
            <Body className="mb-4">Glass base with soft glow on hover.</Body>
            <Button variant="button1">Try Me</Button>
          </Card>
        </div>
      </section>

      <section>
        <H2 className="mb-4">Typography</H2>
        <div className="space-y-2">
          <H1>Heading 1</H1>
          <H2>Heading 2</H2>
          <Body>This is body text used across the site.</Body>
          <Small>This is small text used for helper or hint labels.</Small>
        </div>
      </section>

      <section>
        <H2 className="mb-4">Buttons</H2>
        <div className="flex gap-4">
          <Button variant="button1">Primary</Button>
          <Button variant="button1">Accent</Button>
          <Button variant="button1">Muted</Button>
        </div>
      </section>

      <section>
        <H2 className="mb-4">Badges</H2>
        <div className="space-x-4">
          <Badge level="level1">Level 1</Badge>
          <Badge level="level2">Level 2</Badge>
          <Badge level="level3">Level 3</Badge>
        </div>
      </section>

      <section>
  <H2 className="mb-4">Card + Input Demo</H2>
  <Card className="bg-white/30 backdrop-blur-md border border-white/10 text-black shadow-md hover:shadow-lg">
    <H2 className="mb-6">Sign In</H2>

    <p className="text-sm italic text-black mb-1">
      My native language is / Mi idioma nativo es:
    </p>
    <div className="relative w-full mb-3" ref={dropdownRef}>
      <button
        type="button"
        className="w-full px-4 py-2 border rounded-lg bg-white text-left"
        onClick={() => setDropdownOpen(!dropdownOpen)}
      >
        {language === 'en' ? 'English' : 'Español'}
      </button>

      {dropdownOpen && (
        <div className="absolute left-0 mt-1 w-full bg-white border rounded-md shadow-md z-10">
          {language !== 'en' && (
            <div onClick={() => setLanguage('en')} className="px-4 py-2 hover:bg-gray-100 cursor-pointer">English</div>
          )}
          {language !== 'es' && (
            <div onClick={() => setLanguage('es')} className="px-4 py-2 hover:bg-gray-100 cursor-pointer">Español</div>
          )}
        </div>
      )}
    </div>

    <Input placeholder="Email" type="email" className="mb-3 transition-all focus:ring-2 focus:ring-primary/50" />
    <Input placeholder="Password" type="password" className="mb-4 transition-all focus:ring-2 focus:ring-primary/50" />
    <Button variant="button1" className="w-full mb-4">Sign In</Button>

    <p className="text-center text-sm text-gray-500 mb-3">or</p>

    <button
      type="button"
      onClick={() => alert('Google auth simulated')}
      className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-lg py-2 bg-white hover:bg-gray-100 transition group"
    >
      <img
        src="https://www.svgrepo.com/show/475656/google-color.svg"
        alt="Google"
        className="w-5 h-5 transform transition-transform duration-300 group-hover:translate-x-1"
      />
      <span className="text-sm text-gray-700 font-medium">Continue with Google</span>
    </button>
  </Card>
</section>

      <section>
        <H2 className="mb-4">Navigate</H2>
        <Link href="/about">
          <Button variant="button1">Go to About Page</Button>
        </Link>
      </section>
    </motion.div>
  );
}
