'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { H1, H2, Body, Small, Button, Badge, Card, Input } from '@/components/ui';
import Link from 'next/link';
import Logo from '@/components/Logo';

export default function DesignGuideClient() {
  const [language, setLanguage] = useState('es');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const logoVariants = {
    default: 'Default',
    quiz: 'Quiz',
    auth: 'Auth',
    corporate: 'Corporate',
    classic: 'Classic',
    vibrant: 'Vibrant',
    electric: 'Electric',
    wave: 'Wave',
    berryblast: 'Berry Blast',
    glowcool: 'Glow Cool',
    glowmint: 'Glow Mint',
    glassmode: 'Glass Mode',
  };

  const levels = ['l1', 'l2', 'l3', 'l4', 'l5'];

  return (
    <motion.div
      className="p-10 space-y-12 bg-[url('/images/background3.png')] bg-cover bg-center text-foreground min-h-screen overflow-y-auto"
      initial={{ y: 10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="absolute top-10 right-10 flex flex-col md:flex-row gap-4">
  {/* Classic Dropdown */}
  <div className="inline-block relative group cursor-pointer w-fit">
    <div className="inline-block px-4 py-2 border bg-white rounded shadow hover:bg-gray-100 whitespace-nowrap">
      Level Select ▾
    </div>
    <div className="absolute top-full right-0 hidden group-hover:block bg-white text-black border border-gray-300 p-2 w-36 z-50">
      {levels.map((level) => (
        <div
          key={level}
          onClick={() => window.location.href = `/es/stories/aventura/${level}/part-1`}
          className="hover:underline cursor-pointer py-1"
        >
          {level.toUpperCase()}
        </div>
      ))}
    </div>
  </div>

  {/* Styled Dropdown #1 */}
  <div className="inline-block relative group cursor-pointer w-fit">
    <div className="inline-block px-4 py-2 border border-emerald-400 bg-white/80 rounded-xl shadow-md backdrop-blur-md text-emerald-700 font-semibold hover:bg-emerald-50 whitespace-nowrap">
      Choose Level ▾
    </div>
    <div className="absolute top-full right-0 hidden group-hover:block bg-white/90 text-black border border-emerald-300 rounded-xl shadow-md p-2 w-40 z-50">
      {levels.map((level) => (
        <div
          key={level}
          onClick={() => window.location.href = `/es/stories/aventura/${level}/part-1`}
          className="py-2 px-4 hover:bg-emerald-100 rounded cursor-pointer"
        >
          {level.toUpperCase()}
        </div>
      ))}
    </div>
  </div>

  {/* Styled Dropdown #2 */}
  <div className="inline-block relative group cursor-pointer w-fit">
    <div className="inline-block px-4 py-2 border border-purple-400 bg-purple-50 rounded-full shadow hover:bg-purple-100 text-purple-700 font-bold whitespace-nowrap">
      Select Level ▾
    </div>
    <div className="absolute top-full right-0 hidden group-hover:block bg-white text-black border border-purple-300 rounded-lg shadow-lg p-2 w-40 z-50">
      {levels.map((level) => (
        <div
          key={level}
          onClick={() => window.location.href = `/es/stories/aventura/${level}/part-1`}
          className="py-2 px-4 hover:bg-purple-100 rounded cursor-pointer"
        >
          {level.toUpperCase()}
        </div>
      ))}
    </div>
  </div>
</div>

      <section>
        <H1 className="mb-8">Design Guide</H1>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Object.entries(logoVariants).map(([variant, label]) => (
            <Card key={variant} className="flex flex-col items-center justify-center py-6 px-12 scale-200">
              <Logo variant={variant} size="text-6xl" className="drop-shadow-aprenova" />
              <p className="mt-4 text-black text-lg font-semibold">{label}</p>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <H1 className="mb-8">Design Guide</H1>
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
  {/* 🧁 Soft Glow */}
  <Card className="shadow-md hover:shadow-lg ring-1 ring-inset ring-neutral-200 rounded-2xl p-6">
    <H2 className="mb-2">🧁 Soft Glow</H2>
    <Body className="mb-4">Subtle shadows and ring effects.</Body>
    <Button variant="button1">Try Me</Button>
  </Card>

  {/* 🍬 Glassmorphism */}
  <Card className="bg-white/30 backdrop-blur-md border border-white/10 text-black rounded-2xl p-6">
    <H2 className="mb-2">🍬 Glassmorphism</H2>
    <Body className="mb-4">Semi-transparent, soft blur.</Body>
    <Button variant="button1">Try Me</Button>
  </Card>

  {/* 🔮 Interactive Animation */}
  <Card className="transition-all duration-300 hover:scale-105 hover:rotate-1 rounded-2xl p-6">
    <H2 className="mb-2">🔮 Interactive Animations</H2>
    <Body className="mb-4">Movement and fun on hover.</Body>
    <Button variant="button1">Try Me</Button>
  </Card>

  {/* 🧨 Bold Theme */}
  <Card className="bg-gradient-to-br from-purple-700 to-indigo-700 text-white shadow-xl rounded-2xl p-6">
    <H2 className="mb-2">🧨 Bold Theme</H2>
    <Body className="mb-4">Big contrast and punchy color.</Body>
    <Button variant="button1">Try Me</Button>
  </Card>

  {/* 🌈 Combo: Glow + Glass + Hover Scale */}
  <Card className="bg-white/30 backdrop-blur-md border border-white/10 text-black ring-1 ring-inset shadow-md hover:shadow-lg transform transition-transform duration-300 hover:scale-[1.005] will-change-transform rounded-2xl p-6">
    <H2 className="mb-2">🌈 Combo Style</H2>
    <Body className="mb-4">Glow, glassmorphism, and soft hover animation.</Body>
    <Button variant="button1">Try Me</Button>
  </Card>

  {/* 🍬 Glassmorphism + Glow Hover */}
  <Card className="bg-white/30 backdrop-blur-md border border-white/10 text-black transition-shadow duration-300 hover:shadow-lg ring-1 ring-inset rounded-2xl p-6">
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
  <Card className="bg-white/30 backdrop-blur-md border border-white/10 text-black transition-shadow duration-300 hover:shadow-lg ring-1 ring-inset rounded-2xl p-6">
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
      <section>
        <H2 className="mb-4">Dropdown Styles</H2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Classic Dropdown */}
          <div className="relative group cursor-pointer">
            <div className="px-3 py-2 border bg-white rounded shadow hover:bg-gray-100">
              Level Select ▾
            </div>
            <div className="absolute top-full right-0 hidden group-hover:block bg-white text-black border border-gray-300 p-2 w-36 z-50">
              {levels.map((level) => (
                <div
                  key={level}
                  onClick={() => window.location.href = `/es/stories/aventura/${level}/part-1`}
                  className="hover:underline cursor-pointer py-1"
                >
                  {level.toUpperCase()}
                </div>
              ))}
            </div>
          </div>

          {/* Styled Dropdown #1 */}
          <div className="relative group cursor-pointer">
            <div className="px-4 py-2 border border-emerald-400 bg-white/80 rounded-xl shadow-md backdrop-blur-md text-emerald-700 font-semibold hover:bg-emerald-50">
              Choose Level ▾
            </div>
            <div className="absolute top-full right-0 hidden group-hover:block bg-white/90 text-black border border-emerald-300 rounded-xl shadow-md p-2 w-40 z-50">
              {levels.map((level) => (
                <div
                  key={level}
                  onClick={() => window.location.href = `/es/stories/aventura/${level}/part-1`}
                  className="py-2 px-4 hover:bg-emerald-100 rounded cursor-pointer"
                >
                  {level.toUpperCase()}
                </div>
              ))}
            </div>
          </div>

          {/* Styled Dropdown #2 */}
          <div className="relative group cursor-pointer">
            <div className="px-4 py-2 border border-purple-400 bg-purple-50 rounded-full shadow hover:bg-purple-100 text-purple-700 font-bold">
              Select Level ▾
            </div>
            <div className="absolute top-full right-0 hidden group-hover:block bg-white text-black border border-purple-300 rounded-lg shadow-lg p-2 w-40 z-50">
              {levels.map((level) => (
                <div
                  key={level}
                  onClick={() => window.location.href = `/es/stories/aventura/${level}/part-1`}
                  className="py-2 px-4 hover:bg-purple-100 rounded cursor-pointer"
                >
                  {level.toUpperCase()}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </motion.div>
  );
}