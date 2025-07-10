// src/app/api/dev-toggle-premium/route.ts

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";

function getLangFromUrl(url: string): string {
  const segments = new URL(url).pathname.split('/').filter(Boolean);
  return segments[0] === 'en' || segments[0] === 'es' ? segments[0] : 'es';
}

export async function POST(request: Request) {
  const lang = getLangFromUrl(request.url);

  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.redirect(`/${lang}/login`);
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (process.env.NODE_ENV === "production") {
    return NextResponse.redirect(new URL(`/${lang}/premium`, request.url));
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      isPremium: !user.isPremium,
    },
  });

  return NextResponse.redirect(new URL(`/${lang}/premium`, request.url));

}
