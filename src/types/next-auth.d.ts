import NextAuth from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string;
      image?: string;
      nativeLanguage?: string;
      quizLevel?: string; // 👈 ADD THIS
    };
  }

  interface User {
    nativeLanguage?: string;
    quizLevel?: string; // 👈 ADD THIS
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    nativeLanguage?: string;
    quizLevel?: string; // 👈 ADD THIS
  }
}

