// /src/lib/auth.ts
"use client";

import { useSession } from "next-auth/react";

/**
 * Hook to access the user's session with fallback to null-safe values
 */
export function useUserSession() {
  const { data: session, status } = useSession();

  const user = session?.user ?? null;

  return {
    isLoading: status === "loading",
    isAuthenticated: !!user,
    user,
    email: user?.email ?? null,
    image: user?.image ?? null,
    name: user?.name ?? "User",
    nativeLanguage: user?.nativeLanguage ?? null,
  };
}
