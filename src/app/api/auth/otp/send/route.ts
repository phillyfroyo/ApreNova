// src/app/api/auth/otp/send/route.ts
// Send OTP code to user's email for passwordless login

import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { prisma } from '@/lib/prisma';
import { createOtpCode } from '@/lib/otp';
import { getOtpEmailContent } from '@/lib/otp/email/templates';
import { isValidEmail, AUTH_ERROR_CODES } from '@/lib/auth-errors';

const resend = new Resend(process.env.RESEND_API_KEY);

// Sender email - use verified domain in production
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

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

  const { email, lang = 'en' } = body;

  // Validate email
  if (!email) {
    return NextResponse.json(
      { error: 'Email is required', code: AUTH_ERROR_CODES.MISSING_REQUIRED_FIELDS },
      { status: 400 }
    );
  }

  if (!isValidEmail(email)) {
    return NextResponse.json(
      { error: 'Invalid email format', code: AUTH_ERROR_CODES.INVALID_EMAIL },
      { status: 400 }
    );
  }

  const normalizedEmail = email.toLowerCase();

  // Check if user exists (for login, user must exist)
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    return NextResponse.json(
      { error: 'No account found with this email', code: AUTH_ERROR_CODES.USER_NOT_FOUND },
      { status: 404 }
    );
  }

  // Create OTP code
  const result = await createOtpCode(normalizedEmail);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error, code: AUTH_ERROR_CODES.TOO_MANY_REQUESTS },
      { status: 429 }
    );
  }

  // Send email
  try {
    const emailContent = getOtpEmailContent(result.code!, lang as 'en' | 'es');

    await resend.emails.send({
      from: FROM_EMAIL,
      to: normalizedEmail,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    return NextResponse.json({
      success: true,
      message: 'Code sent successfully',
      // Don't expose the code in response - only in email!
    });
  } catch (error) {
    console.error('Failed to send OTP email:', error);
    return NextResponse.json(
      { error: 'Failed to send code. Please try again.', code: AUTH_ERROR_CODES.INTERNAL_ERROR },
      { status: 500 }
    );
  }
}
