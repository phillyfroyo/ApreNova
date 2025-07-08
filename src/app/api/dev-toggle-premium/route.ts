import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.redirect("/es/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (process.env.NODE_ENV === "production") {
  return NextResponse.redirect(new URL("/es/premium", request.url));

}

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      isPremium: !user.isPremium,
    },
  });

  return NextResponse.redirect(new URL("/es/premium", request.url));

}
