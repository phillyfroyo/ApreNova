// Public stats for the landing page. Cached at the route level so we don't hit
// the DB on every visitor.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { EARLY_ADOPTER_CAP } from '@/lib/early-adopter';

// Revalidate at most once every 5 minutes.
export const revalidate = 300;

export async function GET() {
  const userCount = await prisma.user.count();
  return NextResponse.json({
    userCount,
    cap: EARLY_ADOPTER_CAP,
  });
}
