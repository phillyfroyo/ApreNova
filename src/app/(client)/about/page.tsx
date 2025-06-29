// src/app/page.tsx
'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { H1, Body, Button } from '@/components/ui';
import Link from 'next/link';

export default function HomePage() {
  return (
    <motion.div
      className="p-10 bg-background text-foreground min-h-screen"
      initial={{ y: 10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <H1 className="mb-4">Welcome to ApreNova</H1>
      <Body>
        Learn smarter, not harder. Explore immersive language stories designed for actual fluency.
      </Body>

      <div className="mt-8 space-x-4">
        <Link href="/about">
          <Button variant="primary">About</Button>
        </Link>
        <Link href="/design-guide">
          <Button variant="accent">Design Guide</Button>
        </Link>
      </div>
    </motion.div>
  );
}
