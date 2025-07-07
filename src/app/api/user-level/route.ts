import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Missing userId' }), { status: 400 })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { quizLevel: true },
    })

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 })
    }

    return new Response(JSON.stringify({ level: user.quizLevel }), { status: 200 })
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to fetch user level' }), { status: 500 })
  }
}


export async function POST(req: Request) {
  const body = await req.json()
  const { userId, level } = body
  

  if (!userId || !level) {
    return new Response(JSON.stringify({ error: 'Missing userId or level' }), { status: 400 })
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { quizLevel: level },
    })

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to update user level' }), { status: 500 })
  }
}
