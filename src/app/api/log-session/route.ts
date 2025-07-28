// src/app/api/log-session/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  if (req.headers.get("content-type") !== "application/json") {
    console.warn("⚠️ Received non-JSON log POST");
    return NextResponse.json({ error: 'Expected JSON' }, { status: 400 });
  }

  let ms: number, type: string;

  try {
    const body = await req.json();
    ms = body.ms;
    type = body.type;
  } catch (err) {
    console.warn("⚠️ Malformed or missing JSON body in log POST");
    return NextResponse.json({ error: 'Malformed JSON' }, { status: 400 });
  }

  if (typeof ms !== 'number' || !type) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  // Get the current user session
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    console.warn("⚠️ Session logging attempted without valid user session");
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Save session log to database
    await prisma.sessionLog.create({
      data: {
        userId: session.user.id,
        ms: ms,
        type: type
      }
    });

    console.log(`📝 Logged session to DB: ${type} - ${ms}ms for user ${session.user.id}`);
    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error("❌ Failed to save session log:", error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
