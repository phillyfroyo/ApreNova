// src/lib/auth-helpers.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { NextRequest } from "next/server";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name?: string;
  nativeLanguage?: string;
  quizLevel?: number;
  isPremium: boolean;
}

export async function requireAuth(): Promise<AuthenticatedUser> {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    throw new AuthError("Authentication required", 401);
  }

  return {
    id: session.user.id,
    email: session.user.email || "",
    name: session.user.name,
    nativeLanguage: session.user.nativeLanguage,
    quizLevel: session.user.quizLevel,
    isPremium: session.user.isPremium || false,
  };
}

export async function requireAdminAuth(): Promise<AuthenticatedUser> {
  const user = await requireAuth();
  
  // TODO: Add admin role check once admin roles are implemented
  // For now, we'll require a specific admin user ID or implement role-based access
  // if (!user.isAdmin) {
  //   throw new AuthError("Admin access required", 403);
  // }
  
  return user;
}

export async function getUserFromSession(): Promise<AuthenticatedUser | null> {
  try {
    return await requireAuth();
  } catch {
    return null;
  }
}

export function createAuthResponse(error: AuthError) {
  return new Response(
    JSON.stringify({ 
      error: error.message,
      code: error.code 
    }),
    {
      status: error.status,
      headers: { "Content-Type": "application/json" },
    }
  );
}

export class AuthError extends Error {
  constructor(
    message: string, 
    public status: number,
    public code: string = "AUTH_ERROR"
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export function validateUserOwnership(sessionUserId: string, requestedUserId: string): void {
  if (sessionUserId !== requestedUserId) {
    throw new AuthError("Access denied: can only access your own data", 403, "FORBIDDEN");
  }
}