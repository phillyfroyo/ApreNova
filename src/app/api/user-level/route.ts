import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { requireAuth, createAuthResponse, AuthError, validateUserOwnership } from '@/lib/auth-helpers'

export async function GET(req: Request) {
  try {
    const authenticatedUser = await requireAuth()
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Missing userId' }), { status: 400 })
    }

    // Prevent users from accessing other users' data
    validateUserOwnership(authenticatedUser.id, userId)

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { quizLevel: true },
    })

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 })
    }

    return new Response(JSON.stringify({ level: user.quizLevel }), { status: 200 })
  } catch (error) {
    if (error instanceof AuthError) {
      return createAuthResponse(error)
    }
    return new Response(JSON.stringify({ error: 'Failed to fetch user level' }), { status: 500 })
  }
}


export async function POST(req: Request) {
  try {
    const authenticatedUser = await requireAuth()
    const body = await req.json()
    const { userId, level } = body

    if (level === undefined) {
      return new Response(JSON.stringify({ error: 'Missing level' }), { status: 400 })
    }

    // Use authenticated user's ID if userId not provided, otherwise validate ownership
    const targetUserId = userId || authenticatedUser.id
    if (userId) {
      validateUserOwnership(authenticatedUser.id, userId)
    }

    await prisma.user.update({
      where: { id: targetUserId },
      data: { quizLevel: level },
    })

    // Bulk-update all bookmarks to the new level (keep same chapter/page position)
    const updateResult = await prisma.storyBookmark.updateMany({
      where: { userId: targetUserId },
      data: { level, updatedAt: new Date() },
    })

    return new Response(JSON.stringify({
      success: true,
      bookmarksUpdated: updateResult.count,
    }), { status: 200 })
  } catch (error) {
    if (error instanceof AuthError) {
      return createAuthResponse(error)
    }
    return new Response(JSON.stringify({ error: 'Failed to update user level' }), { status: 500 })
  }
}
