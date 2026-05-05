// src/app/api/log-session/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { prisma } from '@/lib/prisma';
import { sendCapiEvent, extractCapiUserContext } from '@/lib/meta-capi';
import { newEventId } from '@/lib/meta-event-id';

const READING_MILESTONES = [
  { minutes: 10, key: '10min', eventName: 'ReadingTime10Min' },
  { minutes: 30, key: '30min', eventName: 'ReadingTime30Min' },
  { minutes: 60, key: '60min', eventName: 'ReadingTime60Min' },
] as const;

export async function POST(req: Request) {
  if (req.headers.get("content-type") !== "application/json") {
    console.warn("⚠️ Received non-JSON log POST");
    return NextResponse.json({ error: 'Expected JSON' }, { status: 400 });
  }

  let ms: number, type: string, storySlug: string | undefined;

  try {
    const body = await req.json();
    ms = body.ms;
    type = body.type;
    storySlug = body.storySlug;
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
    // Anonymous users - silently succeed but don't log
    return NextResponse.json({ status: 'ok' });
  }

  try {
    await prisma.sessionLog.create({
      data: {
        userId: session.user.id,
        ms: ms,
        type: type,
        ...(storySlug && { storySlug }),
      }
    });

    console.log(`📝 Logged session to DB: ${type} - ${ms}ms for user ${session.user.id}`);

    if (type === 'reading') {
      await maybeFireReadingMilestones(session.user.id, req);
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error("❌ Failed to save session log:", error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

async function maybeFireReadingMilestones(userId: string, req: Request): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, phone: true, pixelMilestones: true },
  });
  if (!user) return;

  const remaining = READING_MILESTONES.filter((m) => !user.pixelMilestones.includes(m.key));
  if (remaining.length === 0) return;

  const totals = await prisma.sessionLog.aggregate({
    where: { userId, type: 'reading' },
    _sum: { ms: true },
  });
  const totalMinutes = (totals._sum.ms ?? 0) / 60_000;

  const newlyCrossed = remaining.filter((m) => totalMinutes >= m.minutes);
  if (newlyCrossed.length === 0) return;

  // Mark all crossed milestones in one update so we don't double-fire on
  // racing requests. Postgres array push is atomic at the row level.
  await prisma.user.update({
    where: { id: userId },
    data: {
      pixelMilestones: {
        push: newlyCrossed.map((m) => m.key),
      },
    },
  });

  const ctx = extractCapiUserContext(req);
  for (const milestone of newlyCrossed) {
    await sendCapiEvent({
      eventName: milestone.eventName,
      eventId: newEventId(),
      customData: { total_minutes: Math.round(totalMinutes) },
      userData: {
        email: user.email,
        phone: user.phone,
        externalId: userId,
        ...ctx,
      },
    });
    console.log(`🎯 Fired ${milestone.eventName} for user ${userId}`);
  }
}
