import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  console.log('Session check:', session?.user?.id)

  if (!session?.user?.id) {
  return new Response(JSON.stringify({ error: 'Missing user ID in session' }), { status: 400 })
}

  const { field, value } = await req.json()

  console.log('UpdateField:', {
  userId: session.user.id,
  field,
  value,
})

  const allowedFields = ['name', 'email', 'nativeLanguage']
  if (!allowedFields.includes(field)) {
    return NextResponse.json({ error: 'Invalid field' }, { status: 400 })
  }

  try {
    const updatedUser = await prisma.user.update({
  where: { id: session.user.id },
  data: { [field]: value },
})

    return NextResponse.json({ success: true, user: updatedUser })
  } catch (err) {
    console.error('Update failed:', err)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}
