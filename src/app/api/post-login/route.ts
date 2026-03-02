// src/app/api/post-login/route.ts
import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';
import type { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const token = await getToken({ req });

  if (!token?.email) {
    return NextResponse.redirect(new URL(`/es/auth/login`, req.url));
  }

  // Get user from database to check their native language preference
  const user = await prisma.user.findUnique({
    where: { email: token.email },
    select: { nativeLanguage: true },
  });

  // Use user's native language from DB, fall back to URL param only if not set
  let lang = user?.nativeLanguage as 'en' | 'es' | null;

  if (!lang) {
    // If user has no native language set, use URL parameter and save it
    lang = req.nextUrl.searchParams.get('lang') === 'en' ? 'en' : 'es';
    await prisma.user.updateMany({
      where: { email: token.email, nativeLanguage: null },
      data: { nativeLanguage: lang },
    });
  }

  // Check if a quizLevel was passed from onboarding (e.g. Google OAuth after completing onboarding)
  const quizLevelParam = req.nextUrl.searchParams.get('quizLevel');

  // Check if user has a quizLevel set in DB
  const userWithLevel = await prisma.user.findUnique({
    where: { email: token.email },
    select: { quizLevel: true },
  });

  if (!userWithLevel?.quizLevel) {
    if (quizLevelParam) {
      // User completed onboarding before signing up — save the level to DB
      await prisma.user.update({
        where: { email: token.email },
        data: { quizLevel: quizLevelParam },
      });
      // Go to stories since onboarding is complete
      return NextResponse.redirect(new URL(`/${lang}/stories`, req.url));
    }
    // New user without level — send to root for onboarding step 1
    return NextResponse.redirect(new URL('/', req.url));
  }

  // Existing user with level - go to dashboard
  return NextResponse.redirect(new URL(`/${lang}/dashboard`, req.url));
}
