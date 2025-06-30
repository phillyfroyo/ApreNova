import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');

  if (!email) {
    return new Response(JSON.stringify({ error: 'Missing email' }), { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { quizLevel: true },
    });

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
    }

    return new Response(JSON.stringify({ level: user.quizLevel }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to fetch user level' }), { status: 500 });
  }
}

export async function POST(req) {
  const body = await req.json();
  const { email, level } = body;

  if (!email || !level) {
    return new Response(JSON.stringify({ error: 'Missing email or level' }), { status: 400 });
  }

  try {
    await prisma.user.update({
      where: { email },
      data: { quizLevel: level },
    });

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to update user level' }), { status: 500 });
  }
}
