// src/app/design-guide/page.tsx
'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { H1, H2, Body, Small, Button, Badge, Card, Input } from '@/components/ui';
import Link from 'next/link';

export default function DesignGuide() {
  return (
    <motion.div
      className="p-10 space-y-12 bg-background text-foreground min-h-screen"
      initial={{ y: 10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
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
        <div className="space-x-4">
          <Button className="transition-transform duration-300 hover:scale-105 hover:shadow-lg" variant="primary">Primary</Button>
          <Button className="transition-transform duration-300 hover:scale-105 hover:shadow-lg" variant="accent">Accent</Button>
          <Button className="transition-transform duration-300 hover:scale-105 hover:shadow-lg" variant="muted">Muted</Button>
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
        <Card>
          <H2 className="mb-2">Iniciar sesión</H2>
          <Small className="mb-4 block">Mi idioma nativo es / My native language is:</Small>
          <Input placeholder="Español" className="mb-3 transition-all focus:ring-2 focus:ring-primary/50" />
          <Input placeholder="test@example.com" type="email" className="mb-3 transition-all focus:ring-2 focus:ring-primary/50" />
          <Input placeholder="••••••••" type="password" className="mb-4 transition-all focus:ring-2 focus:ring-primary/50" />
          <Button variant="primary" className="w-full transition-transform duration-300 hover:scale-[1.02] hover:shadow-md">
            Iniciar sesión
          </Button>
        </Card>
      </section>

      <section>
        <H2 className="mb-4">Navigate</H2>
        <Link href="/about">
          <Button variant="accent">Go to About Page</Button>
        </Link>
      </section>
    </motion.div>
  );
}
