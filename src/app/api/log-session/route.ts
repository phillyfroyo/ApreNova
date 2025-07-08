// src/app/api/log-session/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { ms, type } = await req.json();

  if (typeof ms !== 'number' || !type) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  try {
    await prisma.sessionLog.create({
  data: {
    userId: session.user.id,
    ms,
    type,
  },
});

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('SessionLog error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
