// src/app/api/post-login/route.ts
import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';
import type { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const token = await getToken({ req });

  const lang = req.nextUrl.searchParams.get('lang') === 'en' ? 'en' : 'es';

  if (!token?.email) {
    return NextResponse.redirect(new URL(`/es/auth/login`, req.url));
  }

  await prisma.user.updateMany({
    where: { email: token.email, nativeLanguage: null },
    data: { nativeLanguage: lang },
  });

  return NextResponse.redirect(new URL(`/${lang}/stories`, req.url));
}
