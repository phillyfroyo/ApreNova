// src/app/api/admin/auth/route.ts
import { NextRequest, NextResponse } from "next/server";
import { validateAdminSecret } from "@/lib/auth-helpers";

export async function POST(req: NextRequest) {
  try {
    const { secret } = await req.json();

    if (!secret || typeof secret !== "string") {
      return NextResponse.json(
        { error: "Secret is required" },
        { status: 400 }
      );
    }

    const isValid = validateAdminSecret(secret);

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid admin secret" },
        { status: 401 }
      );
    }

    // Return a session token (the secret itself acts as the token for simplicity)
    // In production, you might want to generate a separate session token
    return NextResponse.json({
      success: true,
      message: "Admin authenticated successfully"
    });
  } catch (error) {
    console.error("Admin auth error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}
