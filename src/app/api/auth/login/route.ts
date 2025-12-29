// src/app/api/auth/login/route.ts
// Pre-validation endpoint for login with granular error codes
// The actual authentication still happens via NextAuth signIn

import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getRateLimiter, getClientIdentifier, createRateLimitHeaders } from "@/lib/rate-limiter";
import { AUTH_ERROR_CODES, isValidEmail } from "@/lib/auth-errors";

export async function POST(req: Request) {
  // Rate limiting
  const clientId = getClientIdentifier(req);
  const rateLimiter = getRateLimiter('authLogin');
  const { allowed, info } = rateLimiter.isAllowed(clientId);

  if (!allowed) {
    return NextResponse.json(
      { error: AUTH_ERROR_CODES.TOO_MANY_REQUESTS, code: AUTH_ERROR_CODES.TOO_MANY_REQUESTS },
      { status: 429, headers: createRateLimitHeaders(info) }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body", code: AUTH_ERROR_CODES.INTERNAL_ERROR },
      { status: 400 }
    );
  }

  const { email, password } = body;

  // Validate required fields
  if (!email || !password) {
    return NextResponse.json(
      { error: "Missing email or password", code: AUTH_ERROR_CODES.MISSING_REQUIRED_FIELDS },
      { status: 400 }
    );
  }

  // Validate email format
  if (!isValidEmail(email)) {
    return NextResponse.json(
      { error: "Invalid email format", code: AUTH_ERROR_CODES.INVALID_EMAIL },
      { status: 400 }
    );
  }

  try {
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found", code: AUTH_ERROR_CODES.USER_NOT_FOUND },
        { status: 401 }
      );
    }

    // Check if user has a password (might be OAuth-only account)
    if (!user.password) {
      return NextResponse.json(
        { error: "Please use Google to sign in", code: AUTH_ERROR_CODES.INVALID_CREDENTIALS },
        { status: 401 }
      );
    }

    // Validate password
    const isValid = await compare(password, user.password);

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid password", code: AUTH_ERROR_CODES.INVALID_CREDENTIALS },
        { status: 401 }
      );
    }

    // Reset rate limit on successful validation
    rateLimiter.reset(clientId);

    // Return success - actual session creation happens via NextAuth signIn
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        nativeLanguage: user.nativeLanguage,
      },
    });
  } catch (err) {
    console.error("Login validation error:", err);
    return NextResponse.json(
      { error: "Internal server error", code: AUTH_ERROR_CODES.INTERNAL_ERROR },
      { status: 500 }
    );
  }
}
