'use client'

import { useSession } from 'next-auth/react'

export default function MyAccountPage() {
  const { data: session, status } = useSession()

  if (status === 'loading') {
    return <p>Loading...</p>
  }

  if (!session?.user?.email) {
    return <p>Not logged in</p>
  }

  return (
    <div className="text-center mt-10">
      <h1 className="text-2xl font-bold">¡Hola {session.user.email}! 🎉</h1>
      <p>Esta es tu página de cuenta.</p>
    </div>
  )
}
