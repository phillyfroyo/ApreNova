'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import Dropdown from '@/components/ui/Dropdown';
import Link from 'next/link';
import Logo from '@/components/Logo';
import { H1, H2, Body, Small, Button, Badge, Card, Input } from '@/components/ui';
import { cardPresets } from "@/styles/cardPresets";
import { t } from "@/lib/t";
import type { Language } from "@/types/i18n";


export default function DesignGuideClient() {
  const [language, setLanguage] = useState<Language>('es');

  const levels = ['l1', 'l2', 'l3', 'l4', 'l5'];

  const levelLabels: Record<string, string> = {
    l1: "Brand New",
    l2: "Beginner",
    l3: "Intermediate",
    l4: "Advanced",
    l5: "Fluent"
  };

  const levelOptions = levels.map((lvl) => ({
    label: levelLabels[lvl],
    value: lvl
  }));


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

  return (
    <motion.div
      className="p-10 space-y-12 bg-[url('/images/background3.png')] bg-cover bg-center text-foreground min-h-screen overflow-y-auto"
      initial={{ y: 10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="absolute top-10 right-10 flex flex-col md:flex-row gap-4">
        <Link href="/about">
          <Button variant="button1">Go to About Page</Button>
        </Link>
      </div>

      <section>
        <H1 className="mb-8">Dropdown Variants</H1>
        <div className="flex flex-col gap-4 items-start">
          <Dropdown
            label="Default ▾"
            variant="default"
            options={levelOptions}
            onSelect={(level) => alert(`Selected ${level}`)}
          />
          <Dropdown
            label="Glass ▾"
            variant="glass"
            options={levelOptions}
            onSelect={(level) => alert(`Selected ${level}`)}
          />
          <Dropdown
            label="Rounded ▾"
            variant="rounded"
            options={levelOptions}
            onSelect={(level) => alert(`Selected ${level}`)}
          />
          <Dropdown
            label="Bold ▾"
            variant="bold"
            options={levelOptions}
            onSelect={(level) => alert(`Selected ${level}`)}
          />
          <Dropdown
            label={language === 'en' ? 'English' : 'Español'}
            variant="auth"
            options={[
    { label: 'English', value: 'en' },
    { label: 'Español', value: 'es' }
  ]}
            onSelect={(lng) => setLanguage(lng as Language)}
          />
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
  <div className="flex gap-4 flex-wrap">
    <Button variant="primary">Primary</Button>
    <Button variant="accent">Accent</Button>
    <Button variant="muted">Muted</Button>
    <Button variant="button1">Button 1</Button>
    <Button variant="parts">Parts</Button>
  </div>
</section>


      <section>
        <H2 className="mb-4">Badges</H2>
        <div className="space-x-4">
          <Badge level="level1">Level 1</Badge>
          <Badge level="level2">Level 2</Badge>
          <Badge level="level3">Level 3</Badge>
          <Badge level="level4">Level 4</Badge>
          <Badge level="level5">Level 5</Badge>
        </div>
      </section>

      <section>
  <H1 className="mb-8">Card Presets</H1>
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {Object.entries(cardPresets).map(([key, card]) => (
      <Card key={card.title} className={card.className}>
        <H2 className="mb-2">{card.title}</H2>
        <Body className="mb-4">{card.description}</Body>
        <Button variant="button1">Try Me</Button>
      </Card>
    ))}
  </div>
</section>

      <section>
        <H1 className="mb-8">Logo Guide</H1>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Object.entries(logoVariants).map(([variant, label]) => (
            <Card key={variant} className="flex flex-col items-center justify-center py-6 px-12 scale-200">
              <Logo variant={variant} size="text-6xl" className="drop-shadow-aprenova" />
              <p className="mt-4 text-black text-lg font-semibold">{label}</p>
            </Card>
          ))}
        </div>
      </section>
    </motion.div>
  );
}
