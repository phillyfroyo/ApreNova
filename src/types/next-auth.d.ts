import NextAuth from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string;
      name?: string;
      image?: string;
      nativeLanguage?: string;
      quizLevel?: string; // 👈 ADD THIS
      isPremium?: boolean;
    };
  }

  interface User {
    id: string
    name?: string;
    nativeLanguage?: string;
    quizLevel?: string; // 👈 ADD THIS
    isPremium?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    name?: string;
    nativeLanguage?: string;
    quizLevel?: string; // 👈 ADD THIS
    isPremium?: boolean;
  }
}

