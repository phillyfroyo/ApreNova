// src/app/api/auth/otp/verify/route.ts
// Verify OTP code and create session for passwordless login

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyOtpCode } from '@/lib/otp';
import { isValidEmail, AUTH_ERROR_CODES } from '@/lib/auth-errors';
import { encode } from 'next-auth/jwt';
import { cookies } from 'next/headers';

// JWT configuration - must match NextAuth settings
const JWT_SECRET = process.env.NEXTAUTH_SECRET!;
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

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

  const { email, code } = body;

  // Validate inputs
  if (!email || !code) {
    return NextResponse.json(
      { error: 'Email and code are required', code: AUTH_ERROR_CODES.MISSING_REQUIRED_FIELDS },
      { status: 400 }
    );
  }

  if (!isValidEmail(email)) {
    return NextResponse.json(
      { error: 'Invalid email format', code: AUTH_ERROR_CODES.INVALID_EMAIL },
      { status: 400 }
    );
  }

  // Validate code format (6 digits)
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { error: 'Invalid code format', code: 'INVALID_CODE_FORMAT' },
      { status: 400 }
    );
  }

  const normalizedEmail = email.toLowerCase();

  // Verify the OTP code
  const verification = await verifyOtpCode(normalizedEmail, code);

  if (!verification.success) {
    return NextResponse.json(
      { error: verification.error, code: verification.errorCode },
      { status: 401 }
    );
  }

  // Get user
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    return NextResponse.json(
      { error: 'User not found', code: AUTH_ERROR_CODES.USER_NOT_FOUND },
      { status: 404 }
    );
  }

  // Create JWT token (same format as NextAuth)
  const token = await encode({
    token: {
      id: user.id,
      email: user.email,
      name: user.name ?? undefined,
      nativeLanguage: user.nativeLanguage ?? undefined,
      quizLevel: user.quizLevel ?? undefined,
      isPremium: user.isPremium,
    },
    secret: JWT_SECRET,
    maxAge: SESSION_MAX_AGE,
  });

  // Set session cookie
  const cookieStore = await cookies();
  const isProduction = process.env.NODE_ENV === 'production';

  cookieStore.set('next-auth.session-token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });

  // Also set the secure cookie for production
  if (isProduction) {
    cookieStore.set('__Secure-next-auth.session-token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: SESSION_MAX_AGE,
      path: '/',
    });
  }

  return NextResponse.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      nativeLanguage: user.nativeLanguage,
      quizLevel: user.quizLevel,
    },
  });
}
