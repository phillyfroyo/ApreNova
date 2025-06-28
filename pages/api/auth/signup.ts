import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
import type { NextApiRequest, NextApiResponse } from 'next'

const prisma = new PrismaClient()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' })
  }

  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ message: 'Missing email or password' })
  }

  try {
    // Check if the user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return res.status(409).json({ message: 'User already exists' })
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create the new user
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
      },
    })

    // Optionally: log them in here (NextAuth session logic, if you want)
    return res.status(201).json({ message: 'User created', user: { id: newUser.id, email: newUser.email } })
  } catch (error) {
    console.error('[SIGNUP_ERROR]', error)
    return res.status(500).json({ message: 'Internal Server Error' })
  }
}
