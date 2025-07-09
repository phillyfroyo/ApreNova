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

  console.log(`📝 Logged session: ${type} - ${ms}ms`);

  return NextResponse.json({ status: 'ok' });
}
