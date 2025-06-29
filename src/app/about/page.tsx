// src/app/about/page.tsx
'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { H1, Body, Button } from '@/components/ui';
import Link from 'next/link';

export default function AboutPage() {
  return (
    <motion.div
      className="p-10 bg-background text-foreground min-h-screen"
      initial={{ y: 10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <H1 className="mb-4">About ApreNova</H1>
      <Body>
        ApreNova is your personal story-driven language coach. We believe people learn best
        through narrative, context, and emotion — not boring grammar drills.
      </Body>

      <div className="mt-8">
        <Link href="/design-guide">
          <Button variant="primary">Back to Design Guide</Button>
        </Link>
      </div>
    </motion.div>
  );
}
