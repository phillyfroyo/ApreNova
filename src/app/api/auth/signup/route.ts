import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { AUTH_ERROR_CODES, isValidEmail } from "@/lib/auth-errors";
import { EARLY_ADOPTER_CAP } from "@/lib/early-adopter";

export async function POST(req: Request) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body", code: AUTH_ERROR_CODES.INTERNAL_ERROR },
      { status: 400 }
    );
  }

  const { email, password, nativeLanguage, name, phone } = body;
  const normalizedPhone = typeof phone === 'string' && phone.trim() ? phone.trim() : null;

  // Validate required fields
  if (!email || !password) {
    return NextResponse.json(
      { error: "Missing email or password", code: AUTH_ERROR_CODES.MISSING_REQUIRED_FIELDS },
      { status: 400 }
    );
  }

  // Validate email format (useful for password reset emails later)
  if (!isValidEmail(email)) {
    return NextResponse.json(
      { error: "Invalid email format", code: AUTH_ERROR_CODES.INVALID_EMAIL },
      { status: 400 }
    );
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email already registered", code: AUTH_ERROR_CODES.EMAIL_EXISTS },
        { status: 409 }
      );
    }

    const hashed = await hash(password, 10);

    // Grant premium to first EARLY_ADOPTER_CAP users
    const userCount = await prisma.user.count();
    const isEarlyAdopter = userCount < EARLY_ADOPTER_CAP;

    await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashed,
        nativeLanguage: nativeLanguage ?? null,
        name: name ?? null,
        phone: normalizedPhone,
        updatedAt: new Date(),
        ...(isEarlyAdopter && { isPremium: true }),
      },
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error("Signup error:", err);
    return NextResponse.json(
      { error: "Internal server error", code: AUTH_ERROR_CODES.INTERNAL_ERROR },
      { status: 500 }
    );
  }
}

