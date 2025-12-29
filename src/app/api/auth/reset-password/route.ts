// src/app/api/auth/reset-password/route.ts
// Reset user password after OTP verification
// Security: Requires a valid session (created after OTP verification) that matches the email

import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { isValidEmail, AUTH_ERROR_CODES } from '@/lib/auth-errors';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { cookies } from 'next/headers';
import { decode } from 'next-auth/jwt';

const JWT_SECRET = process.env.NEXTAUTH_SECRET!;

export async function POST(req: Request) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body', code: 'INVALID_REQUEST' },
      { status: 400 }
    );
  }

  const { email, password } = body;

  // Validate inputs
  if (!email || !password) {
    return NextResponse.json(
      { error: 'Email and password are required', code: AUTH_ERROR_CODES.MISSING_REQUIRED_FIELDS },
      { status: 400 }
    );
  }

  if (!isValidEmail(email)) {
    return NextResponse.json(
      { error: 'Invalid email format', code: AUTH_ERROR_CODES.INVALID_EMAIL },
      { status: 400 }
    );
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: 'Password must be at least 6 characters', code: 'PASSWORD_TOO_SHORT' },
      { status: 400 }
    );
  }

  const normalizedEmail = email.toLowerCase();

  // Verify the user has a valid session (from OTP verification)
  // Check both NextAuth session and our custom OTP session cookie
  let sessionEmail: string | null = null;

  // Try NextAuth session first
  const session = await getServerSession(authOptions);
  if (session?.user?.email) {
    sessionEmail = session.user.email.toLowerCase();
  }

  // If no NextAuth session, check our custom JWT cookie (from OTP verify)
  if (!sessionEmail) {
    const cookieStore = await cookies();
    const token = cookieStore.get('next-auth.session-token')?.value;

    if (token) {
      try {
        const decoded = await decode({ token, secret: JWT_SECRET });
        if (decoded?.email) {
          sessionEmail = (decoded.email as string).toLowerCase();
        }
      } catch {
        // Token decode failed
      }
    }
  }

  // Verify the session email matches the request email
  if (!sessionEmail || sessionEmail !== normalizedEmail) {
    return NextResponse.json(
      { error: 'Please verify your email with the code first', code: 'SESSION_REQUIRED' },
      { status: 401 }
    );
  }

  try {
    // Find the user
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found', code: AUTH_ERROR_CODES.USER_NOT_FOUND },
        { status: 404 }
      );
    }

    // Hash the new password
    const hashedPassword = await hash(password, 12);

    // Update the user's password
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json(
      { error: 'Failed to reset password', code: AUTH_ERROR_CODES.INTERNAL_ERROR },
      { status: 500 }
    );
  }
}
