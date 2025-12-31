// src/app/api/user-language/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const { nativeLanguage } = await req.json();

    if (!nativeLanguage || !['en', 'es'].includes(nativeLanguage)) {
      return NextResponse.json({ error: 'Invalid language' }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { nativeLanguage },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update language:', error);
    return NextResponse.json({ error: 'Failed to update language' }, { status: 500 });
  }
}
