// src/app/api/admin/auth/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  authenticate,
  validateToken,
  invalidateSession,
  getClientId,
  extractBearerToken,
  getAuthStats,
} from "@/lib/admin/auth-service";

/**
 * Extract client identifier from request
 */
function getClientIdFromRequest(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0].trim() || req.headers.get("x-real-ip");
  const userAgent = req.headers.get("user-agent");
  return getClientId(ip, userAgent);
}

/**
 * POST /api/admin/auth
 * Authenticate with admin secret and receive a session token
 */
export async function POST(req: NextRequest) {
  try {
    const { secret } = await req.json();

    if (!secret || typeof secret !== "string") {
      return NextResponse.json(
        { error: "Secret is required" },
        { status: 400 }
      );
    }

    const clientId = getClientIdFromRequest(req);
    const result = authenticate(secret, clientId);

    if (!result.success) {
      const status = result.retryAfter ? 429 : 401;
      const headers: HeadersInit = {};

      if (result.retryAfter) {
        headers["Retry-After"] = result.retryAfter.toString();
      }

      return NextResponse.json(
        { error: result.error },
        { status, headers }
      );
    }

    // Return session token
    // Note: In production, prefer httpOnly cookie for the token
    return NextResponse.json({
      success: true,
      message: "Admin authenticated successfully",
      token: result.token,
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    console.error("Admin auth error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/auth
 * Validate an existing session token
 * Returns session info if valid
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = extractBearerToken(authHeader);

    if (!token) {
      return NextResponse.json(
        { error: "Authorization token required" },
        { status: 401 }
      );
    }

    const clientId = getClientIdFromRequest(req);
    const result = validateToken(token, clientId);

    if (!result.valid) {
      return NextResponse.json(
        { error: result.error },
        { status: 401 }
      );
    }

    return NextResponse.json({
      valid: true,
      expiresAt: result.session?.expiresAt,
      rotationCount: result.session?.rotationCount,
    });
  } catch (error) {
    console.error("Admin auth validation error:", error);
    return NextResponse.json(
      { error: "Validation failed" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/auth
 * Logout / invalidate session
 */
export async function DELETE(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = extractBearerToken(authHeader);

    if (!token) {
      return NextResponse.json(
        { error: "Authorization token required" },
        { status: 401 }
      );
    }

    const invalidated = invalidateSession(token);

    return NextResponse.json({
      success: true,
      invalidated,
    });
  } catch (error) {
    console.error("Admin logout error:", error);
    return NextResponse.json(
      { error: "Logout failed" },
      { status: 500 }
    );
  }
}
